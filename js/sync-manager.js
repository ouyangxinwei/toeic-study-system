/**
 * 同步管理模块
 * 负责将错题数据同步到远程数据库
 */

class SyncManager {
  constructor() {
    this.config = null;
    this.syncQueue = [];
    this.isSyncing = false;
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
      const config = await response.json();
      this.config = config.sync;
    } catch (error) {
      console.error('加载同步配置失败:', error);
      // 使用默认配置
      this.config = {
        enabled: false,
        apiUrl: '',
        autoSync: false,
        syncInterval: 300
      };
    }
  }

  /**
   * 同步到远程数据库
   * @param {number} setId - 套题ID（可选，不传则同步所有）
   */
  async syncToRemote(setId = null) {
    if (!this.config.enabled) {
      Utils.showToast('同步功能未启用', 'info');
      return;
    }

    if (this.isSyncing) {
      Utils.showToast('正在同步中，请稍候', 'info');
      return;
    }

    this.isSyncing = true;

    try {
      if (setId) {
        // 同步指定套题
        await this.syncSet(setId);
      } else {
        // 同步所有套题
        for (let i = 1; i <= 15; i++) {
          await this.syncSet(i);
          // 延迟一下，避免请求过快
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      Utils.showToast('同步成功', 'success');
    } catch (error) {
      console.error('同步失败:', error);
      Utils.showToast('同步失败', 'error');
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 同步单个套题
   * @param {number} setId - 套题ID
   */
  async syncSet(setId) {
    try {
      // 加载套题数据
      const setData = await questionManager.loadSet(setId);
      if (!setData) {
        throw new Error(`加载套题${setId}失败`);
      }

      // 构建同步数据
      const syncData = this.buildSyncData(setData);

      // 发送到远程API
      const response = await fetch(this.config.apiUrl + '/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(syncData)
      });

      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }

      const result = await response.json();
      
      // 更新本地同步时间
      this.updateSyncTime(setId, result.serverTime);

      console.log(`套题${setId}同步成功:`, result);
    } catch (error) {
      console.error(`同步套题${setId}失败:`, error);
      throw error;
    }
  }

  /**
   * 构建同步数据
   * @param {Object} setData - 套题数据
   * @returns {Object} 同步数据
   */
  buildSyncData(setData) {
    const questions = [];

    setData.parts.forEach(part => {
      part.questions.forEach(question => {
        questions.push({
          questionId: question.questionId,
          partId: part.partId,
          title: question.title,
          options: question.options,
          correctAnswer: question.correctAnswer,
          audio: question.audio,
          note: question.note || '',
          status: question.status,
          createdAt: question.createdAt,
          updatedAt: question.updatedAt
        });
      });
    });

    return {
      setId: setData.setId,
      setName: setData.setName,
      syncTime: new Date().toISOString(),
      totalQuestions: questions.length,
      questions: questions
    };
  }

  /**
   * 从远程数据库加载数据
   * @param {number} setId - 套题ID
   */
  async loadFromRemote(setId) {
    if (!this.config.enabled) {
      Utils.showToast('同步功能未启用', 'info');
      return;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/sync?setId=${setId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }

      const remoteData = await response.json();

      // 合并远程数据到本地
      await this.mergeRemoteData(setId, remoteData);

      Utils.showToast('数据加载成功', 'success');
    } catch (error) {
      console.error('加载远程数据失败:', error);
      Utils.showToast('加载远程数据失败', 'error');
    }
  }

  /**
   * 合并远程数据到本地
   * @param {number} setId - 套题ID
   * @param {Object} remoteData - 远程数据
   */
  async mergeRemoteData(setId, remoteData) {
    try {
      // 加载本地数据
      const localData = await questionManager.loadSet(setId);
      if (!localData) return;

      // 合并策略：以更新时间为准，取最新的
      remoteData.questions.forEach(remoteQuestion => {
        const localQuestion = questionManager.getQuestion(remoteQuestion.questionId);
        
        if (localQuestion) {
          const localTime = new Date(localQuestion.updatedAt).getTime();
          const remoteTime = new Date(remoteQuestion.updatedAt).getTime();

          // 如果远程数据更新，则更新本地
          if (remoteTime > localTime) {
            localQuestion.note = remoteQuestion.note;
            localQuestion.status = remoteQuestion.status;
            localQuestion.audio = remoteQuestion.audio;
            localQuestion.updatedAt = remoteQuestion.updatedAt;
          }
        }
      });

      // 保存合并后的数据
      questionManager.saveUserData();
    } catch (error) {
      console.error('合并数据失败:', error);
      throw error;
    }
  }

  /**
   * 更新同步时间
   * @param {number} setId - 套题ID
   * @param {string} serverTime - 服务器时间
   */
  updateSyncTime(setId, serverTime) {
    const syncInfo = JSON.parse(localStorage.getItem('sync_info') || '{}');
    syncInfo[`set${setId}`] = {
      lastSyncTime: serverTime || new Date().toISOString(),
      syncStatus: 'success'
    };
    localStorage.setItem('sync_info', JSON.stringify(syncInfo));
  }

  /**
   * 获取同步状态
   * @param {number} setId - 套题ID
   * @returns {Object} 同步状态
   */
  getSyncStatus(setId) {
    const syncInfo = JSON.parse(localStorage.getItem('sync_info') || '{}');
    return syncInfo[`set${setId}`] || {
      lastSyncTime: null,
      syncStatus: 'never'
    };
  }

  /**
   * 添加到同步队列
   * @param {number} setId - 套题ID
   */
  addToSyncQueue(setId) {
    if (!this.syncQueue.includes(setId)) {
      this.syncQueue.push(setId);
    }

    // 如果启用了自动同步，延迟同步
    if (this.config.autoSync) {
      this.scheduleAutoSync();
    }
  }

  /**
   * 安排自动同步
   */
  scheduleAutoSync() {
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
    }

    this.autoSyncTimer = setTimeout(() => {
      this.processSyncQueue();
    }, this.config.syncInterval * 1000);
  }

  /**
   * 处理同步队列
   */
  async processSyncQueue() {
    if (this.syncQueue.length === 0) return;

    const setsToSync = [...this.syncQueue];
    this.syncQueue = [];

    for (const setId of setsToSync) {
      try {
        await this.syncSet(setId);
      } catch (error) {
        console.error(`自动同步套题${setId}失败:`, error);
        // 失败的话重新加入队列
        this.syncQueue.push(setId);
      }
    }
  }

  /**
   * 检查同步配置
   * @returns {boolean} 是否配置正确
   */
  checkConfig() {
    if (!this.config.enabled) {
      Utils.showToast('同步功能未启用，请在config.json中配置', 'info');
      return false;
    }

    if (!this.config.apiUrl) {
      Utils.showToast('未配置API地址', 'error');
      return false;
    }

    return true;
  }
}

// 创建全局实例
const syncManager = new SyncManager();