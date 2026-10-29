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
      Utils.showToast('加载配置失败', 'error');
    }
  }

  /**
   * 加载套题数据
   * @param {number} setId - 套题ID
   * @returns {Promise<Object>} 套题数据
   */
  async loadSet(setId) {
    try {
      const response = await fetch(`data/sets/set${String(setId).padStart(2, '0')}.json`);
      this.currentSet = await response.json();
      
      // 从localStorage加载用户数据
      const userData = localStorage.getItem(`set${setId}_data`);
      if (userData) {
        const parsed = JSON.parse(userData);
        this.mergeUserData(parsed);
      }
      
      return this.currentSet;
    } catch (error) {
      console.error('加载套题失败:', error);
      Utils.showToast('加载套题失败', 'error');
      return null;
    }
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
          question.note = userQuestion.note || '';
          question.status = userQuestion.status || 'unanswered';
          question.audio = userQuestion.audio || question.audio;
          question.updatedAt = userQuestion.updatedAt || question.updatedAt;
        }
      });
    });
  }

  /**
   * 保存用户数据到localStorage
   */
  saveUserData() {
    if (!this.currentSet) return;

    const userData = {};
    this.currentSet.parts.forEach(part => {
      part.questions.forEach(question => {
        userData[question.questionId] = {
          note: question.note,
          status: question.status,
          audio: question.audio,
          updatedAt: question.updatedAt
        };
      });
    });

    localStorage.setItem(`set${this.currentSet.setId}_data`, JSON.stringify(userData));
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