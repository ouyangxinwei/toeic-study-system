/**
 * 主应用模块
 * 整合所有功能模块，处理页面交互
 */

class App {
  constructor() {
    this.currentSetId = null;
    this.isSearchMode = false;
    this.init();
  }

  /**
   * 初始化应用
   */
  async init() {
    try {
      // 等待所有模块初始化
      await Promise.all([
        questionManager.init(),
        syncManager.init()
      ]);

      // 绑定事件
      this.bindEvents();

      // 恢复用户上次选择的套题，并且只加载该套
      const savedSetId = await this.loadPreferredSetId();
      const picker = document.getElementById('currentSetSelect');
      if (picker) {
        picker.value = String(savedSetId);
        picker.addEventListener('change', async () => {
          const setId = Number(picker.value);
          if (!Number.isInteger(setId) || setId < 1 || setId > 15) return;
          localStorage.setItem('toeic_current_set_id', String(setId));
          await this.savePreferredSetId(setId);
          await questionManager.renderSetsList(setId);
          this.currentSetId = null;
          this.isSearchMode = false;
        });
      }
      await questionManager.renderSetsList(savedSetId);

      Utils.showToast('应用加载成功', 'success', 2000);
    } catch (error) {
      console.error('应用初始化失败:', error);
      Utils.showToast('应用初始化失败', 'error');
    }
  }

  async loadPreferredSetId() {
    const localValue = Number(localStorage.getItem('toeic_current_set_id') || 1);
    const fallback = Number.isInteger(localValue) && localValue >= 1 && localValue <= 15 ? localValue : 1;
    if (!window.toeicSupabaseReady || !window.toeicSupabase) return fallback;
    try {
      const { data: authData } = await window.toeicSupabase.auth.getUser();
      const userId = authData && authData.user && authData.user.id;
      if (!userId) return fallback;
      const { data, error } = await window.toeicSupabase.from('toeic_user_preferences')
        .select('selected_set_id').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      const setId = Number(data && data.selected_set_id);
      if (Number.isInteger(setId) && setId >= 1 && setId <= 15) {
        localStorage.setItem('toeic_current_set_id', String(setId));
        return setId;
      }
    } catch (error) {
      console.warn('读取云端当前套题偏好失败，使用本地选择：', error.message || error);
    }
    return fallback;
  }

  async savePreferredSetId(setId) {
    if (!window.toeicSupabaseReady || !window.toeicSupabase) return;
    try {
      const { data: authData, error: authError } = await window.toeicSupabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData && authData.user && authData.user.id;
      if (!userId) return;
      const { error } = await window.toeicSupabase.from('toeic_user_preferences').upsert({
        user_id: userId,
        selected_set_id: setId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) throw error;
    } catch (error) {
      console.error('保存云端当前套题偏好失败：', error);
      Utils.showToast('套题已切换，但云端记忆失败；本机仍会记住选择。请执行 V12 SQL 并检查 RLS。', 'warning', 6000);
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
  
  // 录入按钮
document.getElementById('addQuestionBtn').addEventListener('click', () => {
    this.showAddQuestionModal();
});

// 关闭录入弹窗
document.getElementById('closeAddModal').addEventListener('click', () => {
    this.closeAddQuestionModal();
});

document.getElementById('cancelAddBtn').addEventListener('click', () => {
    this.closeAddQuestionModal();
});

// 提交表单
document.getElementById('addQuestionForm').addEventListener('submit', (e) => {
    e.preventDefault();
    this.handleAddQuestion();
});
    // 搜索按钮
    document.getElementById('searchBtn').addEventListener('click', () => {
      this.handleSearch();
    });

    // 搜索输入框回车
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch();
      }
    });

    // Part筛选
    document.getElementById('partFilter').addEventListener('change', () => {
      if (this.isSearchMode) {
        this.handleSearch();
      }
    });

    // 状态筛选
    document.getElementById('statusFilter').addEventListener('change', () => {
      if (this.isSearchMode) {
        this.handleSearch();
      }
    });

    // 导出CSV按钮
    document.getElementById('exportCSVBtn').addEventListener('click', () => {
      this.handleExport('csv');
    });

    // 导出JSON按钮
    document.getElementById('exportJSONBtn').addEventListener('click', () => {
      this.handleExport('json');
    });

    // 同步按钮
    document.getElementById('syncBtn').addEventListener('click', () => {
      this.handleSync();
    });

