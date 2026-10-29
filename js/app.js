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

      // 渲染套题列表
      await questionManager.renderSetsList();

      Utils.showToast('应用加载成功', 'success', 2000);
    } catch (error) {
      console.error('应用初始化失败:', error);
      Utils.showToast('应用初始化失败', 'error');
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
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

    // 弹窗关闭按钮
    document.querySelector('.modal .close').addEventListener('click', () => {
      this.closeModal();
    });

    // 点击弹窗外部关闭
    window.addEventListener('click', (e) => {
      const modal = document.getElementById('questionModal');
      if (e.target === modal) {
        this.closeModal();
      }
    });

    // ESC键关闭弹窗
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
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

    return card;
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
}

// 创建全局应用实例
const app = new App();