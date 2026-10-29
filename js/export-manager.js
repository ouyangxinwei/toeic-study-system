/**
 * 导出管理模块
 * 负责将错题数据导出为CSV和JSON格式
 */

class ExportManager {
  constructor() {
    this.exportFormats = ['csv', 'json'];
  }

  /**
   * 导出为CSV格式
   * @param {number} setId - 套题ID
   */
  async exportCSV(setId) {
    try {
      const setData = await questionManager.loadSet(setId);
      if (!setData) {
        Utils.showToast('加载套题数据失败', 'error');
        return;
      }

      // 构建CSV内容
      const csvContent = this.buildCSVContent(setData);
      
      // 生成文件名
      const filename = `set${String(setId).padStart(2, '0')}_wrong_questions_${this.getDateString()}.csv`;
      
      // 下载文件
      Utils.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
      
      Utils.showToast('CSV导出成功', 'success');
    } catch (error) {
      console.error('导出CSV失败:', error);
      Utils.showToast('导出CSV失败', 'error');
    }
  }

  /**
   * 导出为JSON格式
   * @param {number} setId - 套题ID
   */
  async exportJSON(setId) {
    try {
      const setData = await questionManager.loadSet(setId);
      if (!setData) {
        Utils.showToast('加载套题数据失败', 'error');
        return;
      }

      // 构建JSON内容
      const jsonContent = this.buildJSONContent(setData);
      
      // 生成文件名
      const filename = `set${String(setId).padStart(2, '0')}_wrong_questions_${this.getDateString()}.json`;
      
      // 下载文件
      Utils.downloadFile(jsonContent, filename, 'application/json');
      
      Utils.showToast('JSON导出成功', 'success');
    } catch (error) {
      console.error('导出JSON失败:', error);
      Utils.showToast('导出JSON失败', 'error');
    }
  }

  /**
   * 构建CSV内容
   * @param {Object} setData - 套题数据
   * @returns {string} CSV内容
   */
  buildCSVContent(setData) {
    // CSV表头
    const headers = [
      '题号',
      '所属套数',
      '所属部分',
      '题目标题',
      '选项A',
      '选项B',
      '选项C',
      '选项D',
      '正确答案',
      '音频链接',
      '笔记',
      '状态',
      '更新时间'
    ];

    // 构建数据行
    const rows = [];
    
    setData.parts.forEach(part => {
      part.questions.forEach(question => {
        // 只导出有内容的题目（错题或有笔记的题）
        if (question.status !== 'unanswered' || question.note) {
          const row = [
            question.questionId,
            setData.setName,
            part.partName,
            this.escapeCSVField(question.title),
            this.escapeCSVField(question.options.A || ''),
            this.escapeCSVField(question.options.B || ''),
            this.escapeCSVField(question.options.C || ''),
            this.escapeCSVField(question.options.D || ''),
            question.correctAnswer,
            this.getAudioLink(question.audio),
            this.escapeCSVField(question.note || ''),
            this.getStatusText(question.status),
            question.updatedAt || ''
          ];
          rows.push(row);
        }
      });
    });

    // 组合CSV内容
    const csvRows = [headers, ...rows];
    const csvContent = csvRows
      .map(row => row.join(','))
      .join('\n');

    // 添加BOM以支持中文
    return '\uFEFF' + csvContent;
  }

  /**
   * 构建JSON内容
   * @param {Object} setData - 套题数据
   * @returns {string} JSON内容
   */
  buildJSONContent(setData) {
    const exportData = {
      setId: setData.setId,
      setName: setData.setName,
      exportTime: new Date().toISOString(),
      totalQuestions: 0,
      questions: []
    };

    setData.parts.forEach(part => {
      part.questions.forEach(question => {
        // 只导出有内容的题目
        if (question.status !== 'unanswered' || question.note) {
          exportData.totalQuestions++;
          exportData.questions.push({
            questionId: question.questionId,
            partId: part.partId,
            partName: part.partName,
            title: question.title,
            options: question.options,
            correctAnswer: question.correctAnswer,
            audio: question.audio,
            note: question.note || '',
            status: question.status,
            createdAt: question.createdAt,
            updatedAt: question.updatedAt
          });
        }
      });
    });

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 转义CSV字段（处理逗号、引号、换行）
   * @param {string} field - 字段内容
   * @returns {string} 转义后的字段
   */
  escapeCSVField(field) {
    if (!field) return '';
    
    // 如果包含逗号、引号或换行，需要用引号包裹
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      // 转义引号
      field = field.replace(/"/g, '""');
      // 用引号包裹
      return `"${field}"`;
    }
    
    return field;
  }

  /**
   * 获取音频链接
   * @param {Object} audio - 音频信息
   * @returns {string} 音频链接
   */
  getAudioLink(audio) {
    if (!audio || audio.type === 'none') return '';
    
    if (audio.type === 'local') {
      return audio.path || '';
    } else if (audio.type === 'remote') {
      return audio.url || '';
    }
    
    return '';
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
   * 获取日期字符串（用于文件名）
   * @returns {string} 日期字符串
   */
  getDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}`;
  }

  /**
   * 导出所有套题
   * @param {string} format - 导出格式（csv或json）
   */
  async exportAllSets(format) {
    try {
      for (let i = 1; i <= 15; i++) {
        if (format === 'csv') {
          await this.exportCSV(i);
        } else if (format === 'json') {
          await this.exportJSON(i);
        }
        
        // 延迟一下，避免浏览器阻止多次下载
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      Utils.showToast('所有套题导出完成', 'success');
    } catch (error) {
      console.error('批量导出失败:', error);
      Utils.showToast('批量导出失败', 'error');
    }
  }
}

// 创建全局实例
const exportManager = new ExportManager();