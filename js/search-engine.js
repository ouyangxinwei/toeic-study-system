/**
 * 搜索引擎模块
 * 负责题目的搜索和筛选
 */

class SearchEngine {
  constructor() {
    this.currentResults = [];
  }

  /**
   * 搜索题目
   * @param {number} setId - 套题ID
   * @param {string} keyword - 搜索关键词
   * @param {Object} filters - 筛选条件
   * @returns {Array} 搜索结果
   */
  async search(setId, keyword, filters = {}) {
    try {
      // 加载套题数据
      const setData = await questionManager.loadSet(setId);
      if (!setData) return [];

      let results = [];

      // 遍历所有题目
      setData.parts.forEach(part => {
        part.questions.forEach(question => {
          // 检查是否匹配关键词
          if (this.matchKeyword(question, keyword)) {
            results.push({
              ...question,
              partId: part.partId,
              partName: part.partName
            });
          }
        });
      });

      // 应用筛选条件
      results = this.applyFilters(results, filters);

      this.currentResults = results;
      return results;
    } catch (error) {
      console.error('搜索失败:', error);
      Utils.showToast('搜索失败', 'error');
      return [];
    }
  }

  /**
   * 检查题目是否匹配关键词
   * @param {Object} question - 题目对象
   * @param {string} keyword - 关键词
   * @returns {boolean} 是否匹配
   */
  matchKeyword(question, keyword) {
    if (!keyword || keyword.trim() === '') return true;

    const lowerKeyword = keyword.toLowerCase().trim();

    // 搜索标题
    if (question.title && question.title.toLowerCase().includes(lowerKeyword)) {
      return true;
    }

    // 搜索选项
    if (question.options) {
      for (const key in question.options) {
        if (question.options[key].toLowerCase().includes(lowerKeyword)) {
          return true;
        }
      }
    }

    // 搜索正确答案
    if (question.correctAnswer && question.correctAnswer.toLowerCase().includes(lowerKeyword)) {
      return true;
    }

    // 搜索笔记
    if (question.note && question.note.toLowerCase().includes(lowerKeyword)) {
      return true;
    }

    return false;
  }

  /**
   * 应用筛选条件
   * @param {Array} results - 搜索结果
   * @param {Object} filters - 筛选条件
   * @returns {Array} 筛选后的结果
   */
  applyFilters(results, filters) {
    let filtered = results;

    // 按Part筛选
    if (filters.partId) {
      filtered = filtered.filter(q => q.partId === parseInt(filters.partId));
    }

    // 按状态筛选
    if (filters.status) {
      filtered = filtered.filter(q => q.status === filters.status);
    }

    return filtered;
  }

  /**
   * 渲染搜索结果
   * @param {Array} results - 搜索结果
   * @param {HTMLElement} container - 容器元素
   */
  renderSearchResults(results, container) {
    container.innerHTML = '';

    if (results.length === 0) {
      container.innerHTML = '<p class="no-results">没有找到匹配的题目</p>';
      return;
    }

    // 按Part分组
    const grouped = this.groupByPart(results);

    // 渲染每个Part的题目
    for (const partId in grouped) {
      const partQuestions = grouped[partId];
      const partSection = this.createPartSection(partId, partQuestions);
      container.appendChild(partSection);
    }
  }

  /**
   * 按Part分组
   * @param {Array} results - 搜索结果
   * @returns {Object} 分组后的结果
   */
  groupByPart(results) {
    const grouped = {};
    results.forEach(question => {
      const partId = question.partId;
      if (!grouped[partId]) {
        grouped[partId] = [];
      }
      grouped[partId].push(question);
    });
    return grouped;
  }

  /**
   * 创建Part区域
   * @param {number} partId - Part ID
   * @param {Array} questions - 题目列表
   * @returns {HTMLElement} Part区域元素
   */
  createPartSection(partId, questions) {
    const section = document.createElement('div');
    section.className = 'part-section';

    const partName = questions[0].partName;

    section.innerHTML = `
      <h3 class="part-title">${partName} (${questions.length}题)</h3>
      <div class="questions-list"></div>
    `;

    const questionsList = section.querySelector('.questions-list');
    questions.forEach(question => {
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
    
    const statusText = this.getStatusText(question.status);
    const statusClass = `status-badge status-${question.status}`;

    card.innerHTML = `
      <div class="question-header">
        <span class="question-id">${question.questionId}</span>
        <span class="${statusClass}">${statusText}</span>
      </div>
      <div class="question-preview">
        ${this.truncateText(question.title, 100)}
      </div>
      <button class="view-detail-btn" data-question-id="${question.questionId}">
        查看详情
      </button>
    `;

    // 绑定点击事件
    const viewBtn = card.querySelector('.view-detail-btn');
    viewBtn.addEventListener('click', () => {
      app.showQuestionDetail(question.questionId);
    });

    return card;
  }

  /**
   * 获取状态文本
   * @param {string} status - 状态
   * @returns {string} 状态文本
   */
  getStatusText(status) {
    const statusMap = {
      'unanswered': '未作答',
      'correct': '答对',
      'wrong': '错题',
      'reviewed': '已复习'
    };
    return statusMap[status] || '未知';
  }

  /**
   * 截断文本
   * @param {string} text - 文本
   * @param {number} maxLength - 最大长度
   * @returns {string} 截断后的文本
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * 清空搜索结果
   */
  clearResults() {
    this.currentResults = [];
  }
}

// 创建全局实例
const searchEngine = new SearchEngine();