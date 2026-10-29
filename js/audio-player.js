/**
 * 音频播放模块
 * 负责音频的播放、上传、链接设置
 */

class AudioPlayer {
  constructor() {
    this.currentAudio = null;
    this.audioCache = new Map();
  }

  /**
   * 渲染音频播放器
   * @param {Object} question - 题目对象
   * @param {HTMLElement} container - 容器元素
   */
  renderAudioPlayer(question, container) {
    const audioSection = document.createElement('div');
    audioSection.className = 'audio-section';

    // 检查音频是否可用
    const hasAudio = this.checkAudioExists(question.audio);

    if (hasAudio) {
      // 有音频：显示播放器
      audioSection.innerHTML = `
        <audio class="audio-player" controls preload="none">
          <source src="${question.audio.type === 'cloud' ? '' : this.getAudioSrc(question.audio)}" type="${question.audio.mimeType || 'audio/mpeg'}">
          您的浏览器不支持音频播放
        </audio>
        <div class="audio-actions">
          <button class="upload-btn" data-question-id="${question.questionId}">
            🔄 更换音频
          </button>
        </div>
      `;
    } else {
      // 无音频：显示上传按钮
      audioSection.innerHTML = `
        <div class="no-audio">
          <p>⚠️ 音频待上传</p>
          <div class="audio-upload-options">
            <button class="upload-btn upload-local" data-question-id="${question.questionId}">
              📁 上传本地文件
            </button>
            <button class="upload-btn upload-link" data-question-id="${question.questionId}">
              🔗 添加外部链接
            </button>
          </div>
        </div>
      `;
    }

    container.appendChild(audioSection);
    if (hasAudio && question.audio.type === 'cloud') {
      const player = audioSection.querySelector('audio');
      audioStorageManager.getPlaybackUrl(question.audio).then(src => { if (player && player.isConnected) { player.src = src; player.load(); } }).catch(err => { console.error('云端音频读取失败', err); Utils.showToast('云端音频读取失败：' + (err.message || ''), 'error'); });
    }

    // 绑定事件
    this.bindAudioEvents(audioSection, question);
  }

  /**
   * 检查音频是否存在
   * @param {Object} audio - 音频信息
   * @returns {boolean} 是否存在
   */
  checkAudioExists(audio) {
    if (!audio || audio.type === 'none') return false;
    
    if (audio.type === 'local') {
      // 本地文件：检查路径是否有值
      return audio.path && audio.path.trim() !== '';
    } else if (audio.type === 'remote') {
      return audio.url && audio.url.trim() !== '';
    } else if (audio.type === 'cloud') {
      return !!audio.storagePath;
    }
    
    return false;
  }

  /**
   * 获取音频源地址
   * @param {Object} audio - 音频信息
   * @returns {string} 音频地址
   */
  getAudioSrc(audio) {
    if (!audio) return '';
    
    if (audio.type === 'local') {
      return audio.path;
    } else if (audio.type === 'remote') {
      return audio.url;
    } else if (audio.type === 'cloud') {
      return '';
    }
    
    return '';
  }

  /**
   * 绑定音频相关事件
   * @param {HTMLElement} container - 容器元素
   * @param {Object} question - 题目对象
   */
  bindAudioEvents(container, question) {
    // 上传本地文件按钮
    const uploadLocalBtn = container.querySelector('.upload-local');
    if (uploadLocalBtn) {
      uploadLocalBtn.addEventListener('click', () => {
        this.uploadLocalAudio(question.questionId);
      });
    }

    // 添加外部链接按钮
    const uploadLinkBtn = container.querySelector('.upload-link');
    if (uploadLinkBtn) {
      uploadLinkBtn.addEventListener('click', () => {
        this.promptForRemoteLink(question.questionId);
      });
    }

    // 更换音频按钮
    const changeBtn = container.querySelector('.upload-btn:not(.upload-local):not(.upload-link)');
    if (changeBtn) {
      changeBtn.addEventListener('click', () => {
        this.showAudioOptions(question.questionId);
      });
    }
  }

  /**
   * 上传本地音频文件
   * @param {string} questionId - 题目ID
   */
  async uploadLocalAudio(questionId) {
    const input = document.createElement('input'); input.type='file'; input.accept='audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/*';
    input.onchange = async e => { const file=e.target.files[0]; if(!file)return; const question=questionManager.getQuestion(questionId); if(!question)return;
      try { const setId=Number(question.setId||document.getElementById('currentSetSelect')?.value||1); const partId=Number(question.partId||1); const old=question.audio;
        Utils.showToast('正在上传音频到云端…','info');
        const audio=await audioStorageManager.upload(file,{setId,partId,questionId,onProgress:p=>{}});
        question.audio=audio; question.updatedAt=new Date().toISOString(); questionManager.saveUserData();
        if(old?.type==='cloud'&&old.storagePath!==audio.storagePath){try{await audioStorageManager.remove(old);}catch(err){console.warn('旧音频清理失败，稍后可手动清理',err);}}
        Utils.showToast('音频已上传并保存到云端，所有登录账号均可使用','success'); this.refreshAudioSection(question);
      } catch(error){console.error('云端上传失败:',error);Utils.showToast('上传失败：'+(error.message||String(error)),'error',8000);}
    }; input.click();
  }

  /**
   * 提示输入外部链接
   * @param {string} questionId - 题目ID
   */
  promptForRemoteLink(questionId) {
    const url = prompt('请输入音频的外部链接（如GitHub、网盘链接）：');
    if (!url || !url.trim()) return;

    const question = questionManager.getQuestion(questionId);
    if (question) {
      question.audio = {
        type: 'remote',
        url: url.trim()
      };
      question.updatedAt = new Date().toISOString();
      questionManager.saveUserData();
      
      Utils.showToast('链接添加成功', 'success');
      
      // 重新渲染音频区域
      this.refreshAudioSection(question);
    }
  }

  /**
   * 显示音频选项（更换音频）
   * @param {string} questionId - 题目ID
   */
  showAudioOptions(questionId) {
    const choice = confirm('选择操作：\n确定 = 上传本地文件\n取消 = 添加外部链接');
    
    if (choice) {
      this.uploadLocalAudio(questionId);
    } else {
      this.promptForRemoteLink(questionId);
    }
  }

  /**
   * 刷新音频区域
   * @param {Object} question - 题目对象
   */
  refreshAudioSection(question) {
    const modal = document.getElementById('questionDetail');
    const audioSection = modal.querySelector('.audio-section');
    
    if (audioSection) {
      audioSection.remove();
    }
    
    const questionTitle = modal.querySelector('.question-title');
    this.renderAudioPlayer(question, questionTitle.parentNode);
  }

  /**
   * 播放音频
   * @param {string} questionId - 题目ID
   */
  play(questionId) {
    const question = questionManager.getQuestion(questionId);
    if (!question || !this.checkAudioExists(question.audio)) {
      Utils.showToast('音频不可用', 'error');
      return;
    }

    const audioSrc = this.getAudioSrc(question.audio);
    
    // 停止当前播放
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    
    // 创建新的音频对象
    this.currentAudio = new Audio(audioSrc);
    this.currentAudio.play().catch(error => {
      console.error('播放失败:', error);
      Utils.showToast('播放失败', 'error');
    });
  }

  /**
   * 暂停音频
   */
  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  /**
   * 停止音频
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }
}

// 创建全局实例
const audioPlayer = new AudioPlayer();