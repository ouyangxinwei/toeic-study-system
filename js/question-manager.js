/**
 * 题目管理模块
 * 负责加载、显示、更新题目
 */

class QuestionManager {
  constructor() {
    this.currentSet = null;
    this.config = null;
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

    // Supabase 为可选远程数据源；未配置时继续使用静态 JSON + localStorage。
    if (window.toeicSupabaseReady && window.toeicSupabase) {
      try {
        const { data, error } = await window.toeicSupabase
          .from('toeic_questions')
          .select('*')
          .eq('set_id', Number(setId));
        if (error) throw error;
        (data || []).forEach(row => {
          const part = this.currentSet.parts.find(item => Number(item.partId) === Number(row.part_id));
          if (!part) return;
          const remoteQuestion = {
            questionId: row.question_id, title: row.title, options: row.options || {},
            correctAnswer: row.correct_answer || '', audio: row.audio || { type: 'none' },
            note: row.note || '', status: row.status || 'unanswered', partId: Number(row.part_id),
            createdAt: row.created_at, updatedAt: row.updated_at
          };
          const index = part.questions.findIndex(q => q.questionId === row.question_id);
          if (index >= 0) part.questions[index] = { ...part.questions[index], ...remoteQuestion };
          else part.questions.push(remoteQuestion);
        });
        this.currentSet.parts.forEach(part => {
          part.questions.sort((a, b) => a.questionId.localeCompare(b.questionId, undefined, { numeric: true }));
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
      return stored;
    } catch (cause) {
      console.error('[录入新题] Supabase 写入失败:', cause);
      const error = new Error(`题目已保存在本地，但云端写入失败：${cause.message || cause.code || '未知错误'}。请检查 toeic_questions 表、authenticated 的 INSERT/UPDATE 权限及 RLS 策略。`);
      error.localSaved = true;
      error.cause = cause;
      throw error;
    }
  }

  /** 删除题目：先确认调用方已确认，再删除本地及云端记录。 */
  async deleteQuestion(setId, questionId) {
    if (!this.currentSet || Number(this.currentSet.setId) !== Number(setId)) {
      const loaded = await this.loadSet(setId);
      if (!loaded) throw new Error(`无法加载第${setId}套题目`);
    }
    const part = this.currentSet.parts.find(p => p.questions.some(q => String(q.questionId) === String(questionId)));
    if (!part) throw new Error(`未找到题目 ${questionId}`);
    part.questions = part.questions.filter(q => String(q.questionId) !== String(questionId));
    part.questionCount = part.questions.length;
    const key = `set${setId}_data`;
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
    delete cache[questionId];
    localStorage.setItem(key, JSON.stringify(cache));
    if (window.toeicSupabaseReady && window.toeicSupabase) {
      const { data: sessionData, error: sessionError } = await window.toeicSupabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error('登录已失效，请重新登录后删除云端题目。');
      const { error } = await window.toeicSupabase.from('toeic_questions').delete()
        .eq('set_id', Number(setId)).eq('question_id', String(questionId));
      if (error) throw error;
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
  async renderSetsList() {
    const setsList = document.getElementById('setsList');
    setsList.innerHTML = '';

    for (let i = 1; i <= 15; i++) {
      const setData = await this.loadSet(i);
      if (setData) {
        const stats = this.getStatistics();
        const card = this.createSetCard(setData, stats);
        setsList.appendChild(card);
      }
    }
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