    // 本机与云端的单向数据传输按钮
    document.getElementById('uploadLocalToCloudBtn').addEventListener('click', () => {
      syncManager.uploadLocalToCloud();
    });
    document.getElementById('downloadCloudToLocalBtn').addEventListener('click', () => {
      syncManager.downloadCloudToLocal();
    });

    // 弹窗关闭按钮
    document.querySelector('#questionModal .close').addEventListener('click', () => {
      this.closeModal();
    });

    // 点击弹窗外部关闭
    window.addEventListener('click', (e) => {
      const modal = document.getElementById('questionModal');
      const addModal = document.getElementById('addQuestionModal');
      if (e.target === modal) this.closeModal();
      if (e.target === addModal) this.closeAddQuestionModal();
    });

    // ESC键关闭弹窗
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        this.closeAddQuestionModal();
      }
    });
  }

  /**
   * 处理搜索
   */
  async handleSearch() {
    const keyword = document.getElementById('searchInput').value.trim();
    const partFilter = document.getElementById('partFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    if (!this.currentSetId) {
      Utils.showToast('请先选择一套题', 'info');
      return;
    }

    const filters = {};
    if (partFilter) filters.partId = partFilter;
    if (statusFilter) filters.status = statusFilter;

    // 执行搜索
    const results = await searchEngine.search(this.currentSetId, keyword, filters);

    // 显示搜索结果
    this.displaySearchResults(results);
    this.isSearchMode = true;
  }

  /**
   * 显示搜索结果
   * @param {Array} results - 搜索结果
   */
  displaySearchResults(results) {
    const setsList = document.getElementById('setsList');
    searchEngine.renderSearchResults(results, setsList);
  }

  /**
   * 打开套题
   * @param {number} setId - 套题ID
   */
  async openSet(setId) {
    this.currentSetId = setId;
    this.isSearchMode = false;

    try {
      // 加载套题数据
      const setData = await questionManager.loadSet(setId);
      if (!setData) {
        Utils.showToast('加载套题失败', 'error');
        return;
      }

      // 显示套题详情
      this.displaySetDetail(setData);

      Utils.showToast(`已打开${setData.setName}`, 'success', 1500);
    } catch (error) {
      console.error('打开套题失败:', error);
      Utils.showToast('打开套题失败', 'error');
    }
  }

  /**
   * 显示套题详情
   * @param {Object} setData - 套题数据
   */
  displaySetDetail(setData) {
    const setsList = document.getElementById('setsList');
    setsList.innerHTML = '';

    // 返回按钮
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← 返回套题列表';
    backBtn.addEventListener('click', () => {
      questionManager.renderSetsList();
      this.currentSetId = null;
      this.isSearchMode = false;
    });
    setsList.appendChild(backBtn);

    // 套题标题
    const title = document.createElement('h2');
    title.className = 'set-detail-title';
    title.textContent = setData.setName;
    setsList.appendChild(title);

    // 按Part显示题目
    setData.parts.forEach(part => {
      const partSection = this.createPartSection(part);
      setsList.appendChild(partSection);
    });
  }

  /**
   * 创建Part区域
   * @param {Object} part - Part数据
   * @returns {HTMLElement} Part区域元素
   */
  createPartSection(part) {
    const section = document.createElement('div');
    section.className = 'part-section';

    section.innerHTML = `
      <h3 class="part-title">${part.partName} (${part.questionCount}题)</h3>
      <div class="questions-list"></div>
    `;

    const questionsList = section.querySelector('.questions-list');
    
    part.questions.forEach(question => {
      const questionCard = this.createQuestionCard(question);
      questionsList.appendChild(questionCard);
    });

    return section;
  }

  /**
   * 创建题目卡片
   * @param {Object} question - 题目对象
   * @returns {HTMLElement} 题目卡片元素
   */
  createQuestionCard(question) {
    const card = document.createElement('div');
    card.className = `question-card status-${question.status}`;
    
    const statusText = searchEngine.getStatusText(question.status);
    const statusClass = `status-badge status-${question.status}`;

    card.innerHTML = `
      <div class="question-header">
        <span class="question-id">${question.questionId}</span>
        <span class="${statusClass}">${statusText}</span>
      </div>
      <div class="question-preview">
        ${searchEngine.truncateText(question.title, 100)}
      </div>
      <div class="question-actions">
        <button class="view-detail-btn" data-question-id="${question.questionId}">
          查看详情
        </button>
        <button class="mark-wrong-btn" data-question-id="${question.questionId}">
          标记为错题
        </button>
        <button class="mark-reviewed-btn" data-question-id="${question.questionId}">
          标记为已复习
        </button>
        <button class="edit-question-btn" data-question-id="${question.questionId}">
          修改题目
        </button>
        <button class="delete-question-btn" data-question-id="${question.questionId}">
          删除题目
        </button>
      </div>
    `;

    // 绑定事件
    const viewBtn = card.querySelector('.view-detail-btn');
    viewBtn.addEventListener('click', () => {
      this.showQuestionDetail(question.questionId);
    });

    const markWrongBtn = card.querySelector('.mark-wrong-btn');
    markWrongBtn.addEventListener('click', () => {
      questionManager.updateStatus(question.questionId, 'wrong');
      Utils.showToast('已标记为错题', 'success', 1500);
      this.refreshCurrentView();
    });

    const markReviewedBtn = card.querySelector('.mark-reviewed-btn');
    markReviewedBtn.addEventListener('click', () => {
      questionManager.updateStatus(question.questionId, 'reviewed');
      Utils.showToast('已标记为已复习', 'success', 1500);
      this.refreshCurrentView();
    });

    card.querySelector('.edit-question-btn').addEventListener('click', () => {
      this.showEditQuestionModal(question);
    });

    card.querySelector('.delete-question-btn').addEventListener('click', async () => {
      const confirmed = window.confirm(`确定删除题目 ${question.questionId} 吗？\n此操作会删除本地缓存及 Supabase 云端记录，无法撤销。`);
      if (!confirmed) return;
      try {
        await questionManager.deleteQuestion(this.currentSetId, question.questionId);
        Utils.showToast(`题目 ${question.questionId} 已删除`, 'success', 2500);
        await this.openSet(this.currentSetId);
      } catch (error) {
        console.error('删除题目失败:', error);
        Utils.showToast(`删除失败：${error.message || '未知错误'}`, 'error', 8000);
      }
    });

    return card;
  }

  showEditQuestionModal(question) {
    let modal = document.getElementById('editQuestionModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'editQuestionModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content modal-large">
          <span class="close" id="closeEditQuestionModal">&times;</span>
          <h2>修改题目</h2>
          <form id="editQuestionForm">
            <div class="form-group"><label>套题编号 *</label><select id="editSetId" required>${Array.from({length:15},(_,i)=>`<option value="${i+1}">第${i+1}套</option>`).join('')}</select></div>
            <div class="form-group"><label>Part *</label><select id="editPartId" required>${Array.from({length:7},(_,i)=>`<option value="${i+1}">Part ${i+1}</option>`).join('')}</select></div>
            <div class="form-group"><label>题号 *</label><input id="editQuestionId" required></div>
            <div class="form-group"><label>题目标题/题干 *</label><textarea id="editTitle" rows="4" required></textarea></div>
            <div class="form-group"><label>选项 A *</label><input id="editOptionA" required></div>
            <div class="form-group"><label>选项 B *</label><input id="editOptionB" required></div>
            <div class="form-group"><label>选项 C *</label><input id="editOptionC" required></div>
            <div class="form-group"><label>选项 D *</label><input id="editOptionD" required></div>
            <div class="form-group"><label>正确答案 *</label><select id="editCorrectAnswer" required><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div>
            <div class="form-group"><label>音频链接（可选）</label><input id="editAudioUrl" placeholder="本地路径或外部链接"></div>
            <div class="form-group"><label>笔记（可选）</label><textarea id="editNote" rows="3"></textarea></div>
            <div class="form-group"><label>状态</label><select id="editStatus"><option value="unanswered">未作答</option><option value="wrong">错题</option><option value="correct">答对</option><option value="reviewed">已复习</option><option value="mastered">已掌握</option></select></div>
            <div class="form-actions"><button type="submit" class="submit-btn">保存修改</button><button type="button" class="cancel-btn" id="cancelEditQuestion">取消</button></div>
          </form>
        </div>`;
      document.body.appendChild(modal);
      const close = () => { modal.style.display = 'none'; };
      modal.querySelector('#closeEditQuestionModal').addEventListener('click', close);
      modal.querySelector('#cancelEditQuestion').addEventListener('click', close);
      modal.addEventListener('click', e => { if (e.target === modal) close(); });
      modal.querySelector('#editQuestionForm').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.currentTarget;
        const submit = form.querySelector('button[type="submit"]');
        const originalText = submit.textContent;
        submit.disabled = true; submit.textContent = '正在保存…';
        const oldSetId = Number(modal.dataset.oldSetId);
        const oldQuestionId = modal.dataset.oldQuestionId;
        const setId = Number(document.getElementById('editSetId').value);
        const partId = Number(document.getElementById('editPartId').value);
        const questionId = document.getElementById('editQuestionId').value.trim();
        const audioUrl = document.getElementById('editAudioUrl').value.trim();
        const updated = {
          questionId,
          title: document.getElementById('editTitle').value.trim(),
          options: { A: document.getElementById('editOptionA').value.trim(), B: document.getElementById('editOptionB').value.trim(), C: document.getElementById('editOptionC').value.trim(), D: document.getElementById('editOptionD').value.trim() },
          correctAnswer: document.getElementById('editCorrectAnswer').value,
          audio: audioUrl ? { type: /^https?:\/\//i.test(audioUrl) ? 'remote' : 'local', path: audioUrl, url: /^https?:\/\//i.test(audioUrl) ? audioUrl : '' } : { type: 'none' },
          note: document.getElementById('editNote').value.trim(),
          status: document.getElementById('editStatus').value,
          partId, updatedAt: new Date().toISOString()
        };
        try {
          await questionManager.editQuestion(oldSetId, oldQuestionId, setId, updated);
          modal.style.display = 'none';
          this.currentSetId = setId;
          const picker = document.getElementById('currentSetSelect'); if (picker) picker.value = String(setId);
          localStorage.setItem('toeic_current_set_id', String(setId));
          await this.savePreferredSetId(setId);
          await questionManager.renderSetsList(setId);
          Utils.showToast('题目修改成功，已同步到 Supabase。', 'success', 4000);
        } catch (error) {
          console.error('修改题目失败:', error);
          Utils.showToast(`修改失败：${error.message || '未知错误'}`, 'error', 9000);
        } finally { submit.disabled = false; submit.textContent = originalText; }
      });
    }
    const audio = question.audio || {};
    modal.dataset.oldSetId = String(this.currentSetId || questionManager.currentSet?.setId || 1);
    modal.dataset.oldQuestionId = String(question.questionId);
    document.getElementById('editSetId').value = modal.dataset.oldSetId;
    document.getElementById('editPartId').value = String(question.partId || 1);
    document.getElementById('editQuestionId').value = question.questionId || '';
    document.getElementById('editTitle').value = question.title || '';
    document.getElementById('editOptionA').value = question.options?.A || '';
    document.getElementById('editOptionB').value = question.options?.B || '';
    document.getElementById('editOptionC').value = question.options?.C || '';
    document.getElementById('editOptionD').value = question.options?.D || '';
    document.getElementById('editCorrectAnswer').value = question.correctAnswer || 'A';
    document.getElementById('editAudioUrl').value = audio.url || audio.path || '';
    document.getElementById('editNote').value = question.note || '';
    document.getElementById('editStatus').value = question.status || 'unanswered';
    modal.style.display = 'block';
  }

  /**
   * 显示题目详情
   * @param {string} questionId - 题目ID
   */
  showQuestionDetail(questionId) {
    const question = questionManager.getQuestion(questionId);
    if (!question) {
      Utils.showToast('题目不存在', 'error');
      return;
    }

    const modal = document.getElementById('questionModal');
    const detail = document.getElementById('questionDetail');

    // 清空之前的内容
    detail.innerHTML = '';

    // 创建题目详情内容
    const detailContent = document.createElement('div');
    detailContent.className = 'question-detail';

    // 题目标题
    const title = document.createElement('div');
    title.className = 'question-title';
    title.textContent = question.title;
    detailContent.appendChild(title);

    // 音频播放器
    audioPlayer.renderAudioPlayer(question, detailContent);

    // 选项列表
    const optionsList = document.createElement('div');
    optionsList.className = 'options-list';
    
    for (const key in question.options) {
      const option = document.createElement('div');
      option.className = 'option-item';
      if (key === question.correctAnswer) {
        option.classList.add('correct');
      }
      option.textContent = `${key}. ${question.options[key]}`;
      optionsList.appendChild(option);
    }
    
    detailContent.appendChild(optionsList);

    // 正确答案
    const correctAnswer = document.createElement('div');
    correctAnswer.className = 'correct-answer';
    correctAnswer.textContent = `正确答案: ${question.correctAnswer}`;
    detailContent.appendChild(correctAnswer);

    // 笔记区域
    noteManager.renderNoteSection(question, detailContent);

    detail.appendChild(detailContent);

    // 显示弹窗
    modal.style.display = 'block';
  }

  /**
   * 关闭弹窗
   */
  closeModal() {
    const modal = document.getElementById('questionModal');
    modal.style.display = 'none';
    
    // 停止音频播放
    audioPlayer.stop();
  }

  /**
   * 处理导出
   * @param {string} format - 导出格式
   */
  async handleExport(format) {
    if (!this.currentSetId) {
      Utils.showToast('请先选择一套题', 'info');
      return;
    }

    if (format === 'csv') {
      await exportManager.exportCSV(this.currentSetId);
    } else if (format === 'json') {
      await exportManager.exportJSON(this.currentSetId);
    }
  }

  /**
   * 处理同步
   */
  async handleSync() {
    if (!syncManager.checkConfig()) {
      return;
    }

    if (this.currentSetId) {
      // 同步当前套题
      await syncManager.syncToRemote(this.currentSetId);
    } else {
      // 同步所有套题
      const confirmSync = confirm('确定要同步所有套题数据吗？');
      if (confirmSync) {
        await syncManager.syncToRemote();
      }
    }
  }

  /**
   * 刷新当前视图
   */
  refreshCurrentView() {
    if (this.currentSetId) {
      if (this.isSearchMode) {
        this.handleSearch();
      } else {
        questionManager.loadSet(this.currentSetId).then(setData => {
          this.displaySetDetail(setData);
        });
      }
    } else {
      questionManager.renderSetsList();
    }
  }
  
/**
 * 显示录入弹窗
 */
showAddQuestionModal() {
    const modal = document.getElementById('addQuestionModal');
    modal.style.display = 'block';
    
    // 如果当前已选择套题，自动填充
    if (this.currentSetId) {
        document.getElementById('formSetId').value = this.currentSetId;
    }
}

/**
 * 关闭录入弹窗
 */
closeAddQuestionModal() {
    const modal = document.getElementById('addQuestionModal');
    modal.style.display = 'none';
    document.getElementById('addQuestionForm').reset();
}

/**
 * 处理录入题目
 */
async handleAddQuestion() {
    const setId = Number(document.getElementById('formSetId').value);
    const partId = Number(document.getElementById('formPartId').value);
    const questionId = document.getElementById('formQuestionId').value.trim();
    const title = document.getElementById('formTitle').value.trim();
    const optionA = document.getElementById('formOptionA').value.trim();
    const optionB = document.getElementById('formOptionB').value.trim();
    const optionC = document.getElementById('formOptionC').value.trim();
    const optionD = document.getElementById('formOptionD').value.trim();
    const correctAnswer = document.getElementById('formCorrectAnswer').value;
    const audioUrl = document.getElementById('formAudioUrl').value.trim();
    const note = document.getElementById('formNote').value.trim();

    if (!questionId || !title || !optionA || !optionB || !optionC || !optionD) {
      Utils.showToast('请填写题号、题干和全部四个选项', 'error');
      return;
    }

    const now = new Date().toISOString();
    const newQuestion = {
      questionId,
      title,
      options: { A: optionA, B: optionB, C: optionC, D: optionD },
      correctAnswer,
      audio: audioUrl ? {
        type: /^https?:\/\//i.test(audioUrl) ? 'remote' : 'local',
        path: audioUrl,
        url: /^https?:\/\//i.test(audioUrl) ? audioUrl : ''
      } : { type: 'none' },
      note,
      status: 'unanswered',
      createdAt: now,
      updatedAt: now
    };

    const form = document.getElementById('addQuestionForm');
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = '正在保存…';
    try {
      await questionManager.addQuestion(setId, partId, newQuestion);
      this.currentSetId = setId;
      this.isSearchMode = false;
      document.getElementById('searchInput').value = '';
      document.getElementById('partFilter').value = '';
      document.getElementById('statusFilter').value = '';
      this.closeAddQuestionModal();
      await this.openSet(setId);
      Utils.showToast('题目录入成功，已写入 Supabase 云端数据库。', 'success', 5000);
    } catch (error) {
      console.error('录入题目失败:', error, error.cause || '');
      // 云端写入失败时，addQuestion 已先保存到 localStorage；仍刷新页面让用户看到题目。
      if (error.localSaved) {
        this.currentSetId = setId;
        this.isSearchMode = false;
        try {
          const setData = await questionManager.loadSet(setId);
          if (setData) this.displaySetDetail(setData);
        } catch (refreshError) {
          console.error('刷新本地题目视图失败:', refreshError);
        }
        Utils.showToast(error.message || '题目已保存在本地，但云端写入失败。', 'error', 10000);
      } else {
        Utils.showToast(error.message || '题目录入失败，请检查题号是否重复', 'error', 8000);
      }
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
}


}

// 创建全局应用实例
const app = new App();