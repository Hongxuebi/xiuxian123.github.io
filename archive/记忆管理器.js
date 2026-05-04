// [Phase D 标注] 记忆管理器 - MemoryManager 主类（已废弃，记忆操作统一走 AI记忆管理器.js）
// 保留原因：未来可能启用分层记忆架构，当前不影响运行

// 记忆管理器.js - 最终版（按时间倒序返回记忆，最新优先）
class MemoryManager {
  constructor(agentId) {
    this.agentId = agentId;
    this.storage = window.storage;
    this.memoryIndex = new MemoryIndex(agentId);
    this.取消更新标志 = false;
  }

  async initialize() {
    if (!this.storage) {
      console.warn('存储适配器未初始化');
      return;
    }
    try {
      await this._createMemoryDirectories();
      await this.memoryIndex.rebuild();
      console.log('记忆库初始化完成, agentId:', this.agentId);
    } catch (error) {
      console.error('记忆库初始化失败:', error);
    }
  }

  async _createMemoryDirectories() {
    const basePath = `agents/${this.agentId}/memories`;
    for (const level of Object.values(MEMORY_LEVELS)) {
      const path = `${basePath}/${level}`;
      try {
        if (this.storage && typeof this.storage.mkdir === 'function') await this.storage.mkdir(path);
      } catch (error) {
        console.warn(`创建目录 ${path} 失败:`, error);
      }
    }
  }

  async addMemory(content, type = MEMORY_CATEGORIES.OTHER, tags = [], level = MEMORY_LEVELS.SHORT_TERM) {
    const id = `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    const entry = new MemoryEntry(id, content, type, timestamp, tags);
    const fileName = `${type}.md`;
    const filePath = `agents/${this.agentId}/memories/${level}/${fileName}`;
    
    let existingContent = '';
    const 存在 = await this.storage.文件存在(filePath);
    if (存在) {
      existingContent = await this.storage.读文件(filePath);
    }
    const newEntry = this._formatMemoryEntry(entry);
    const newContent = existingContent ? existingContent + '\n\n' + newEntry : newEntry;
    
    await this.storage.写文件(filePath, newContent);
    await this.memoryIndex.update(filePath);
    console.log(`记忆已添加: ${filePath}`, content.substring(0, 50));
    return id;
  }

  _formatMemoryEntry(entry) {
    const date = entry.timestamp.slice(0, 10);
    const tags = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
    return `## ${date}${tags}\n${entry.content}`;
  }

  async getMemory(id) {
    const result = await this.memoryIndex.findById(id);
    if (!result) return null;
    const content = await this.storage.读文件(result.filePath);
    return this._parseMemoryEntry(content, result.entryIndex, result.filePath);
  }

