/**
 * 题目管理模块
 * 负责加载、显示、更新题目
 */

class QuestionManager {
  constructor() {
    this.currentSet = null;
    this.config = null;
    this.cloudQuestionsBySet = null;
    this.cloudCachePromise = null;
    this.init();
  }

  /**
   * 初始化
   */
  async init() {
    await this.loadConfig();
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      const response = await fetch('data/config.json');
      this.config = await response.json();
    } catch (error) {
      console.error('加载配置失败:', error);
      const message = window.location.protocol === 'file:'
        ? '当前通过 file:// 直接打开，浏览器会阻止读取题库文件。请双击项目目录中的“启动系统.bat”，或在项目目录运行 python -m http.server 8000 后访问 http://localhost:8000。'
        : `加载配置失败：${error.message || '网络请求失败'}。请确认服务器已启动，且网址对应项目根目录。`;
      Utils.showToast(message, 'error', 8000);
    }
  }

  /**
   * 加载套题数据
   * @param {number} setId - 套题ID
   * @returns {Promise<Object>} 套题数据
   */
  async loadSet(setId) {
    // 静态题库加载与浏览器本地数据解析分开处理：本地缓存损坏不应导致整套题无法打开。
    let loadedSet;
    try {
      const fileName = `data/sets/set${String(setId).padStart(2, '0')}.json`;
      const response = await fetch(fileName);
      if (!response.ok) {
        throw new Error(`读取 ${fileName} 失败（HTTP ${response.status}）。请确认项目目录完整，并通过本地 HTTP 服务器打开。`);
      }
      loadedSet = await response.json();
      if (!loadedSet || !Array.isArray(loadedSet.parts)) {
        throw new Error(`${fileName} 的数据格式不正确：缺少 parts 数组`);
      }
    } catch (error) {
      console.error(`加载第${setId}套静态题库失败:`, error);
      let message = error.message || `无法加载第${setId}套题目`;
      if (window.location.protocol === 'file:') {
        message = '无法通过双击 index.html 读取题库（浏览器限制）。请关闭当前页面，双击项目根目录中的“启动系统.bat”；如果没有 Python，请按 README 中的备用命令启动。';
      } else if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
        message = `网络请求失败，无法读取 ${fileName}。请确认地址栏是 http://localhost:8000/ 开头，并且服务器从包含 index.html、data、js、css 的项目根目录启动。`;
      }
      Utils.showToast(message, 'error', 8000);
      return null;
    }

    this.currentSet = loadedSet;

    // 单独读取本地数据。若旧版本留下了损坏的缓存，仍可正常加载静态题库。
    const storageKey = `set${setId}_data`;
    const rawUserData = localStorage.getItem(storageKey);
    if (rawUserData) {
      try {
        const parsed = JSON.parse(rawUserData);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          this.mergeUserData(parsed);
        } else {
          console.warn(`${storageKey} 格式不是对象，已忽略该缓存。`);
          Utils.showToast('发现无法识别的本地题目缓存，已先加载原始题库；建议导出备份后检查缓存。', 'warning', 5000);
        }
      } catch (error) {
        console.error(`解析本地题库缓存 ${storageKey} 失败:`, error);
        Utils.showToast('本地缓存格式异常，已加载原始题库；请先导出可用数据或清理损坏缓存后再录入。', 'warning', 5000);
      }
    }

    // 统计数始终以当前实际题目数组为准，避免 JSON 中的旧 questionCount 或缓存残留造成虚高。
    this.currentSet.parts.forEach(part => { part.questionCount = Array.isArray(part.questions) ? part.questions.length : 0; });

    // Supabase 已预加载全量缓存时直接使用缓存，避免每套题单独请求云端。
    // 单独打开套题时也会复用同一份缓存；缓存不存在时再按套题查询。
    if (window.toeicSupabaseReady && window.toeicSupabase) {
      try {
        let rows;
        if (this.cloudQuestionsBySet) {
          rows = this.cloudQuestionsBySet.get(Number(setId)) || [];
        } else {
          const { data, error } = await window.toeicSupabase
            .from('toeic_questions').select('*').eq('set_id', Number(setId));
          if (error) throw error;
          rows = data || [];
        }
        // 云端查询成功后，云端数据是该套题的唯一事实来源，避免旧缓存导致重复计数。
        this.currentSet.parts.forEach(part => { part.questions = []; });
        rows.forEach(row => {
          const part = this.currentSet.parts.find(item => Number(item.partId) === Number(row.part_id));
          if (!part) return;
          part.questions.push({
            questionId: String(row.question_id), title: row.title || '', options: row.options || {},
            correctAnswer: row.correct_answer || '', audio: row.audio || { type: 'none' },
            note: row.note || '', status: row.status || 'unanswered', partId: Number(row.part_id),
            createdAt: row.created_at, updatedAt: row.updated_at
          });
        });
        this.currentSet.parts.forEach(part => {
          part.questions.sort((a, b) => String(a.questionId).localeCompare(String(b.questionId), undefined, { numeric: true }));
          part.questionCount = part.questions.length;
        });
      } catch (error) {
        console.error('Supabase 读取题库失败:', error);
        Utils.showToast(`云端题库读取失败：${error.message || error.code || '请检查 Supabase 配置、表名及 RLS 策略'}`, 'error', 8000);
      }
    }

    return this.currentSet;
  }

  /**
   * 合并用户数据（笔记、状态等）
   * @param {Object} userData - 用户数据
   */
  mergeUserData(userData) {
    if (!this.currentSet || !userData) return;

    this.currentSet.parts.forEach(part => {
      part.questions.forEach(question => {
        const userQuestion = userData[question.questionId];
        if (userQuestion) {
          question.note = userQuestion.note ?? question.note ?? '';
          question.status = userQuestion.status || question.status || 'unanswered';
          question.audio = userQuestion.audio || question.audio || { type: 'none' };
          question.updatedAt = userQuestion.updatedAt || question.updatedAt;
        }
      });
    });

    // 将 localStorage 中新增、但静态 JSON 尚不存在的题目合并回题库。
    Object.values(userData).forEach(userQuestion => {
      if (!userQuestion || !userQuestion.questionId) return;
      const alreadyExists = this.currentSet.parts.some(part =>
        part.questions.some(question => question.questionId === userQuestion.questionId)
      );
      if (alreadyExists) return;

      const partId = Number(userQuestion.partId);
      const targetPart = this.currentSet.parts.find(part => part.partId === partId);
      if (targetPart) targetPart.questions.push({ ...userQuestion });
    });

    this.currentSet.parts.forEach(part => {
      part.questions.sort((a, b) => a.questionId.localeCompare(b.questionId, undefined, { numeric: true }));
      part.questionCount = part.questions.length;
    });
  }

  /**
   * 保存用户数据到localStorage
   */
  saveUserData() {
    if (!this.currentSet) return;

    const storageKey = `set${this.currentSet.setId}_data`;
    // 保留新增题目等已有用户数据，避免保存状态/笔记时被覆盖。
    let userData = {};
    try {
      userData = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (error) {
      console.warn('用户题库数据无法解析，将重新建立数据:', error);
    }
    this.currentSet.parts.forEach(part => {
      part.questions.forEach(question => {
        userData[question.questionId] = {
          ...userData[question.questionId],
          ...question,
          partId: part.partId,
          note: question.note ?? '',
          status: question.status || 'unanswered',
          audio: question.audio || { type: 'none' },
          updatedAt: question.updatedAt || new Date().toISOString()
        };
      });
    });

    localStorage.setItem(storageKey, JSON.stringify(userData));
    if (window.toeicSupabaseReady && window.toeicSupabase) {
      const rows = this.currentSet.parts.flatMap(part => part.questions.map(question => ({
        set_id: Number(this.currentSet.setId), part_id: Number(part.partId), question_id: question.questionId,
        title: question.title || '', options: question.options || {}, correct_answer: question.correctAnswer || '',
        audio: question.audio || { type: 'none' }, note: question.note || '',
        status: question.status || 'unanswered', updated_at: question.updatedAt || new Date().toISOString()
      })));
      window.toeicSupabase.from('toeic_questions').upsert(rows, { onConflict: 'set_id,question_id' })
        .then(({ error }) => { if (error) console.error('同步题目状态/笔记到 Supabase 失败:', error); });
    }
  }

  /**
   * 添加用户录入的新题目，并持久化到浏览器。
   * @param {number} setId
   * @param {number} partId
   * @param {Object} question
   */
  async addQuestion(setId, partId, question) {
    const setData = await this.loadSet(setId);
    if (!setData) throw new Error(`无法加载第${setId}套题目`);
    const part = setData.parts.find(item => item.partId === partId);
    if (!part) throw new Error(`第${setId}套中不存在 Part ${partId}`);

    const duplicate = setData.parts.some(item =>
      item.questions.some(existing => existing.questionId === question.questionId)
    );
    if (duplicate) throw new Error(`题号 ${question.questionId} 已存在，请更换题号`);

    const stored = { ...question, partId };
    part.questions.push(stored);
    part.questions.sort((a, b) => a.questionId.localeCompare(b.questionId, undefined, { numeric: true }));
    part.questionCount = part.questions.length;
    this.currentSet = setData;
    // 先同步写入 localStorage，保证网络错误时题目仍可在当前浏览器恢复。
    this.saveUserData();

    if (!window.toeicSupabaseReady || !window.toeicSupabase) {
      const error = new Error('Supabase 客户端未初始化；题目已保存在本地，但尚未写入云端。请检查 js/supabase-client.js。');
      error.localSaved = true;
      throw error;
    }

    try {
      const { data: sessionData, error: sessionError } = await window.toeicSupabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error('当前登录会话已失效，请重新登录后再保存。');

      const row = {
        set_id: Number(setId), part_id: Number(partId), question_id: String(stored.questionId),
        title: String(stored.title || ''), options: stored.options || {}, correct_answer: stored.correctAnswer || '',
        audio: stored.audio || { type: 'none' }, note: stored.note || '',
        status: stored.status || 'unanswered',
        created_at: stored.createdAt || new Date().toISOString(),
        updated_at: stored.updatedAt || new Date().toISOString()
      };
      const { error } = await window.toeicSupabase
        .from('toeic_questions')
        .upsert(row, { onConflict: 'set_id,question_id' })
        .select('set_id,part_id,question_id')
        .single();
      if (error) throw error;
      this.cloudQuestionsBySet = null;
      this.cloudCachePromise = null;
      return stored;
    } catch (cause) {
      console.error('[录入新题] Supabase 写入失败:', cause);
      const error = new Error(`题目已保存在本地，但云端写入失败：${cause.message || cause.code || '未知错误'}。请检查 toeic_questions 表、authenticated 的 INSERT/UPDATE 权限及 RLS 策略。`);
      error.localSaved = true;
      error.cause = cause;
      throw error;
    }
  }

  /** 修改题目所有可录入字段，并同步到云端。支持修改套题、Part 和题号。 */
  async editQuestion(oldSetId, oldQuestionId, newSetId, updated) {
    const targetSetId = Number(newSetId);
    const oldSet = await this.loadSet(Number(oldSetId));
    if (!oldSet) throw new Error(`无法加载第${oldSetId}套题目`);
    const oldPart = oldSet.parts.find(p => p.questions.some(q => String(q.questionId) === String(oldQuestionId)));
    const oldQuestion = oldPart && oldPart.questions.find(q => String(q.questionId) === String(oldQuestionId));
    if (!oldQuestion) throw new Error(`未找到原题 ${oldQuestionId}`);
    const targetSet = targetSetId === Number(oldSetId) ? oldSet : await this.loadSet(targetSetId);
    if (!targetSet) throw new Error(`无法加载第${targetSetId}套题目`);
    const targetPart = targetSet.parts.find(p => Number(p.partId) === Number(updated.partId));
    if (!targetPart) throw new Error(`第${targetSetId}套中不存在 Part ${updated.partId}`);
    const duplicate = targetSet.parts.some(p => p.questions.some(q =>
      !(Number(oldSetId) === targetSetId && String(q.questionId) === String(oldQuestionId)) && String(q.questionId) === String(updated.questionId)
    ));
    if (duplicate) throw new Error(`题号 ${updated.questionId} 已存在`);

    const now = new Date().toISOString();
    const saved = { ...oldQuestion, ...updated, questionId: String(updated.questionId), partId: Number(updated.partId), createdAt: oldQuestion.createdAt || now, updatedAt: now };
    if (window.toeicSupabaseReady && window.toeicSupabase) {
      const { data: sessionData, error: sessionError } = await window.toeicSupabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error('登录会话已失效，请重新登录后修改。');
      const row = { set_id: targetSetId, part_id: saved.partId, question_id: saved.questionId, title: saved.title || '', options: saved.options || {}, correct_answer: saved.correctAnswer || '', audio: saved.audio || {type:'none'}, note: saved.note || '', status: saved.status || 'unanswered', created_at: saved.createdAt, updated_at: saved.updatedAt };
      const { error: upsertError } = await window.toeicSupabase.from('toeic_questions').upsert(row, { onConflict: 'set_id,question_id' });
      if (upsertError) throw upsertError;
      const changedKey = Number(oldSetId) !== targetSetId || String(oldQuestionId) !== String(saved.questionId);
      if (changedKey) {
        const { data: deleted, error: deleteError } = await window.toeicSupabase.from('toeic_questions').delete().eq('set_id', Number(oldSetId)).eq('question_id', String(oldQuestionId)).select('question_id');
        if (deleteError) throw deleteError;
        if (!deleted || deleted.length === 0) {
          // 新记录已经写入，提示用户原记录清理失败，避免隐瞒重复数据。
          throw new Error('新题目已保存，但旧题号/旧套题记录未能删除。请检查 DELETE RLS 策略。');
        }
      }
    }

    // 更新浏览器缓存；若跨套题移动，也清理原套题缓存。
    const oldKey = `set${Number(oldSetId)}_data`;
    let oldCache = {}; try { oldCache = JSON.parse(localStorage.getItem(oldKey) || '{}'); } catch (_) {}
    delete oldCache[String(oldQuestionId)];
    if (Number(oldSetId) !== targetSetId) localStorage.setItem(oldKey, JSON.stringify(oldCache));
    const oldPartIndex = oldSet.parts.findIndex(p => p.questions.some(q => String(q.questionId) === String(oldQuestionId)));
    if (oldPartIndex >= 0) {
      oldSet.parts[oldPartIndex].questions = oldSet.parts[oldPartIndex].questions.filter(q => String(q.questionId) !== String(oldQuestionId));
      oldSet.parts[oldPartIndex].questionCount = oldSet.parts[oldPartIndex].questions.length;
    }
    const targetExistingPart = targetSet.parts.find(p => p.questions.some(q => String(q.questionId) === String(saved.questionId)));
    if (targetExistingPart) targetExistingPart.questions = targetExistingPart.questions.filter(q => String(q.questionId) !== String(saved.questionId));
    targetPart.questions.push(saved);
    targetPart.questions.sort((a,b) => String(a.questionId).localeCompare(String(b.questionId), undefined, {numeric:true}));
    targetSet.parts.forEach(p => p.questionCount = p.questions.length);
    this.currentSet = targetSet;
    const targetKey = `set${targetSetId}_data`;
    let targetCache = {}; try { targetCache = JSON.parse(localStorage.getItem(targetKey) || '{}'); } catch (_) {}
    targetCache[saved.questionId] = saved;
    localStorage.setItem(targetKey, JSON.stringify(targetCache));
    this.cloudQuestionsBySet = null; this.cloudCachePromise = null;
    return saved;
  }

  /** 删除题目：先确认调用方已确认，再删除本地及云端记录。 */
  async deleteQuestion(setId, questionId) {
    if (!this.currentSet || Number(this.currentSet.setId) !== Number(setId)) {
      const loaded = await this.loadSet(setId);
      if (!loaded) throw new Error(`无法加载第${setId}套题目`);
    }
    const part = this.currentSet.parts.find(p => p.questions.some(q => String(q.questionId) === String(questionId)));
    if (!part) throw new Error(`未找到题目 ${questionId}`);
    // 先删除云端，确认成功后再改本地界面，避免云端删除失败但本地已消失。
    if (window.toeicSupabaseReady && window.toeicSupabase) {
      const { data: sessionData, error: sessionError } = await window.toeicSupabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error('登录已失效，请重新登录后删除云端题目。');
      // select() 返回实际删除的行数；Supabase 在 RLS 不允许删除时可能返回空数组而非明显错误。
      const { data: deletedRows, error } = await window.toeicSupabase.from('toeic_questions').delete()
        .eq('set_id', Number(setId)).eq('question_id', String(questionId))
        .select('set_id, question_id');
      if (error) throw error;
      if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
        throw new Error(`云端没有删除任何记录。请在 Supabase 执行 supabase_v14_delete_policy.sql，并确认 set_id=${setId}、question_id=${questionId} 的记录存在。`);
      }
    }
    part.questions = part.questions.filter(q => String(q.questionId) !== String(questionId));
    part.questionCount = part.questions.length;
    const key = `set${setId}_data`;
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
    delete cache[questionId];
    localStorage.setItem(key, JSON.stringify(cache));
    if (this.cloudQuestionsBySet) {
      const rows = this.cloudQuestionsBySet.get(Number(setId)) || [];
      this.cloudQuestionsBySet.set(Number(setId), rows.filter(row => String(row.question_id) !== String(questionId)));
    }
    return true;
  }

  /**
   * 获取题目列表
   * @param {number} partId - Part ID
   * @returns {Array} 题目列表
   */
  getQuestions(partId) {
    if (!this.currentSet) return [];
    
    const part = this.currentSet.parts.find(p => p.partId === partId);
    return part ? part.questions : [];
  }

  /**
   * 获取单个题目
   * @param {string} questionId - 题目ID
   * @returns {Object} 题目对象
   */
  getQuestion(questionId) {
    if (!this.currentSet) return null;

    for (const part of this.currentSet.parts) {
      const question = part.questions.find(q => q.questionId === questionId);
      if (question) return question;
    }
    return null;
  }

  /**
   * 更新题目状态
   * @param {string} questionId - 题目ID
   * @param {string} status - 状态
   */
  updateStatus(questionId, status) {
    const question = this.getQuestion(questionId);
    if (question) {
      question.status = status;
      question.updatedAt = new Date().toISOString();
      this.saveUserData();
    }
  }

  /**
   * 更新题目内容
   * @param {string} questionId - 题目ID
   * @param {Object} data - 更新的数据
   */
  updateQuestion(questionId, data) {
    const question = this.getQuestion(questionId);
    if (question) {
      Object.assign(question, data);
      question.updatedAt = new Date().toISOString();
      this.saveUserData();
    }
  }

  /**
   * 获取套题统计
   * @returns {Object} 统计数据
   */
  getStatistics() {
    if (!this.currentSet) return null;

    const stats = {
      total: 0,
      answered: 0,
      correct: 0,
      wrong: 0,
      reviewed: 0
    };

    this.currentSet.parts.forEach(part => {
      part.questions.forEach(question => {
        stats.total++;
        if (question.status !== 'unanswered') {
          stats.answered++;
          if (question.status === 'correct') stats.correct++;
          if (question.status === 'wrong') stats.wrong++;
          if (question.status === 'reviewed') stats.reviewed++;
        }
      });
    });

    return stats;
  }

  /**
   * 渲染套题列表
   */
  async loadCloudQuestionCache() {
    if (!window.toeicSupabaseReady || !window.toeicSupabase) return false;
    if (this.cloudQuestionsBySet) return true;
    if (this.cloudCachePromise) return this.cloudCachePromise;

    this.cloudCachePromise = (async () => {
      const grouped = new Map(Array.from({ length: 15 }, (_, i) => [i + 1, []]));
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await window.toeicSupabase
          .from('toeic_questions').select('*').order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const page = data || [];
        page.forEach(row => {
          const id = Number(row.set_id);
          if (grouped.has(id)) grouped.get(id).push(row);
        });
        if (page.length < pageSize) break;
        from += pageSize;
      }
      this.cloudQuestionsBySet = grouped;
      return true;
    })().catch(error => {
      console.error('预加载云端题库失败，将改为逐套读取:', error);
      this.cloudCachePromise = null;
      Utils.showToast(`云端题库预加载失败，将逐套加载：${error.message || error.code || '未知错误'}`, 'warning', 6000);
      return false;
    });
    return this.cloudCachePromise;
  }

  async renderSetsList(setId = Number(localStorage.getItem('toeic_current_set_id') || 1)) {
    const setsList = document.getElementById('setsList');
    if (!setsList) {
      console.error('未找到套题列表容器 #setsList');
      return;
    }
    // 每次切换都先清空旧 DOM，确保页面绝不会残留其他套题卡片。
    setsList.replaceChildren();
    const selectedSetId = Number(setId);
    if (!Number.isInteger(selectedSetId) || selectedSetId < 1 || selectedSetId > 15) {
      Utils.showToast('套题编号无效，请选择第 1 至第 15 套。', 'error');
      return;
    }
    // 只加载所选套题，避免启动时读取全部 15 套及全量云端缓存。
    this.cloudQuestionsBySet = null;
    this.cloudCachePromise = null;
    const setData = await this.loadSet(selectedSetId);
    if (!setData) return;
    this.currentSet = setData;
    const stats = this.getStatistics();
    const card = this.createSetCard(setData, stats);
    card.dataset.setId = String(selectedSetId);
    setsList.replaceChildren(card);
    // 额外防护：仅允许当前选择的套题卡片留在列表中。
    setsList.querySelectorAll('.set-card').forEach(item => {
      if (item.dataset.setId !== String(selectedSetId)) item.remove();
    });
    const picker = document.getElementById('currentSetSelect');
    if (picker && picker.value !== String(selectedSetId)) picker.value = String(selectedSetId);
  }

  /**
   * 创建套题卡片
   * @param {Object} setData - 套题数据
   * @param {Object} stats - 统计数据
   * @returns {HTMLElement} 卡片元素
   */
  createSetCard(setData, stats) {
    const card = document.createElement('div');
    card.className = 'set-card';
    card.innerHTML = `
      <div class="set-info">
        <h3>${setData.setName}</h3>
        <div class="set-stats">
          <span class="stat-item">总题数: ${stats.total}</span>
          <span class="stat-item wrong">错题: ${stats.wrong}</span>
          <span class="stat-item reviewed">已复习: ${stats.reviewed}</span>
        </div>
      </div>
      <div class="set-actions">
        <button onclick="app.openSet(${setData.setId})">进入</button>
      </div>
    `;
    return card;
  }
}

// 创建全局实例
const questionManager = new QuestionManager();