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
        autoSync: false,
        syncInterval: 300
      };
    }
  }

  /**
   * 上传本机题库到 Supabase：读取静态 JSON + localStorage 新增/修改数据，按题号 upsert。
   * 不会删除云端已有题目。
   */
  async uploadLocalToCloud() {
    if (!window.toeicSupabaseReady || !window.toeicSupabase) {
      Utils.showToast('Supabase 尚未连接，请先检查登录和网络配置。', 'error', 7000);
      return;
    }
    if (this.isSyncing) {
      Utils.showToast('正在执行数据传输，请稍候。', 'info');
      return;
    }
    const confirmed = confirm('将把本机 16 套题库（静态题库及浏览器本地新增/修改数据）上传到云端。云端同题号会被本机数据覆盖，但不会删除云端多出的题目。确定继续吗？');
    if (!confirmed) return;

    this.isSyncing = true;
    let total = 0;
    try {
      for (let setId = 1; setId <= 16; setId++) {
        const response = await fetch(`data/sets/set${String(setId).padStart(2, '0')}.json`);
        if (!response.ok) throw new Error(`读取本机第 ${setId} 套失败（HTTP ${response.status}）`);
        const localSet = await response.json();
        const localStore = JSON.parse(localStorage.getItem(`set${setId}_data`) || '{}');
        const byId = new Map();
        (localSet.parts || []).forEach(part => (part.questions || []).forEach(q => {
          byId.set(String(q.questionId), { ...q, partId: Number(part.partId) });
        }));
        Object.values(localStore || {}).forEach(q => {
          if (q && q.questionId) byId.set(String(q.questionId), { ...byId.get(String(q.questionId)), ...q });
        });
        let tombstones={}; try { tombstones=JSON.parse(localStorage.getItem('toeic_v20_deleted_questions')||'{}'); } catch (_) {}
        const rows = Array.from(byId.values()).filter(q => !tombstones[`${setId}:${String(q.questionId)}`]).map(q => ({
          set_id: setId,
          part_id: Number(q.partId || Number(String(q.questionId).split('-')[1]) || 1),
          question_id: String(q.questionId),
          title: q.title || '',
          options: q.options || {},
          correct_answer: q.correctAnswer || q.correct_answer || '',
          audio: (q.audio && q.audio.type === 'local' && String(q.audio.path || '').startsWith('data:audio/'))
            ? { type: 'local', fileName: q.audio.fileName || '', pendingUpload: true }
            : (q.audio || { type: 'none' }),
          note: q.note || '',
          status: q.status || 'unanswered',
          created_at: q.createdAt || q.created_at || new Date().toISOString(),
          updated_at: q.updatedAt || q.updated_at || new Date().toISOString()
        }));
        // 空套题不发请求，避免无意义操作。
        if (rows.length) {
          const { error } = await window.toeicSupabase.from('toeic_questions').upsert(rows, { onConflict: 'set_id,question_id' });
          if (error) throw new Error(`第 ${setId} 套上传失败：${error.message || error.code}`);
          total += rows.length;
        }
      }
      Utils.showToast(`上传完成：已将本机 ${total} 道题上传/更新到 Supabase。`, 'success', 7000);
    } catch (error) {
      console.error('上传本机数据到云端失败:', error);
      Utils.showToast(`上传失败：${error.message || error.code || '请检查网络、表权限和 RLS 策略'}`, 'error', 9000);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 下载 Supabase 全部题目到浏览器 localStorage，作为本机缓存/离线副本。
   * 同时提供 JSON 备份下载；不会删除云端数据。
   */
  async downloadCloudToLocal() {
    if (!window.toeicSupabaseReady || !window.toeicSupabase) {
      Utils.showToast('Supabase 尚未连接，请先检查登录和网络配置。', 'error', 7000);
      return;
    }
    if (this.isSyncing) {
      Utils.showToast('正在执行数据传输，请稍候。', 'info');
      return;
    }
    const confirmed = confirm('将从云端下载全部题目，并覆盖浏览器本机缓存中的对应套题数据；不会修改云端。建议确认后继续。');
    if (!confirmed) return;

    this.isSyncing = true;
    try {
      let allRows = [];
      // Supabase 默认分页上限通常为 1000，使用范围分页确保题目较多时也能全部下载。
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await window.toeicSupabase
          .from('toeic_questions').select('*').order('set_id').order('question_id')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allRows = allRows.concat(data || []);
        if (!data || data.length < pageSize) break;
      }

      const bySet = new Map();
      for (let setId = 1; setId <= 16; setId++) bySet.set(setId, {});
      allRows.forEach(row => {
        const setId = Number(row.set_id);
        if (!bySet.has(setId)) return;
        bySet.get(setId)[String(row.question_id)] = {
          questionId: String(row.question_id),
          partId: Number(row.part_id),
          title: row.title || '', options: row.options || {},
          correctAnswer: row.correct_answer || '', audio: row.audio || { type: 'none' },
          note: row.note || '', status: row.status || 'unanswered',
          createdAt: row.created_at, updatedAt: row.updated_at
        };
      });
      bySet.forEach((questions, setId) => localStorage.setItem(`set${setId}_data`, JSON.stringify(questions)));

      const backup = {
        exportedAt: new Date().toISOString(),
        source: 'Supabase toeic_questions',
        totalQuestions: allRows.length,
        sets: Object.fromEntries(Array.from(bySet.entries()).map(([setId, questions]) => [String(setId), Object.values(questions)]))
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `toeic-cloud-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);

      Utils.showToast(`下载完成：云端 ${allRows.length} 道题已保存到本机缓存，并下载 JSON 备份文件。`, 'success', 8000);
      if (window.app && typeof window.app.refreshCurrentView === 'function') window.app.refreshCurrentView();
    } catch (error) {
      console.error('下载云端数据失败:', error);
      Utils.showToast(`下载失败：${error.message || error.code || '请检查网络、表权限和 RLS 策略'}`, 'error', 9000);
    } finally {
      this.isSyncing = false;
    }
  }

  async buildLocalRowsForSet(setId) {
    const response = await fetch(`data/sets/set${String(setId).padStart(2, '0')}.json`);
    if (!response.ok) throw new Error(`读取本机第 ${setId} 套失败（HTTP ${response.status}）`);
    const localSet = await response.json();
    const localStore = JSON.parse(localStorage.getItem(`set${setId}_data`) || '{}');
    const byId = new Map();
    (localSet.parts || []).forEach(part => (part.questions || []).forEach(q => {
      byId.set(String(q.questionId), { ...q, partId: Number(part.partId) });
    }));
    Object.values(localStore || {}).forEach(q => {
      if (q && q.questionId) {
        const previous = byId.get(String(q.questionId)) || {};
        byId.set(String(q.questionId), { ...previous, ...q, partId: Number(q.partId || previous.partId || 1) });
      }
    });
    let tombstones={}; try { tombstones=JSON.parse(localStorage.getItem('toeic_v20_deleted_questions')||'{}'); } catch (_) {}
    return Array.from(byId.values()).filter(q => !tombstones[`${Number(setId)}:${String(q.questionId)}`]).map(q => {
      const audio = q.audio || { type: 'none' };
      const safeAudio = audio.type === 'local' && String(audio.path || '').startsWith('data:audio/')
        ? { type: 'local', fileName: audio.fileName || '', pendingUpload: true }
        : audio;
      return {
        set_id: Number(setId),
        part_id: Number(q.partId || Number(String(q.questionId).split('-')[1]) || 1),
        question_id: String(q.questionId),
        title: q.title || '',
        options: q.options || {},
        correct_answer: q.correctAnswer || q.correct_answer || '',
        audio: safeAudio,
        note: q.note || '',
        status: q.status || 'unanswered',
        created_at: q.createdAt || q.created_at || new Date().toISOString(),
        updated_at: q.updatedAt || q.updated_at || new Date().toISOString()
      };
    });
  }

  /**
   * 同步到远程数据库
   * @param {number} setId - 套题ID（可选，不传则同步所有）
   */
  async syncToRemote(setId = null) {
    // V19.1：统一使用 Supabase，不再回退到旧版自定义 REST API。
    if (!window.toeicSupabaseReady || !window.toeicSupabase) {
      Utils.showToast(`Supabase 未连接：${window.toeicSupabaseError || '请检查 js/supabase-client.js 配置及网络'}`, 'error', 8000);
      return false;
    }
    if (this.isSyncing) {
      Utils.showToast('正在同步中，请稍候', 'info');
      return false;
    }

    this.isSyncing = true;
    try {
      const { data: sessionData, error: sessionError } = await window.toeicSupabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session) throw new Error('请先登录，再同步题库数据。');

      const setIds = setId ? [Number(setId)] : Array.from({ length: 16 }, (_, i) => i + 1);
      let syncedCount = 0;
      for (const currentSetId of setIds) {
        if (!Number.isInteger(currentSetId) || currentSetId < 1 || currentSetId > 16) continue;
        // 从静态题库 + 当前浏览器本地增改记录构建上传内容，确保本地编辑不会被云端读取结果覆盖。
        const rows = await this.buildLocalRowsForSet(currentSetId);

        if (rows.length) {
          const { error } = await window.toeicSupabase.from('toeic_questions')
            .upsert(rows, { onConflict: 'set_id,question_id' });
          if (error) throw new Error(`第 ${currentSetId} 套同步失败：${error.message || error.code}`);
          syncedCount += rows.length;
          this.updateSyncTime(currentSetId, new Date().toISOString());
        }
      }
      Utils.showToast(`Supabase 同步成功：已同步 ${syncedCount} 道题。云端音频文件及 IndexedDB 缓存保持独立。`, 'success', 7000);
      return true;
    } catch (error) {
      console.error('Supabase 同步失败:', error);
      Utils.showToast(`同步失败：${error.message || error.code || '请检查表权限及 RLS 策略'}`, 'error', 9000);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 同步单个套题
   * @param {number} setId - 套题ID
   */
  async syncSet(setId) {
    const ok = await this.syncToRemote(Number(setId));
    if (!ok) throw new Error(`第 ${setId} 套同步失败`);
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
    // Supabase 是唯一同步提供方；不再要求旧版 apiUrl。
    if (!window.toeicSupabaseReady || !window.toeicSupabase) {
      Utils.showToast(`Supabase 尚未初始化：${window.toeicSupabaseError || '请检查 js/supabase-client.js'}`, 'error', 8000);
      return false;
    }
    return true;
  }
}

// 创建全局实例
const syncManager = new SyncManager();