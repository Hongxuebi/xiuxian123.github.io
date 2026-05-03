// [Phase D 标注] 记忆索引 - MemoryIndex 类（架构预留，当前未使用）
// 保留原因：未来可能启用分层记忆架构，当前不影响运行

// 记忆索引.js - MemoryIndex 类（修复 listFiles 返回值处理）
class MemoryIndex {
  constructor(agentId) {
    this.agentId = agentId;
    this.storage = window.storage;
    this.l1Index = new Map();
    this.l2SummaryIndex = [];
    this.l3SemanticIndex = [];
  }

  async rebuild() {
    this.l1Index.clear();
    this.l2SummaryIndex = [];
    this.l3SemanticIndex = [];
    if (!this.storage) return;
    try {
      await this._rebuildLevelIndex(MEMORY_LEVELS.SHORT_TERM, this._buildL1Index);
      await this._rebuildLevelIndex(MEMORY_LEVELS.MID_TERM, this._buildL2Index);
      await this._rebuildLevelIndex(MEMORY_LEVELS.LONG_TERM, this._buildL3Index);
      console.log('记忆索引重建完成');
    } catch (error) {
      console.error('记忆索引重建失败:', error);
    }
  }

  async _rebuildLevelIndex(level, buildFn) {
    if (!this.storage || typeof this.storage.listFiles !== 'function') return;
    try {
      const files = await this.storage.listFiles(`agents/${this.agentId}/memories/${level}`);
      // 修复：统一处理 files 属性
      const fileList = files?.files || (Array.isArray(files) ? files : []);
      for (const file of fileList) {
        const filePath = `agents/${this.agentId}/memories/${level}/${file}`;
        try {
          const content = await this.storage.读文件(filePath);
          await buildFn.call(this, filePath, content);
        } catch (error) {
          console.warn(`处理文件 ${filePath} 失败:`, error);
        }
      }
    } catch (error) {
      console.warn(`列出目录 ${level} 失败:`, error);
    }
  }

  async _buildL1Index(filePath, content) {
    const entries = content.split(/\n\n/).filter(e => e.trim());
    for (let i = 0; i < entries.length; i++) {
      const keywords = this._extractKeywords(entries[i]);
      for (const keyword of keywords) {
        if (!this.l1Index.has(keyword)) this.l1Index.set(keyword, []);
        this.l1Index.get(keyword).push({ filePath, entryIndex: i });
      }
    }
  }

  async _buildL2Index(filePath, content) {
    const keywords = this._extractKeywords(content);
    const summary = content.substring(0, 100) + '...';
    for (const keyword of keywords) {
      this.l2SummaryIndex.push({ keyword, filePath, summary });
    }
  }

  async _buildL3Index(filePath, content) {
    const keywords = this._extractKeywords(content);
    for (const keyword of keywords) {
      this.l3SemanticIndex.push({ keyword, filePath, semanticHash: this._hash(content) });
    }
  }

  async update(filePath) {
    const parts = filePath.split('/');
    const level = parts[parts.length - 2];
    const content = await this.storage.读文件(filePath);
    if (level === MEMORY_LEVELS.SHORT_TERM) await this._buildL1Index(filePath, content);
    else if (level === MEMORY_LEVELS.MID_TERM) await this._buildL2Index(filePath, content);
    else if (level === MEMORY_LEVELS.LONG_TERM) await this._buildL3Index(filePath, content);
  }

  async findById(id) {
    const levels = Object.values(MEMORY_LEVELS);
    for (const level of levels) {
      const result = await this.storage.listFiles(`agents/${this.agentId}/memories/${level}`);
      const fileList = result?.files || (Array.isArray(result) ? result : []);
      for (const file of fileList) {
        const filePath = `agents/${this.agentId}/memories/${level}/${file}`;
        const content = await this.storage.读文件(filePath);
        const entries = content.split(/\n\n/).filter(e => e.trim());
        for (let i = 0; i < entries.length; i++) {
          if (entries[i].includes(id)) return { filePath, entryIndex: i };
        }
      }
    }
    return null;
  }

  _extractKeywords(text) {
    const stopWords = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);
    const words = text.toLowerCase().match(/[\u4e00-\u9fa5a-zA-Z0-9]+/g) || [];
    return words.filter(word => word.length > 1 && !stopWords.has(word));
  }

  _hash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

window.MemoryIndex = MemoryIndex;