  _parseMemoryEntry(content, entryIndex, filePath) {
    const entries = content.split(/\n\n/).filter(e => e.trim());
    if (entryIndex >= entries.length) return null;
    const entryContent = entries[entryIndex];
    const match = entryContent.match(/^## (\d{4}-\d{2}-\d{2})(?: \[(.*?)\])?/);
    const date = match ? match[1] : new Date().toISOString().slice(0, 10);
    const tags = match && match[2] ? match[2].split(', ').map(t => t.trim()) : [];
    const contentText = entryContent.replace(/^##.*?\n/, '').trim();
    const type = filePath.split('/').pop().replace('.md', '');
    return new MemoryEntry(`memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, contentText, type, date + 'T00:00:00.000Z', tags);
  }

  async updateMemory(id, content, type = null, tags = null) {
    const result = await this.memoryIndex.findById(id);
    if (!result) return false;
    let fileContent = await this.storage.读文件(result.filePath);
    const entries = fileContent.split(/\n\n/).filter(e => e.trim());
    if (result.entryIndex >= entries.length) return false;
    const oldEntry = entries[result.entryIndex];
    const timestamp = new Date().toISOString();
    const newType = type || oldEntry.match(/^##.*?/)[0].replace('## ', '');
    const newTags = tags || (oldEntry.match(/\[(.*?)\]/) ? oldEntry.match(/\[(.*?)\]/)[1].split(', ').map(t => t.trim()) : []);
    const newEntry = this._formatMemoryEntry(new MemoryEntry(id, content, newType, timestamp, newTags));
    entries[result.entryIndex] = newEntry;
    await this.storage.写文件(result.filePath, entries.join('\n\n'));
    await this.memoryIndex.update(result.filePath);
    return true;
  }

  async deleteMemory(id) {
    const result = await this.memoryIndex.findById(id);
    if (!result) return false;
    let fileContent = await this.storage.读文件(result.filePath);
    const entries = fileContent.split(/\n\n/).filter(e => e.trim());
    if (result.entryIndex >= entries.length) return false;
    entries.splice(result.entryIndex, 1);
    if (entries.length > 0) await this.storage.写文件(result.filePath, entries.join('\n\n'));
    else await this.storage.删除文件(result.filePath);
    await this.memoryIndex.update(result.filePath);
    return true;
  }

  async addMemoriesBatch(memories, level = MEMORY_LEVELS.SHORT_TERM) {
    const ids = [];
    for (const memory of memories) {
      const id = await this.addMemory(memory.content, memory.type, memory.tags, level);
      ids.push(id);
    }
    return ids;
  }

  // 核心查询：返回结果按时间倒序（最新优先）
  async queryMemories(query = {}, level = null) {
    console.log('[queryMemories] 开始查询, agentId:', this.agentId, '关键词:', query.keywords);
    const results = [];
    const 所有记录 = await this._直接获取所有文件记录();
    for (const 记录 of 所有记录) {
      if (记录.类型 !== 'file') continue;
      const 路径 = 记录.路径;
      if (!路径.includes(`agents/${this.agentId}/memories/`)) continue;
      if (路径.endsWith('.tmp')) continue;
      if (level && !路径.includes(`/${level}/`)) continue;
      
      const content = 记录.内容;
      const entries = content.split(/\n\n/).filter(e => e.trim());
      for (let i = 0; i < entries.length; i++) {
        const entry = this._parseMemoryEntry(content, i, 路径);
        if (this._matchesQuery(entry, query)) results.push(entry);
      }
    }
    // 按时间倒序排序（最新的在前）
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (results.length === 0 && query.keywords) {
      console.log('[queryMemories] 关键词无匹配，降级返回最近记忆');
      return await this._获取最近记忆(3, level);
    }
    console.log(`[queryMemories] 查询到 ${results.length} 条记忆，已按时间倒序`);
    return results;
  }

  async _获取最近记忆(数量 = 3, level = null) {
    const 所有记忆 = [];
    const 所有记录 = await this._直接获取所有文件记录();
    for (const 记录 of 所有记录) {
      if (记录.类型 !== 'file') continue;
      const 路径 = 记录.路径;
      if (!路径.includes(`agents/${this.agentId}/memories/`)) continue;
      if (路径.endsWith('.tmp')) continue;
      if (level && !路径.includes(`/${level}/`)) continue;
      const content = 记录.内容;
      const entries = content.split(/\n\n/).filter(e => e.trim());
      for (let i = 0; i < entries.length; i++) {
        const entry = this._parseMemoryEntry(content, i, 路径);
        if (entry) 所有记忆.push(entry);
      }
    }
    所有记忆.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return 所有记忆.slice(0, 数量);
  }

  async _直接获取所有文件记录() {
    return new Promise((成功, 失败) => {
      const 请求 = indexedDB.open('PrivateAIAssistant', 2);
      请求.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(['files'], 'readonly');
        const store = tx.objectStore('files');
        const getAll = store.getAll();
        getAll.onsuccess = () => 成功(getAll.result);
        getAll.onerror = () => 失败(getAll.error);
      };
      请求.onerror = () => 失败(请求.error);
    });
  }

  _matchesQuery(entry, query) {
    if (!entry) return false;
    if (query.type && entry.type !== query.type) return false;
    if (query.tags && query.tags.length > 0 && !query.tags.some(tag => entry.tags.includes(tag))) return false;
    if (query.startDate && new Date(entry.timestamp) < query.startDate) return false;
    if (query.endDate && new Date(entry.timestamp) > query.endDate) return false;
    if (query.keywords) {
      const 关键词列表 = query.keywords.split(/\s+/).filter(kw => kw.length > 0);
      const 搜索文本 = (entry.content + ' ' + entry.tags.join(' ')).toLowerCase();
      // 宽松匹配：至少有一个关键词匹配即可（OR逻辑）
      // 特殊照顾：包含"叫什么/名字/姓名/昵称" → 主动匹配"姓名"字段
      const 命中数 = 关键词列表.filter(kw => 搜索文本.includes(kw.toLowerCase())).length;
      if (命中数 > 0) return true;
      // 兜底：用户问"叫什么/名字/昵称"类问题时，即使关键词列表没直接包含"姓名"，
      // 只要记忆条目以"姓名："开头就匹配（用于处理"我叫什么名字"这类问句）
      const 问句模式 = /名字|姓名|昵称|称呼|叫啥|叫[啥什]/;
      if (问句模式.test(query.keywords) && entry.content.startsWith('姓名：')) return true;
      return false;
    }
    return true;
  }

  async 分批次更新记忆(完整内容, 智能体ID = null, 进度回调 = null) {
    const 目标智能体ID = 智能体ID || this.agentId;
    this.取消更新标志 = false;
    
    let 记忆块列表 = this._拆分记忆块(完整内容);
    if (记忆块列表.length === 0) {
      console.warn('没有可更新的记忆内容');
      return { 成功批次: 0, 总条目: 0, 失败批次: 0 };
    }
    
    const 批次列表 = this._分批文本(记忆块列表, 6000);
    const 总批次 = 批次列表.length;
    let 已处理摘要 = '';
    let 成功批次 = 0;
    let 失败批次 = 0;
    let 总添加条目数 = 0;
    
    for (let i = 0; i < 批次列表.length; i++) {
      if (this.取消更新标志) break;
      const 当前批次内容 = 批次列表[i];
      if (进度回调) 进度回调(i + 1, 总批次, `正在处理第 ${i+1}/${总批次} 批...`);
      
      try {
        const 批次摘要 = await this._生成批次摘要(当前批次内容, 已处理摘要, i + 1, 总批次);
        const 记忆对象列表 = this._解析摘要为记忆对象(批次摘要);
        let 本批添加数 = 0;
        
        for (const 记忆对象 of 记忆对象列表) {
          const 相似记忆列表 = await this._检测相似记忆(记忆对象);
          let 最终内容 = 记忆对象.content;
          
          if (相似记忆列表.length > 0) {
            // 自动合并到第一条相似记忆
            const 目标记忆 = 相似记忆列表[0];
            const 合并内容 = 目标记忆.content + '\n\n[合并补充]\n' + 记忆对象.content;
            await this.updateMemory(目标记忆.id, 合并内容, 记忆对象.type, 记忆对象.tags);
            最终内容 = null;
            console.log(`自动合并冲突: ${记忆对象.content.substring(0, 30)} -> ${目标记忆.id}`);
          }
          
          if (最终内容) {
            await this.addMemory(最终内容, 记忆对象.type, 记忆对象.tags);
            本批添加数++;
          }
        }
        
        总添加条目数 += 本批添加数;
        已处理摘要 = this._合并摘要(已处理摘要, 批次摘要);
        成功批次++;
      } catch (错误) {
        console.error(`批次 ${i+1} 处理失败:`, 错误);
        失败批次++;
        if (进度回调) 进度回调(i + 1, 总批次, `批次 ${i+1} 失败: ${错误.message}`);
      }
    }
    await this.memoryIndex.rebuild();
    return { 成功批次, 总条目: 总添加条目数, 失败批次 };
  }

  取消更新() { this.取消更新标志 = true; }

  _拆分记忆块(文本) {
    let 块 = 文本.split(/\n\s*\n/);
    if (块.length === 1) 块 = 文本.split(/(?<=[。！？])\s*\n/);
    return 块.filter(b => b.trim().length > 0);
  }

  _分批文本(块列表, 最大字符数) {
    const 批次 = [];
    let 当前批次 = [], 当前长度 = 0;
    for (const 块 of 块列表) {
      const 块长度 = 块.length;
      if (当前长度 + 块长度 > 最大字符数 && 当前批次.length > 0) {
        批次.push(当前批次);
        当前批次 = [];
        当前长度 = 0;
      }
      当前批次.push(块);
      当前长度 += 块长度;
    }
    if (当前批次.length > 0) 批次.push(当前批次);
    return 批次;
  }

  async _生成批次摘要(批次内容数组, 已有摘要, 当前批次号, 总批次) {
    const 批次文本 = 批次内容数组.join('\n\n');
    const 系统提示 = `你是一个记忆提取助手。请从以下内容中提取出所有独立的记忆事实。每条记忆应包含：content（具体事实）、type（从：个人信息、知识、偏好、工作、健康、生活、其他中选择）、tags（标签数组，最多3个）。输出必须为JSON数组，不要输出其他任何解释文字。`;
    let 用户提示 = `已有前几批处理的摘要：${已有摘要 || '无'}\n\n当前批次内容：\n${批次文本}`;
    if (当前批次号 === 1 && !已有摘要) 用户提示 = `请从以下内容中提取记忆条目：\n${批次文本}`;
    else 用户提示 = `这是第 ${当前批次号}/${总批次} 批内容。请结合已有摘要提取新记忆条目：\n${批次文本}`;
    if (!window.调用API) throw new Error('API调用模块未加载');
    const 消息列表 = [{ role: 'system', content: 系统提示 }, { role: 'user', content: 用户提示 }];
    const AI回复 = await window.调用API(消息列表);
    const 回复文本 = typeof AI回复 === 'string' ? AI回复 : (AI回复.content || '');
    console.log('AI摘要原始回复:', 回复文本);
    return 回复文本;
  }

  _解析摘要为记忆对象(AI回复文本) {
    try {
      const jsonMatch = AI回复文本.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const 数组 = JSON.parse(jsonMatch[0]);
        if (Array.isArray(数组) && 数组.length) {
          return 数组.map(item => ({
            content: item.content || item.内容 || '未提供内容',
            type: item.type || item.分类 || '其他',
            tags: item.tags || item.标签 || []
          }));
        }
      }
    } catch (e) { console.warn('解析JSON失败', e); }
    // 降级：直接存储原始文本
    let 纯文本 = AI回复文本.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    if (!纯文本) 纯文本 = '（无内容）';
    console.log('降级存储原始文本:', 纯文本.substring(0, 100));
    return [{ content: 纯文本, type: '其他', tags: [] }];
  }

  _合并摘要(旧摘要, 新摘要) {
    let 合并 = (旧摘要 ? 旧摘要 + '\n---\n' : '') + 新摘要;
    if (合并.length > 2000) 合并 = 合并.slice(-2000);
    return 合并;
  }

  async _检测相似记忆(记忆对象) {
    const 同类型记忆 = await this.queryMemories({ type: 记忆对象.type });
    const 相似列表 = [];
    for (const 记忆 of 同类型记忆) {
      if (this._calculateSimilarity(记忆对象.content, 记忆.content) > 0.7) 相似列表.push(记忆);
    }
    return 相似列表;
  }

  _calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    return intersection.size / new Set([...words1, ...words2]).size;
  }
}

window.MemoryManager = MemoryManager;