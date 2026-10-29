/**
 * 笔记管理模块
 * 负责笔记的显示、隐藏、保存
 */

class NoteManager {
  constructor() {
    this.expandedNotes = new Set();
  }

  /**
   * 渲染笔记区域
   * @param {Object} question - 题目对象
   * @param {HTMLElement} container - 容器元素
   */
  renderNoteSection(question, container) {
    const noteSection = document.createElement('div');
    noteSection.className = 'note-section';

    const isExpanded = this.expandedNotes.has(question.questionId);

    noteSection.innerHTML = `
      <button class="note-toggle" data-question-id="${question.questionId}">
        ${isExpanded ? '📝 收起笔记' : '📝 展开笔记'}
      </button>
      <div class="note-content ${isExpanded ? 'show' : ''}" data-question-id="${question.questionId}">
        <textarea 
          class="note-textarea" 
          placeholder="在这里记录你的笔记..."
          data-question-id="${question.questionId}"
        >${question.note || ''}</textarea>
        <button class="note-save-btn" data-question-id="${question.questionId}">
          💾 保存笔记
        </button>
      </div>
    `;

    container.appendChild(noteSection);

    // 绑定事件
    this.bindNoteEvents(noteSection, question);
  }

  /**
   * 绑定笔记相关事件
   * @param {HTMLElement} container - 容器元素
   * @param {Object} question - 题目对象
   */
  bindNoteEvents(container, question) {
    // 切换笔记显示
    const toggleBtn = container.querySelector('.note-toggle');
    toggleBtn.addEventListener('click', () => {
      this.toggleNote(question.questionId);
    });

    // 保存笔记
    const saveBtn = container.querySelector('.note-save-btn');
    saveBtn.addEventListener('click', () => {
      this.saveNote(question.questionId);
    });

    // 自动保存（防抖）
    const textarea = container.querySelector('.note-textarea');
    const debouncedSave = Utils.debounce(() => {
      this.saveNote(question.questionId);
    }, 1000);
    
    textarea.addEventListener('input', debouncedSave);
  }

  /**
   * 切换笔记显示状态
   * @param {string} questionId - 题目ID
   */
  toggleNote(questionId) {
    const noteContent = document.querySelector(`.note-content[data-question-id="${questionId}"]`);
    const toggleBtn = document.querySelector(`.note-toggle[data-question-id="${questionId}"]`);

    if (!noteContent || !toggleBtn) return;

    if (this.expandedNotes.has(questionId)) {
      // 收起
      this.expandedNotes.delete(questionId);
      noteContent.classList.remove('show');
      toggleBtn.textContent = '📝 展开笔记';
    } else {
      // 展开
      this.expandedNotes.add(questionId);
      noteContent.classList.add('show');
      toggleBtn.textContent = '📝 收起笔记';
    }
  }

  /**
   * 保存笔记
   * @param {string} questionId - 题目ID
   */
  saveNote(questionId) {
    const textarea = document.querySelector(`.note-textarea[data-question-id="${questionId}"]`);
    if (!textarea) return;

    const noteContent = textarea.value.trim();
    const question = questionManager.getQuestion(questionId);
    
    if (question) {
      question.note = noteContent;
      question.updatedAt = new Date().toISOString();
      questionManager.saveUserData();
      
      Utils.showToast('笔记已保存', 'success', 1500);
    }
  }

  /**
   * 获取笔记内容
   * @param {string} questionId - 题目ID
   * @returns {string} 笔记内容
   */
  getNote(questionId) {
    const question = questionManager.getQuestion(questionId);
    return question ? question.note || '' : '';
  }

  /**
   * 更新笔记内容
   * @param {string} questionId - 题目ID
   * @param {string} content - 笔记内容
   */
  updateNote(questionId, content) {
    const question = questionManager.getQuestion(questionId);
    if (question) {
      question.note = content;
      question.updatedAt = new Date().toISOString();
      questionManager.saveUserData();
    }
  }
}

// 创建全局实例
const noteManager = new NoteManager();