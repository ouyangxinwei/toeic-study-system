/**
 * 主应用模块
 * 整合所有功能模块，处理页面交互
 */

class App {
  constructor() {
    this.currentSetId = null;
    this.isSearchMode = false;
    this.selectedQuestionIds = new Set();
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
          if (!Number.isInteger(setId) || setId < 1 || setId > 16) return;
          // 先立即记录本地选择，再保存云端偏好；即使云端暂时不可用，本机也会记住。
          localStorage.setItem('toeic_current_set_id', String(setId));
          this.currentSetId = null;
          this.isSearchMode = false;
          picker.disabled = true;
          try {
            await questionManager.renderSetsList(setId);
            await this.savePreferredSetId(setId);
          } finally {
            picker.disabled = false;
          }
        });
      }
      await questionManager.renderSetsList(savedSetId);
      // 登录后自动恢复离线删除和云端音频清理任务。
      try { const pending = await questionManager.processPendingDeletes(); const cleanup = await audioStorageManager.retryPendingCleanup(); if (pending.done || cleanup.length) console.info('V20 删除恢复任务', pending, cleanup); } catch (e) { console.warn('V20 删除恢复任务暂不可执行', e); }
      window.addEventListener('online', async () => { try { const pending = await questionManager.processPendingDeletes(); await audioStorageManager.retryPendingCleanup(); if (pending.done && this.currentSetId) await this.openSet(this.currentSetId); } catch (e) { console.warn('网络恢复后的删除任务重试失败', e); } });

      Utils.showToast('应用加载成功', 'success', 2000);
    } catch (error) {
      console.error('应用初始化失败:', error);
      Utils.showToast('应用初始化失败', 'error');
    }
  }

  async loadPreferredSetId() {
    const localValue = Number(localStorage.getItem('toeic_current_set_id') || 1);
    const fallback = Number.isInteger(localValue) && localValue >= 1 && localValue <= 16 ? localValue : 1;
    if (!window.toeicSupabaseReady || !window.toeicSupabase) return fallback;
    try {
      const { data: authData } = await window.toeicSupabase.auth.getUser();
      const userId = authData && authData.user && authData.user.id;
      if (!userId) return fallback;
      const { data, error } = await window.toeicSupabase.from('toeic_user_preferences')
        .select('selected_set_id').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      const setId = Number(data && data.selected_set_id);
      if (Number.isInteger(setId) && setId >= 1 && setId <= 16) {
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

    document.getElementById('cloudAudioManagerBtn')?.addEventListener('click', () => this.showCloudAudioManager());
    document.getElementById('bulkDeleteQuestionsBtn')?.addEventListener('click', () => this.bulkDeleteSelectedQuestions());

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
      questionManager.currentSet = setData;
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
    this.selectedQuestionIds.clear();
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
    const bulkBar=document.createElement('div'); bulkBar.className='bulk-delete-toolbar';
    const hint=document.createElement('span'); hint.textContent='勾选需要删除的题目：';
    const bulkBtn=document.createElement('button'); bulkBtn.type='button'; bulkBtn.className='secondary-btn'; bulkBtn.textContent='删除选中题目（0）'; bulkBtn.addEventListener('click',()=>this.bulkDeleteSelectedQuestions());
    bulkBar.append(hint,bulkBtn); setsList.appendChild(bulkBar);

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
        <label class="bulk-select-label"><input type="checkbox" class="bulk-select-question" data-question-id="${question.questionId}"> 选择</label>
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
    const bulkCheckbox=card.querySelector('.bulk-select-question');
    bulkCheckbox.addEventListener('change',()=>{ if(bulkCheckbox.checked)this.selectedQuestionIds.add(String(question.questionId)); else this.selectedQuestionIds.delete(String(question.questionId)); const btn=document.querySelector('.bulk-delete-toolbar button'); if(btn)btn.textContent=`删除选中题目（${this.selectedQuestionIds.size}）`; });
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
      // 用户进入删除流程时先停止该题正在播放的 HTMLAudioElement。
      audioPlayer.stopForQuestion(question.questionId, this.currentSetId);
      if (question.audio?.audioId) this.stopCloudAudioPreview(question.audio.audioId);
      let preview = null;
      try {
        if (question.audio?.type === 'cloud' && question.audio.audioId) preview = await audioStorageManager.getDeletePreview(question.audio.audioId);
      } catch (e) {
        if (navigator.onLine !== false && !/network|fetch|offline|failed to fetch/i.test(e.message || '')) { Utils.showToast(`读取音频引用关系失败，暂不能安全删除：${e.message || e}`, 'error', 8000); return; }
        preview = null;
      }
      const refCount = preview?.references?.length || 0;
      const audioText = question.audio?.type === 'cloud' && !preview
        ? '云端音频引用关系目前离线不可读取；题目会先进入本地待删除队列，恢复网络后由服务器检查共享引用，再决定是否删除文件。'
        : question.audio?.type === 'cloud'
        ? (refCount > 1 ? `云端音频：${preview.audio.file_name}；目前被 ${refCount} 道题目共用，删除本题只解除本题关联，其他题目继续使用。` : `云端音频：${preview?.audio?.file_name || question.audio.fileName || '已关联音频'}；若无其他引用，将同时删除服务器文件。`)
        : (question.audio?.type === 'local' ? '本题为本地旧音频；删除题目时清除本地关联，不会删除原始音频文件以外的其他文件。' : '本题没有云端音频文件。');
      const confirmed = window.confirm(`确定删除第 ${this.currentSetId} 套题目 ${question.questionId} 吗？\n\n${audioText}\n\n正在播放的音频已停止。删除后将清理本题缓存和关联，操作无法撤销。`);
      if (!confirmed) return;
      try {
        const result = await questionManager.deleteQuestion(this.currentSetId, question.questionId);
        let message = `题目 ${question.questionId} 已删除`;
        if (result.pending_server) message += '；服务器删除已加入待同步队列，联网后自动处理';
        else if (result.delete_audio) message += result.cleanup?.completed ? '；云端音频及索引已删除' : '；云端音频待重试清理';
        else if (result.audio_id) message += `；共享音频保留（仍有 ${result.references_remaining || 0} 道题目引用）`;
        Utils.showToast(message, result.cleanup && !result.cleanup.completed ? 'warning' : 'success', 6000);
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
            <div class="form-group"><label>套题编号 *</label><select id="editSetId" required>${Array.from({length:16},(_,i)=>`<option value="${i+1}">第${i+1}套</option>`).join('')}</select></div>
            <div class="form-group"><label>Part *</label><select id="editPartId" required>${Array.from({length:7},(_,i)=>`<option value="${i+1}">Part ${i+1}</option>`).join('')}</select></div>
            <div class="form-group"><label>题号 *</label><input id="editQuestionId" required></div>
            <div class="form-group"><label>题目标题/题干 *</label><textarea id="editTitle" rows="4" required></textarea></div>
            <div class="form-group"><label>选项 A *</label><input id="editOptionA" required></div>
            <div class="form-group"><label>选项 B *</label><input id="editOptionB" required></div>
            <div class="form-group"><label>选项 C *</label><input id="editOptionC" required></div>
            <div class="form-group"><label>选项 D *</label><input id="editOptionD" required></div>
            <div class="form-group"><label>正确答案 *</label><select id="editCorrectAnswer" required><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div>
            <section class="edit-audio-panel">
              <h3>题目音频</h3>
              <p id="editCurrentAudioInfo" class="edit-audio-status">正在读取当前音频…</p>
              <div class="form-group"><label for="editAudioFile">上传新音频（上传后替换当前题目音频）</label><input id="editAudioFile" type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm,audio/*"></div>
              <div class="form-group"><label for="editSharedAudioSelect">或者关联已有共享云端音频</label><select id="editSharedAudioSelect"><option value="">保持当前音频</option></select></div>
              <div class="form-group"><label for="editAudioUrl">或者使用外部音频链接</label><input id="editAudioUrl" placeholder="https://… 或本地 DataURL"></div>
              <div class="edit-audio-actions"><button type="button" class="secondary-btn" id="editPreviewAudioBtn">试听当前音频</button><button type="button" class="danger-btn" id="editRemoveAudioBtn">移除本题音频</button></div>
              <p class="edit-audio-hint">每道题关联一段音频；同一云端音频可以被多道题共享。替换只影响当前题目，其他题目不会被修改。</p>
              <p id="editAudioUploadStatus" class="edit-audio-status" aria-live="polite"></p>
            </section>
            <div class="form-group"><label>笔记（可选）</label><textarea id="editNote" rows="3"></textarea></div>
            <div class="form-group"><label>状态</label><select id="editStatus"><option value="unanswered">未作答</option><option value="wrong">错题</option><option value="correct">答对</option><option value="reviewed">已复习</option><option value="mastered">已掌握</option></select></div>
            <div class="form-actions"><button type="submit" class="submit-btn">保存修改</button><button type="button" class="cancel-btn" id="cancelEditQuestion">取消</button></div>
          </form>
        </div>`;
      document.body.appendChild(modal);
      const close = () => { this.stopEditAudioPreview(); modal.style.display = 'none'; };
      modal.querySelector('#closeEditQuestionModal').addEventListener('click', close);
      modal.querySelector('#cancelEditQuestion').addEventListener('click', close);
      modal.addEventListener('click', e => { if (e.target === modal) close(); });
      modal.querySelector('#editAudioFile').addEventListener('change', e => {
        const file=e.target.files?.[0];
        modal.querySelector('#editAudioUploadStatus').textContent=file ? `已选择：${file.name}（${(file.size/1024/1024).toFixed(2)} MB），保存题目时上传。` : '';
        if(file) { modal.querySelector('#editSharedAudioSelect').value=''; modal.dataset.removeAudio='false'; }
      });
      modal.querySelector('#editSharedAudioSelect').addEventListener('change', e => {
        if(e.target.value) { modal.querySelector('#editAudioFile').value=''; modal.querySelector('#editAudioUrl').value=''; modal.dataset.removeAudio='false'; }
      });
      modal.querySelector('#editAudioUrl').addEventListener('input', () => { if(modal.querySelector('#editAudioUrl').value.trim()) modal.dataset.removeAudio='false'; });
      modal.querySelector('#editRemoveAudioBtn').addEventListener('click', () => {
        modal.dataset.removeAudio='true'; modal.querySelector('#editAudioFile').value=''; modal.querySelector('#editSharedAudioSelect').value=''; modal.querySelector('#editAudioUrl').value='';
        modal.querySelector('#editCurrentAudioInfo').textContent='保存时将解除本题音频关联；如果没有其他题目引用，云端文件会进入清理队列。';
        modal.querySelector('#editAudioUploadStatus').textContent='已选择移除本题音频（尚未保存）。';
      });
      modal.querySelector('#editPreviewAudioBtn').addEventListener('click', async () => {
        try {
          const a=modal._originalAudio;
          if(!a || a.type==='none') throw new Error('当前题目没有音频');
          this.stopEditAudioPreview();
          const src=await audioStorageManager.getPlaybackUrl(a);
          const player=new Audio(src); modal._editPreview={player,src}; await player.play();
          player.addEventListener('ended',()=>this.stopEditAudioPreview(),{once:true});
        } catch(err) { Utils.showToast(`试听失败：${err.message||err}`,'error'); }
      });
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
        const originalAudio = modal._originalAudio || {type:'none'};
        let nextAudio = originalAudio;
        let newlyUploadedAudio = null;
        const selectedSharedId = modal.querySelector('#editSharedAudioSelect').value;
        try {
          const file=modal.querySelector('#editAudioFile').files?.[0];
          if(file) {
            if(file.size > 20*1024*1024) throw new Error('音频文件不能超过20 MB');
            if(!file.type.startsWith('audio/')) throw new Error('请选择有效的音频文件');
            modal.querySelector('#editAudioUploadStatus').textContent='正在上传新音频…';
            newlyUploadedAudio=await audioStorageManager.upload(file,{setId,partId,questionId,onProgress:p=>{modal.querySelector('#editAudioUploadStatus').textContent=`正在上传新音频… ${p}%`;}});
            nextAudio=newlyUploadedAudio;
          } else if(selectedSharedId) {
            const sb=await audioStorageManager.client();
            const {data,error}=await sb.from('toeic_audio_files').select('id,file_name,file_size,mime_type,storage_path,status').eq('id',selectedSharedId).eq('status','active').maybeSingle();
            if(error) throw error; if(!data) throw new Error('所选共享音频已不可用，请重新选择');
            nextAudio={type:'cloud',audioId:data.id,storagePath:data.storage_path,fileName:data.file_name,fileSize:data.file_size,mimeType:data.mime_type};
          } else if(modal.dataset.removeAudio==='true') {
            nextAudio={type:'none'};
          } else if(audioUrl) {
            nextAudio=/^https?:\/\//i.test(audioUrl)?{type:'remote',url:audioUrl}:{type:'local',path:audioUrl};
          }
          const updated = {
            questionId,
            title: document.getElementById('editTitle').value.trim(),
            options: { A: document.getElementById('editOptionA').value.trim(), B: document.getElementById('editOptionB').value.trim(), C: document.getElementById('editOptionC').value.trim(), D: document.getElementById('editOptionD').value.trim() },
            correctAnswer: document.getElementById('editCorrectAnswer').value,
            audio: nextAudio,
            note: document.getElementById('editNote').value.trim(),
            status: document.getElementById('editStatus').value,
            partId, updatedAt: new Date().toISOString()
          };
          if(originalAudio?.type==='cloud' && originalAudio.audioId && originalAudio.audioId!==nextAudio?.audioId) audioPlayer.stopForAudioId(originalAudio.audioId);
          const savedQuestion = await questionManager.editQuestion(oldSetId, oldQuestionId, setId, updated);
          this.stopEditAudioPreview();
          modal.style.display = 'none';
          this.currentSetId = setId;
          const picker = document.getElementById('currentSetSelect'); if (picker) picker.value = String(setId);
          localStorage.setItem('toeic_current_set_id', String(setId));
          await this.savePreferredSetId(setId);
          await questionManager.renderSetsList(setId);
          Utils.showToast(savedQuestion?.audioCleanupPending ? '题目和新音频关联已保存；旧云端音频清理失败，系统会自动重试。' : '题目修改成功，音频关联已保存。', savedQuestion?.audioCleanupPending ? 'warning' : 'success', 6000);
        } catch (error) {
          if(newlyUploadedAudio?.audioId) { try { const queued=await audioStorageManager.queueUnreferencedAudio(newlyUploadedAudio.audioId); if(queued?.job_id) await audioStorageManager.runCleanupJob(queued.job_id); } catch(cleanupError) { console.warn('保存失败的新音频已保留待清理',cleanupError); } }
          console.error('修改题目失败:', error);
          Utils.showToast(`修改失败：${error.message || '未知错误'}`, 'error', 9000);
        } finally { submit.disabled = false; submit.textContent = originalText; }
      });
    }
    const audio = question.audio || {type:'none'};
    modal.dataset.oldSetId = String(this.currentSetId || questionManager.currentSet?.setId || 1);
    modal.dataset.oldQuestionId = String(question.questionId);
    modal.dataset.removeAudio='false';
    modal._originalAudio={...audio};
    document.getElementById('editSetId').value = modal.dataset.oldSetId;
    document.getElementById('editPartId').value = String(question.partId || 1);
    document.getElementById('editQuestionId').value = question.questionId || '';
    document.getElementById('editTitle').value = question.title || '';
    document.getElementById('editOptionA').value = question.options?.A || '';
    document.getElementById('editOptionB').value = question.options?.B || '';
    document.getElementById('editOptionC').value = question.options?.C || '';
    document.getElementById('editOptionD').value = question.options?.D || '';
    document.getElementById('editCorrectAnswer').value = question.correctAnswer || 'A';
    document.getElementById('editAudioUrl').value = audio.type==='remote' ? (audio.url||'') : (audio.type==='local' ? (audio.path||'') : '');
    document.getElementById('editAudioFile').value='';
    document.getElementById('editSharedAudioSelect').value='';
    document.getElementById('editNote').value = question.note || '';
    document.getElementById('editStatus').value = question.status || 'unanswered';
    modal.querySelector('#editCurrentAudioInfo').textContent=audio.type==='cloud'?`当前云端音频：${audio.fileName||audio.storagePath||'已关联'}（共享音频）`:audio.type==='remote'?`当前外部音频：${audio.url||''}`:audio.type==='local'?`当前本地音频：${audio.fileName||'本地音频'}`:'当前没有音频';
    modal.querySelector('#editAudioUploadStatus').textContent='';
    this.loadSharedAudioChoices(modal, audio.audioId).catch(err=>console.warn('加载共享音频列表失败',err));
    modal.style.display = 'block';
  }

  stopEditAudioPreview() {
    const modal=document.getElementById('editQuestionModal'); const preview=modal?._editPreview;
    if(preview?.player){preview.player.pause();try{preview.player.currentTime=0;}catch(_){}preview.player.src='';}
    if(preview?.src?.startsWith('blob:')) audioStorageManager.revokeUrl(preview.src);
    if(modal) modal._editPreview=null;
  }

  async loadSharedAudioChoices(modal, currentAudioId='') {
    const select=modal.querySelector('#editSharedAudioSelect');
    select.innerHTML='<option value="">保持当前音频</option>';
    if(!window.toeicSupabaseReady || !window.toeicSupabase) return;
    const sb=await audioStorageManager.client();
    const {data,error}=await sb.from('toeic_audio_files').select('id,file_name,file_size,status').eq('status','active').order('created_at',{ascending:false}).limit(200);
    if(error) throw error;
    for(const item of (data||[])) {
      const option=document.createElement('option'); option.value=item.id;
      option.textContent=`${item.file_name} · ${(Number(item.file_size||0)/1024/1024).toFixed(2)} MB${item.id===currentAudioId?'（当前音频）':''}`;
      select.appendChild(option);
    }
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

    // 选项列表：详情默认不标记正确选项，避免提前看到答案
    const optionsList = document.createElement('div');
    optionsList.className = 'options-list';
    const optionElements = [];

    for (const key in question.options) {
      const option = document.createElement('div');
      option.className = 'option-item';
      option.dataset.optionKey = key;
      option.textContent = `${key}. ${question.options[key]}`;
      optionsList.appendChild(option);
      optionElements.push(option);
    }
    detailContent.appendChild(optionsList);

    // 答案默认隐藏，用户主动点击后才显示
    const answerToggle = document.createElement('button');
    answerToggle.type = 'button';
    answerToggle.className = 'answer-toggle-btn';
    answerToggle.textContent = '显示答案';
    answerToggle.setAttribute('aria-pressed', 'false');

    const correctAnswer = document.createElement('div');
    correctAnswer.className = 'correct-answer';
    correctAnswer.textContent = `正确答案: ${question.correctAnswer || '未设置'}`;
    correctAnswer.hidden = true;

    answerToggle.addEventListener('click', () => {
      const shouldShow = correctAnswer.hidden;
      correctAnswer.hidden = !shouldShow;
      answerToggle.textContent = shouldShow ? '隐藏答案' : '显示答案';
      answerToggle.setAttribute('aria-pressed', String(shouldShow));
      optionElements.forEach(option => {
        option.classList.toggle('correct', shouldShow && option.dataset.optionKey === question.correctAnswer);
      });
    });
    detailContent.appendChild(answerToggle);
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
  async bulkDeleteSelectedQuestions() {
    const ids=Array.from(this.selectedQuestionIds);
    if(!this.currentSetId || !ids.length){Utils.showToast('请先勾选需要删除的题目','info');return;}
    if(!confirm(`确定批量删除第 ${this.currentSetId} 套的 ${ids.length} 道题目吗？\n\n系统会逐题停止播放、检查共享音频引用，并且只清理不再被任何题目使用的云端音频。网络中断时会建立待同步删除任务。`))return;
    const succeeded=[]; const failed=[];
    for(const id of ids){
      try{const q=questionManager.getQuestion(id);audioPlayer.stopForQuestion(id,this.currentSetId);if(q?.audio?.audioId)this.stopCloudAudioPreview(q.audio.audioId);await questionManager.deleteQuestion(this.currentSetId,id);succeeded.push(id);}
      catch(e){failed.push({id,error:e.message||String(e)});}
    }
    this.selectedQuestionIds.clear();
    await this.openSet(this.currentSetId);
    const detail=failed.length?`；失败 ${failed.length} 道：${failed.map(x=>`${x.id}（${x.error}）`).join('；')}`:'';
    Utils.showToast(`批量删除完成：成功 ${succeeded.length} 道${detail}`,failed.length?'warning':'success',9000);
  }

  stopCloudAudioPreview(audioId) {
    const player=this.cloudAudioPreviewPlayer;
    if(player && (!audioId || String(player.dataset.audioId)===String(audioId))) { player.pause(); try { player.currentTime=0; } catch(_) {} const src=player.src; if(src&&src.startsWith('blob:'))audioStorageManager.revokeUrl(src); player.src=''; player.load(); this.cloudAudioPreviewPlayer=null; }
  }

  async showCloudAudioManager() {
    try {
      if (!window.toeicSupabaseReady || !window.toeicSupabase) throw new Error('请先登录并连接 Supabase');
      const sb = window.toeicSupabase;
      const { data, error } = await sb.from('toeic_audio_files').select('id,file_name,file_size,mime_type,storage_path,status,set_id,part_id,created_at').order('created_at', { ascending: false });
      if (error) throw error;
      let modal = document.getElementById('cloudAudioManagerModal');
      if (!modal) { modal = document.createElement('div'); modal.id = 'cloudAudioManagerModal'; modal.className = 'modal'; document.body.appendChild(modal); }
      modal.innerHTML = `<div class="modal-content modal-large"><span class="close" id="closeCloudAudioManager">&times;</span><h2>云端音频管理</h2><p>所有登录账号共享。主动删除音频会影响所有引用它的题目。</p><div class="audio-manager-filters"><input id="audioManagerSearch" placeholder="搜索音频文件名"><select id="audioManagerSet"><option value="">全部套题</option>${Array.from({length:16},(_,i)=>`<option value="${i+1}">第${i+1}套</option>`).join('')}</select><select id="audioManagerPart"><option value="">全部 Part</option>${Array.from({length:7},(_,i)=>`<option value="${i+1}">Part ${i+1}</option>`).join('')}</select></div><div id="cloudAudioList"></div><button type="button" id="retryAudioCleanupBtn" class="secondary-btn">重试待清理音频</button></div>`;
      const list = modal.querySelector('#cloudAudioList');
      if (!data?.length) list.textContent = '目前没有云端音频记录。';
      for (const audio of (data || [])) {
        const row = document.createElement('div'); row.className = 'audio-manager-row'; row.dataset.name = (audio.file_name || '').toLowerCase(); row.dataset.set = String(audio.set_id || ''); row.dataset.part = String(audio.part_id || '');
        const info = document.createElement('div'); info.textContent = `${audio.file_name} · ${(Number(audio.file_size || 0) / 1024 / 1024).toFixed(2)} MB · 第${audio.set_id}套 Part ${audio.part_id} · ${audio.status || 'active'} · ${audio.storage_path}`;
        const actions = document.createElement('div'); actions.className = 'audio-manager-actions';
        const play = document.createElement('button'); play.type='button'; play.textContent='播放';
        play.addEventListener('click', async () => { try { const src=await audioStorageManager.getPlaybackUrl({type:'cloud',audioId:audio.id,storagePath:audio.storage_path}); const player=new Audio(src); player.dataset.audioId=audio.id; this.cloudAudioPreviewPlayer=player; player.addEventListener('ended',()=>audioStorageManager.revokeUrl(src),{once:true}); await player.play(); } catch(e) { Utils.showToast(`播放失败：${e.message||e}`,'error',6000); } });
        const download = document.createElement('button'); download.type='button'; download.textContent='下载';
        download.addEventListener('click', async () => { try { const blob=await audioStorageManager.getBlob(audio.storage_path,{audioId:audio.id}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=audio.file_name||'toeic-audio'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); } catch(e) { Utils.showToast(`下载失败：${e.message||e}`,'error',6000); } });
        const refsBtn = document.createElement('button'); refsBtn.type='button'; refsBtn.textContent='查看引用';
        refsBtn.addEventListener('click', async () => { try { const p=await audioStorageManager.getDeletePreview(audio.id); const refs=p.references.length?p.references.map(r=>`第${r.set_id}套 / ${r.question_id}`).join('、'):'无题目引用'; alert(`引用数量：${p.references.length}\n${refs}`); } catch(e) { Utils.showToast(`读取引用失败：${e.message||e}`,'error'); } });
        const del = document.createElement('button'); del.type='button'; del.className='delete-question-btn'; del.textContent='删除共享音频';
        del.addEventListener('click', async () => { try { this.stopCloudAudioPreview(audio.id); audioPlayer.stopForAudioId(audio.id); const preview=await audioStorageManager.getDeletePreview(audio.id); const refText=preview.references.length?preview.references.map(r=>`第${r.set_id}套 / ${r.question_id}`).join('、'):'无题目引用'; if(!confirm(`确定删除共享音频「${audio.file_name}」吗？\n\n引用数量：${preview.references.length}\n引用题目：${refText}\n\n所有引用题目将被标记为音频缺失，所有登录账号都会受到影响。`))return; const result=await audioStorageManager.deleteSharedAudio(audio.id); Utils.showToast(result.cleanup?.completed?'共享音频已从云端删除':'共享音频删除失败，已加入待重试队列',result.cleanup?.completed?'success':'warning',7000); modal.remove(); await this.showCloudAudioManager(); if(this.currentSetId)await this.openSet(this.currentSetId); } catch(e) { Utils.showToast(`删除共享音频失败：${e.message||e}`,'error',8000); } });
        actions.append(play,download,refsBtn,del); row.append(info,actions); list.appendChild(row);
      }
      const applyFilters=()=>{const term=modal.querySelector('#audioManagerSearch').value.trim().toLowerCase();const set=modal.querySelector('#audioManagerSet').value;const part=modal.querySelector('#audioManagerPart').value;list.querySelectorAll('.audio-manager-row').forEach(row=>{row.hidden=!(row.dataset.name.includes(term)&&(!set||row.dataset.set===set)&&(!part||row.dataset.part===part));});};
      modal.querySelector('#audioManagerSearch').addEventListener('input',applyFilters); modal.querySelector('#audioManagerSet').addEventListener('change',applyFilters); modal.querySelector('#audioManagerPart').addEventListener('change',applyFilters);
      modal.querySelector('#closeCloudAudioManager').addEventListener('click', () => modal.remove());
      modal.querySelector('#retryAudioCleanupBtn').addEventListener('click', async () => { try { const results=await audioStorageManager.retryPendingCleanup(); const failed=results.filter(x=>!x.completed).length; Utils.showToast(`清理任务处理完成：${results.length-failed} 成功，${failed} 待重试`,failed?'warning':'success',7000); } catch(e) { Utils.showToast(`重试失败：${e.message||e}`,'error',8000); } });
      modal.style.display='block';
    } catch(error) { Utils.showToast(`打开云端音频管理失败：${error.message||error}`,'error',8000); }
  }

  async handleSync() {
    if (!syncManager.checkConfig()) {
      return;
    }

    if (this.currentSetId) {
      // 同步当前套题
      await syncManager.syncToRemote(this.currentSetId);
    } else {
      // 同步所有套题
      const confirmSync = confirm('确定要将本机当前题库同步到 Supabase 云端吗？将同步 1–16 套题，不会删除云端多出的题目。');
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