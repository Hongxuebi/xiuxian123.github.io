// 备忘录管理器.js - 备忘录 IndexedDB 持久化 + AI 工具接口
// 职责：备忘录 CRUD + IndexedDB 持久化 + 供 AI 工具调用
//
// 存储格式 v2 （2026-05-03 存储拆分）：
//   备忘录库/_index.json  → 摘要索引（无内容字段，~50KB/5k条）
//   备忘录库/{id}.json    → 单条完整备忘录
//   this.memos            → 全量内存缓存（启动时从摘要+单文件重建）
//
// 写入策略：先写 {id}.json，后更新内存，最后写摘要索引
// 异常时回滚：文件写入失败→删除已写文件，索引写入失败→内存不变

class MemoManager {
  constructor() {
    this.storage = null; // 由 init() 注入
    this.basePath = '备忘录库';
    this.indexFile = '备忘录库/_index.json'; // 摘要索引文件
    this.memos = []; // 全量内存缓存
    this.nextId = 1;
    this._格式版本 = 'v2'; // 当前存储格式版本
  }

  /**
   * 初始化：加载索引，构建内存缓存
   */
  async init(storage) {
    this.storage = storage;
    await this._loadIndex();
    console.log(`[备忘录管理器] 初始化完成，共 ${this.memos.length} 条备忘录`);
  }

  // ========== 单条文件管理 ==========

  _memoFilePath(id) {
    return `${this.basePath}/${id}.json`;
  }

  async _writeMemoFile(备忘录) {
    // 写单条完整备忘录（含内容字段）
    const 路径 = this._memoFilePath(备忘录.id);
    // 写入时只写关键字段，不存无用中间状态
    const 写入 = {
      id: 备忘录.id,
      标题: 备忘录.标题,
      内容: 备忘录.内容,
      日期: 备忘录.日期,
      文件夹: 备忘录.文件夹,
      标签: 备忘录.标签,
      收藏: 备忘录.收藏,
      已删除: 备忘录.已删除 || false,
      删除时间: 备忘录.删除时间 || null,
      已置顶: 备忘录.已置顶 || false,
      置顶时间: 备忘录.置顶时间 || null,
      创建时间: 备忘录.创建时间,
      更新时间: 备忘录.更新时间,
      hasTodo: 备忘录.hasTodo || false,
      hasCompletedTodo: 备忘录.hasCompletedTodo || false,
      todoCount: 备忘录.todoCount || 0,
      completedTodoCount: 备忘录.completedTodoCount || 0,
      todoDeadlines: 备忘录.todoDeadlines || [],
      hasImg: 备忘录.hasImg || false,
      imgCount: 备忘录.imgCount || 0,
      hasAttachment: 备忘录.hasAttachment || false,
      attachmentCount: 备忘录.attachmentCount || 0
    };
    await this.storage.写文件(路径, JSON.stringify(写入, null, 2));
  }

  async _readMemoFile(id) {
    const 路径 = this._memoFilePath(id);
    const 原始 = await this.storage.读文件(路径);
    if (!原始) return null;
    return JSON.parse(原始);
  }

  async _deleteMemoFile(id) {
    const 路径 = this._memoFilePath(id);
    if (await this.storage.文件存在(路径)) {
      await this.storage.删除文件(路径);
    }
  }

  async _memoFileExists(id) {
    return this.storage.文件存在(this._memoFilePath(id));
  }

  // ========== 摘要索引管理 ==========

  /**
   * 从单条备忘录提取摘要字段（不含内容）
   */
  _提取摘要(备忘录) {
    // 只保留渲染列表和搜索索引需要的字段
    return {
      id: 备忘录.id,
      标题: 备忘录.标题,
      日期: 备忘录.日期,
      文件夹: 备忘录.文件夹,
      标签: 备忘录.标签,
      收藏: 备忘录.收藏,
      已删除: 备忘录.已删除 || false,
      删除时间: 备忘录.删除时间 || null,
      已置顶: 备忘录.已置顶 || false,
      置顶时间: 备忘录.置顶时间 || null,
      创建时间: 备忘录.创建时间,
      更新时间: 备忘录.更新时间,
      hasTodo: 备忘录.hasTodo || false,
      hasCompletedTodo: 备忘录.hasCompletedTodo || false,
      todoCount: 备忘录.todoCount || 0,
      completedTodoCount: 备忘录.completedTodoCount || 0,
      todoDeadlines: 备忘录.todoDeadlines || [],
      hasImg: 备忘录.hasImg || false,
      imgCount: 备忘录.imgCount || 0,
      hasAttachment: 备忘录.hasAttachment || false,
      attachmentCount: 备忘录.attachmentCount || 0
    };
  }

  /**
   * 保存摘要索引（不含内容字段）
   * 只写元数据，约 50KB / 5k 条
   */
  async _saveIndex() {
    try {
      const 索引 = {};
      for (const m of this.memos) {
        索引[m.id] = this._提取摘要(m);
      }
      const 数据 = JSON.stringify({
        版本: this._格式版本,
        nextId: this.nextId,
        updatedAt: new Date().toISOString(),
        索引
      }, null, 2);
      await this.storage.写文件(this.indexFile, 数据);
    } catch (错误) {
      console.error('[备忘录管理器] 保存索引失败:', 错误);
      throw 错误;
    }
  }

  /**
   * 加载索引并重建内存缓存
   * 自动检测旧格式（v1）并执行一次性迁移
   */
  async _loadIndex() {
    try {
      const 存在 = await this.storage.文件存在(this.indexFile);
      if (!存在) {
        // 索引文件不存在，初始化空数据
        this.memos = [];
        this.nextId = 1;
        await this._saveIndex();
        return;
      }

      const 原始数据 = await this.storage.读文件(this.indexFile);
      if (!原始数据) {
        this.memos = [];
        this.nextId = 1;
        await this._saveIndex();
        return;
      }

      const 数据 = JSON.parse(原始数据);

      // === 检测旧格式（v1）：memos 字段存在且含完整内容 ===
      if (数据.版本 !== 'v2' && 数据.memos && Array.isArray(数据.memos)) {
        console.log('[备忘录管理器] 检测到旧存储格式(v1)，开始迁移至 v2...');
        await this._迁移至v2(数据);
        return;
      }

      // === 新格式（v2）：从摘要索引恢复内存缓存，再补全内容 ===
      if (数据.版本 === 'v2' && 数据.索引) {
        this.nextId = 数据.nextId || 1;
        const 摘要列表 = Object.values(数据.索引);
        // 按 id 降序排列（最新在前，与 createMemo 行为保持一致）
        摘要列表.sort((a, b) => b.id - a.id);

        // 为每条摘要添加 placeholder 内容
        this.memos = 摘要列表.map(摘要 => ({
          ...摘要,
          内容: '' // placeholder，之后补全
        }));

        // 批量补全内容（异步批处理，每次读 20 条）
        console.log(`[备忘录管理器] 开始补全 ${this.memos.length} 条备忘录内容...`);
        const BATCH_SIZE = 20;
        let 补全数 = 0;
        for (let i = 0; i < this.memos.length; i += BATCH_SIZE) {
          const batch = this.memos.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (m) => {
            try {
              const 完整 = await this._readMemoFile(m.id);
              if (完整 && 完整.内容) {
                m.内容 = 完整.内容;
                补全数++;
              }
            } catch (e) {
              console.warn(`[备忘录管理器] 补全备忘录 #${m.id} 内容失败:`, e);
            }
          }));
        }
        console.log(`[备忘录管理器] 内容补全完成: ${补全数}/${this.memos.length} 条`);
        return;
      }

      // 格式不识别，回退
      console.warn('[备忘录管理器] 索引格式不识别，重置为空');
      this.memos = [];
      this.nextId = 1;
    } catch (e) {
      console.warn('[备忘录管理器] 加载索引失败，使用空列表', e);
      this.memos = [];
      this.nextId = 1;
    }
  }

  /**
   * 一次性迁移：旧格式（v1）→ 新格式（v2）
   * 1. 备份旧索引
   * 2. 逐条写 {id}.json
   * 3. 写新摘要索引
   * 4. 加载新格式
   */
  async _迁移至v2(旧数据) {
    try {
      console.log(`[备忘录管理器] 开始迁移 ${旧数据.memos.length} 条数据至 v2...`);

      // 1. 备份旧索引
      const 旧原始 = JSON.stringify(旧数据, null, 2);
      await this.storage.写文件(this.indexFile + '.bak', 旧原始);
      console.log('[备忘录管理器] 旧索引已备份:', this.indexFile + '.bak');

      // 2. 重建内存
      this.memos = 旧数据.memos || [];
      this.nextId = 旧数据.nextId || 1;

      // 3. 逐条写 {id}.json
      for (const m of this.memos) {
        await this._writeMemoFile(m);
      }

      // 4. 写新格式摘要索引
      await this._saveIndex();
      console.log(`[备忘录管理器] 迁移完成: ${this.memos.length} 条`);
    } catch (e) {
      console.error('[备忘录管理器] 迁移失败:', e);
      // 保留旧索引文件不删，下次启动还会检测到旧格式并重试
      throw e;
    }
  }

  // ========== 结构元数据提取（供 AI 搜索用）============

  /**
   * 从 HTML 内容提取结构性元数据
   * todoDeadlines：从 data-deadline 属性解析截止时间
   */
  提取结构元数据(内容) {
    if (!内容) return { hasTodo: false, hasCompletedTodo: false, hasImg: false, hasAttachment: false, todoCount: 0, completedTodoCount: 0, imgCount: 0, attachmentCount: 0, todoDeadlines: [] };
    const todoItems = (内容.match(/class="[^"]*todo-item[^"]*"/gi) || []).filter(m => !m.includes('todo-checkbox') && !m.includes('todo-text'));
    const completedItems = (内容.match(/class="[^"]*todo-item[^"]*completed[^"]*"|class="[^"]*completed[^"]*todo-item[^"]*"/gi) || []);
    const imgTags = (内容.match(/<img[^>]+>/gi) || []).filter(tag => !/alt=["']\s*["']/.test(tag) && /src=["'][^"']+["']/.test(tag));
    const attachments = (内容.match(/data-file-data|class="[^"]*附件[^"]*"/gi) || []);
    // 提取未完成待办的截止时间（已完成待办的 deadline 不纳入，避免过期后还显示红色）
    const todoDeadlines = [];
    const todoDivRegex = /<div[^>]*class="[^"]*todo-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    while ((match = todoDivRegex.exec(内容)) !== null) {
      const div = match[0];
      // 跳过已完成待办
      if (/completed/i.test(div)) continue;
      const dlMatch = div.match(/data-deadline=["']([^"']*)["']/i);
      if (dlMatch && dlMatch[1]) todoDeadlines.push(dlMatch[1]);
    }
    return {
      hasTodo: todoItems.length > 0,
      hasCompletedTodo: completedItems.length > 0,
      todoCount: todoItems.length,
      completedTodoCount: completedItems.length,
      hasImg: imgTags.length > 0,
      imgCount: imgTags.length,
      hasAttachment: attachments.length > 0,
      attachmentCount: attachments.length,
      todoDeadlines
    };
  }

  // ========== 核心 CRUD ==========

  /**
   * 创建备忘录
   * 流程：写 {id}.json → 更新内存 → 更新摘要索引
   * 异常时回滚：删除已写的文件，恢复 nextId
   */
  async createMemo({ 标题, 内容, 标签 = [], 文件夹 = '未分类', 收藏 = false, 已置顶 = false, 置顶时间 = null, 创建时间: 传入创建时间, 更新时间: 传入更新时间 }) {
    window.debugInfo?.('备忘录管理器', { 操作: '创建', 标题, 文件夹 });
    const id = this.nextId++;
    const now = new Date().toISOString();
    const 结构元数据 = this.提取结构元数据(内容);
    const 实际创建时间 = 传入创建时间 || now;
    const 实际更新时间 = 传入更新时间 || now;
    const 备忘录 = {
      id,
      标题: 标题.trim(),
      内容: 内容.trim(),
      日期: 实际创建时间.slice(0, 10),
      文件夹,
      标签,
      收藏,
      已删除: false,
      删除时间: null,
      已置顶,
      置顶时间,
      创建时间: 实际创建时间,
      更新时间: 实际更新时间,
      ...结构元数据
    };

    try {
      // 先写文件（持久化优先）
      await this._writeMemoFile(备忘录);
      // 更新内存
      this.memos.unshift(备忘录);
      // 更新摘要索引
      await this._saveIndex();
      console.log(`[备忘录管理器] 已创建并保存: ${标题}, ID: ${id}`);
    } catch (错误) {
      console.error('[备忘录管理器] 创建保存失败:', 错误);
      // 回滚：删除已写的文件，恢复 nextId
      try { await this._deleteMemoFile(id); } catch (_) {}
      this.nextId--;
      throw 错误;
    }

    // 同步内存缓存（备忘录数据.js 里的全局变量）
    if (window._备忘录数据) {
      window._备忘录数据.unshift(备忘录);
    }

    // 同步文件夹到文件夹结构（如果还不存在）
    if (window._创建文件夹 && 文件夹) {
      const 已存在 = window._获取所有文件夹列表().some(f => f.名称 === 文件夹);
      if (!已存在) {
        window._创建文件夹(文件夹, null);
        console.log(`[备忘录管理器] 自动添加新文件夹到结构: ${文件夹}`);
      }
    }

    // 触发 UI 刷新
    if (window.渲染备忘录列表) window.渲染备忘录列表();
    if (window.渲染文件夹树) window.渲染文件夹树();

// 向量搜索钩子已移除 (2026-05-03)

    return 备忘录;
  }

  /**
   * 更新备忘录
   * 流程：写 {id}.json → 更新内存 → 更新摘要索引
   */
  async updateMemo(id, { 标题, 内容, 标签, 文件夹, 收藏, 已删除 }) {
    window.debugInfo?.('备忘录管理器', { 操作: '更新', id, 标题, 文件夹 });
    const 备忘录 = this.memos.find(m => m.id === id);
    if (!备忘录) throw new Error(`备忘录 #${id} 不存在`);
    if (标题 !== undefined) 备忘录.标题 = 标题.trim();
    if (内容 !== undefined) {
      备忘录.内容 = 内容.trim();
      const 元数据 = this.提取结构元数据(内容);
      Object.assign(备忘录, 元数据);
    }
    if (标签 !== undefined) 备忘录.标签 = 标签;
    if (文件夹 !== undefined) 备忘录.文件夹 = 文件夹;
    if (收藏 !== undefined) 备忘录.收藏 = 收藏;
    if (已删除 !== undefined) {
      备忘录.已删除 = 已删除;
      备忘录.删除时间 = 已删除 ? new Date().toISOString() : undefined;
    }
    备忘录.更新时间 = new Date().toISOString();

    // 写单条文件 + 更新摘要索引
    await this._writeMemoFile(备忘录);
    await this._saveIndex();

    // 同步内存缓存
    if (window._备忘录数据) {
      const 缓存 = window._备忘录数据.find(m => m.id === id);
      if (缓存) Object.assign(缓存, 备忘录);
    }
    if (window.渲染备忘录列表) window.渲染备忘录列表();

    return 备忘录;
  }

  /**
   * 删除备忘录（软删除，移到回收站）
   * 流程：更新内存 → 写文件 → 更新摘要索引（不改文件名，只改标记）
   */
  async deleteMemo(id) {
    window.debugInfo?.('备忘录管理器', { 操作: '删除', id });
    const 备忘录 = this.memos.find(m => m.id === id);
    if (!备忘录) throw new Error(`备忘录 #${id} 不存在`);

    // 软删除：标记为已删除，记录删除时间
    备忘录.已删除 = true;
    备忘录.删除时间 = new Date().toISOString();
    备忘录.更新时间 = 备忘录.删除时间;

    await this._writeMemoFile(备忘录);
    await this._saveIndex();

    // 同步内存缓存
    if (window._备忘录数据) {
      const 缓存 = window._备忘录数据.find(m => m.id === id);
      if (缓存) {
        缓存.已删除 = true;
        缓存.删除时间 = 备忘录.删除时间;
        缓存.更新时间 = 备忘录.更新时间;
      }
    }
    if (window.渲染备忘录列表) window.渲染备忘录列表();
    if (window.渲染文件夹树) window.渲染文件夹树();

    return 备忘录;
  }

  /**
   * 永久删除备忘录（从回收站彻底删除）
   * 流程：删文件 → 内存移除 → 更新摘要索引
   */
  async 永久删除备忘录(id) {
    const 索引 = this.memos.findIndex(m => m.id === id);
    if (索引 === -1) throw new Error(`备忘录 #${id} 不存在`);
    const 删除的 = this.memos.splice(索引, 1)[0];

    // 先删文件
    await this._deleteMemoFile(id);
    await this._saveIndex();

    if (window._备忘录数据) {
      window._备忘录数据 = window._备忘录数据.filter(m => m.id !== id);
    }
    if (window.渲染备忘录列表) window.渲染备忘录列表();
    if (window.渲染文件夹树) window.渲染文件夹树();

    return 删除的;
  }

  /**
   * 恢复已删除的备忘录
   */
  async 恢复备忘录(id) {
    const 备忘录 = this.memos.find(m => m.id === id);
    if (!备忘录) throw new Error(`备忘录 #${id} 不存在`);
    if (!备忘录.已删除) throw new Error(`备忘录 #${id} 不在回收站中`);

    备忘录.已删除 = false;
    备忘录.删除时间 = null;
    备忘录.更新时间 = new Date().toISOString();

    await this._writeMemoFile(备忘录);
    await this._saveIndex();

    if (window._备忘录数据) {
      const 缓存 = window._备忘录数据.find(m => m.id === id);
      if (缓存) {
        缓存.已删除 = false;
        缓存.删除时间 = null;
        缓存.更新时间 = 备忘录.更新时间;
      }
    }
    if (window.渲染备忘录列表) window.渲染备忘录列表();
    if (window.渲染文件夹树) window.渲染文件夹树();

    return 备忘录;
  }

  /**
   * 置顶备忘录
   */
  async 置顶备忘录(id) {
    const 备忘录 = this.memos.find(m => m.id === id);
    if (!备忘录) throw new Error(`备忘录 #${id} 不存在`);

    const now = new Date().toISOString();
    if (备忘录.已置顶) {
      备忘录.已置顶 = false;
      备忘录.置顶时间 = null;
    } else {
      备忘录.已置顶 = true;
      备忘录.置顶时间 = now;
    }
    备忘录.更新时间 = now;

    await this._writeMemoFile(备忘录);
    await this._saveIndex();

    if (window._备忘录数据) {
      const 缓存 = window._备忘录数据.find(c => c.id === id);
      if (缓存) Object.assign(缓存, 备忘录);
    }
    if (window.渲染备忘录列表) window.渲染备忘录列表();

    return 备忘录;
  }

  /**
   * 取消置顶备忘录
   */
  async 取消置顶(id) {
    const 备忘录 = this.memos.find(m => m.id === id);
    if (!备忘录) throw new Error(`备忘录 #${id} 不存在`);

    备忘录.已置顶 = false;
    备忘录.置顶时间 = null;
    备忘录.更新时间 = new Date().toISOString();

    await this._writeMemoFile(备忘录);
    await this._saveIndex();

    if (window._备忘录数据) {
      const 缓存 = window._备忘录数据.find(m => m.id === id);
      if (缓存) Object.assign(缓存, 备忘录);
    }
    if (window.渲染备忘录列表) window.渲染备忘录列表();

    return 备忘录;
  }

  /**
   * 清空回收站（永久删除所有已删除的备忘录）
   */
  async 清空回收站() {
    const 已删除列表 = this.memos.filter(m => m.已删除);
    const 删除数量 = 已删除列表.length;

    // 先删文件
    await Promise.all(已删除列表.map(m => this._deleteMemoFile(m.id).catch(() => {})));
    this.memos = this.memos.filter(m => !m.已删除);
    await this._saveIndex();

    if (window._备忘录数据) {
      window._备忘录数据 = window._备忘录数据.filter(m => !m.已删除);
    }
    if (window.渲染备忘录列表) window.渲染备忘录列表();
    if (window.渲染文件夹树) window.渲染文件夹树();

    return { 删除数量, 已删除列表 };
  }

  /**
   * 获取回收站中的备忘录列表
   */
  获取回收站列表() {
    return this.memos.filter(m => m.已删除).sort((a, b) =>
      new Date(b.删除时间) - new Date(a.删除时间)
    );
  }

  /**
   * 获取单个备忘录
   */
  getMemo(id) {
    return this.memos.find(m => m.id === id) || null;
  }

  /**
   * 获取所有备忘录（供批量整理使用）
   * 自动按 ID 去重 + 合并静态数据
   */
  getAllMemos() {
    // 合并 IndexedDB 数据 + 静态数据（确保不遗漏）
    const 静态数据 = window._备忘录数据 || [];
    const 合并后 = [...this.memos];

    // 添加静态数据中不存在的备忘录（按 ID 去重）
    for (const 静态项 of 静态数据) {
      if (!合并后.some(m => m.id === 静态项.id)) {
        console.log(`[备忘录管理器] 从静态数据补充: ID ${静态项.id} "${静态项.标题}"`);
        合并后.push({
          id: 静态项.id,
          标题: 静态项.标题,
          内容: 静态项.内容 || '',
          日期: 静态项.日期,
          文件夹: 静态项.文件夹 || '未分类',
          标签: 静态项.标签 || [],
          收藏: 静态项.收藏 || false,
          创建时间: 静态项.创建时间,
          更新时间: 静态项.更新时间
        });
      }
    }

    // 按 ID 去重（防止数据异常）
    const 唯一Map = new Map();
    for (const m of 合并后) {
      if (!唯一Map.has(m.id)) {
        唯一Map.set(m.id, m);
      } else {
        console.warn(`[备忘录管理器] 发现重复 ID: ${m.id}, 已去重`);
      }
    }

    const 去重后 = Array.from(唯一Map.values());

    // 如果有补充或去重，自动保存到 IndexedDB
    if (去重后.length !== this.memos.length) {
      console.log(`[备忘录管理器] 数据同步：${this.memos.length} → ${去重后.length}`);
      this.memos = 去重后;
      // 触发保存：补充的新条目需要写文件，已存在的需要更新索引
      (async () => {
        try {
          // 将补充的条目写入文件
          for (const m of 去重后) {
            if (!await this._memoFileExists(m.id)) {
              await this._writeMemoFile(m);
            }
          }
          await this._saveIndex();
        } catch (e) {
          console.error('自动保存失败:', e);
        }
      })();
    }

    return 去重后.map(m => this._format(m));
  }

  // ========== 搜索（供 AI 工具调用）============

  /**
   * 搜索备忘录（AI 工具调用）
   * @param {string} 关键词 - 空格分隔
   * @param {number} limit - 返回条数
   * @returns {Array} 搜索结果
   */
  /**
   * 同义词表（轻量，无依赖）
   * 用于多维度搜索时展开同义词，提高召回率
   */
  static get 同义词表() {
    return {
      '代码': ['编程', '开发', '程序', '编码', 'code', 'coding'],
      '编程': ['代码', '开发', '程序', '编码'],
      '开发': ['编程', '代码', '程序', '编码', '软件', '研发'],
      '程序': ['代码', '编程', '开发', '软件', '应用'],
      'bug': ['错误', '异常', '故障', '问题', '缺陷'],
      '调试': ['debug', '排查', '追踪', '分析', '定位'],
      '报错': ['错误', '异常', 'bug', '故障', '崩溃'],
      '错误': ['报错', '异常', 'bug', '故障', '问题'],
      '崩溃': ['卡死', '闪退', 'crash', '挂掉'],
      '性能': ['速度', '卡顿', '慢', '优化', '效率', '响应', '延迟'],
      '卡顿': ['慢', '卡', '性能', '延迟', '响应慢'],
      '数据': ['信息', '内容', '资料'],
      '信息': ['数据', '内容', '资料', '消息'],
      '文件': ['文档', '档案', 'doc', 'file'],
      '图片': ['图像', '照片', '截图', 'img', 'image', '图'],
      '图像': ['图片', '照片', '图', 'image'],
      '附件': ['文件', '文档', 'attachment', '资源', '素材'],
      '视频': ['录像', '影视', 'movie', 'video', '影片'],
      '音频': ['声音', '音乐', '录音', 'audio', '播客'],
      '笔记': ['备忘录', 'note', '记录', '便签', '记事'],
      '备忘录': ['笔记', 'memo', '记录', '记事', '便签'],
      '待办': ['todo', '任务', '事项', '要做的事', '未完成'],
      '任务': ['待办', 'todo', '事项', '工作', '作业'],
      '计划': ['规划', '方案', '安排', '日程', '排期'],
      '方案': ['计划', '规划', '方案', '策略', '设计'],
      '标签': ['tag', '标记', '分类', '类别'],
      '设置': ['配置', '设定', '选项', '偏好', '参数'],
      '密钥': ['key', 'token', '秘钥', '口令', '密码'],
      '密码': ['口令', '密钥', 'token', '验证'],
      '登录': ['登陆', '登入', '认证', '授权'],
      '智能体': ['agent', '助理', '助手', '机器人', 'AI'],
      '助手': ['助理', 'agent', '智能体', 'AI', '机器人'],
      'AI': ['ai', '人工智能', '智能', '智能体', '大模型'],
      'api': ['接口', 'API', '服务', '端点', 'endpoint'],
      '接口': ['api', 'API', '端点', 'endpoint'],
      '函数': ['方法', 'function', 'func', '回调'],
      '变量': ['参数', '常量', '值'],
      '组件': ['component', '模块', '部件', '元素'],
      '模块': ['包', 'package', '库'],
      '前端': ['web', '网页', '客户端', 'HTML', 'CSS', 'JavaScript', 'JS', '界面'],
      '后端': ['服务器', 'service', 'server', '服务端', '后台'],
      '服务器': ['服务端', '后端', 'server', '主机'],
      '数据库': ['db', 'database', 'DB', '存储', '持久化'],
      '存储': ['保存', '持久化', '缓存', 'cache'],
      '缓存': ['cache', '临时存储', '缓冲'],
      '搜索': ['查找', '检索', '查询', '寻找'],
      '学习': ['学', '了解', '掌握', '熟悉', '入门'],
      '教程': ['指南', '教学', '入门', 'guide', 'tutorial'],
      '指南': ['教程', '手册', '说明', '指引'],
      '修复': ['修补', '解决', 'fix', 'patch'],
      '解决': ['处理', '修复', 'fix', '搞定'],
    };
  }

  /**
   * 轻量中文分词（双字符滑动窗口 + 英文词元提取）
   */
  static 简单分词(文本) {
    const s = 文本.toLowerCase().trim();
    if (!s) return [];
    // 英文/数字词元
    const 英文词元 = s.split(/[^a-z0-9+#.\-_]/).filter(w => w.length >= 1);
    // 中文：双字符滑动窗口
    const 中文 = s.replace(/[^\u4e00-\u9fff]/g, '');
    const 中文词元 = [];
    for (let i = 0; i < 中文.length - 1; i++) {
      中文词元.push(中文.slice(i, i + 2));
    }
    const 单字词元 = 中文.split('').filter(c => c.length === 1);
    return [...new Set([...英文词元, ...中文词元, ...单字词元])];
  }

  /**
   * 多维度搜索（替代纯 includes 搜索）
   * 维度：精确匹配 / 分词匹配 / 同义词展开 / 标签加权
   */
  async searchMemo(关键词, limit = 3) {
    if (!关键词 || !关键词.trim()) {
      return this.memos.slice(0, limit).map(m => this._format(m));
    }

    const 原始词 = 关键词.trim().toLowerCase();
    const 词列表 = 原始词.split(/\s+/).filter(Boolean);

    // === 收集所有搜索词（原词 + 同义词展开）===
    const 同义词表 = MemoManager.同义词表;
    const 所有搜索词 = new Set(词列表);
    for (const 词 of 词列表) {
      const 同义词 = 同义词表[词];
      if (同义词) 同义词.forEach(s => 所有搜索词.add(s));
    }
    const 搜索词数组 = [...所有搜索词];

    // === 对每条备忘录打分 ===
    const 带分结果 = this.memos.map(m => {
      let 分数 = 0;
      const 标题 = (m.标题 || '').toLowerCase();
      const 内容纯文本 = (m.内容 || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').toLowerCase();
      const 标签文本 = (m.标签 || []).join(' ').toLowerCase();
      const 全文 = 标题 + ' ' + 内容纯文本 + ' ' + 标签文本;
      const 内容词元 = new Set(MemoManager.简单分词(全文));

      for (const 搜索词 of 搜索词数组) {
        if (全文.includes(搜索词)) {
          // 标签内匹配权重最高
          if (标签文本.includes(搜索词)) 分数 += 6;
          // 标题匹配权重次之
          else if (标题.includes(搜索词)) 分数 += 4;
          else 分数 += 2;
        }
        // 分词模糊匹配
        for (const 词元 of 内容词元) {
          if (词元.includes(搜索词) || 搜索词.includes(词元)) {
            分数 += 1;
            break;
          }
        }
      }
      return { memo: m, 分数 };
    });

    // 过滤零分，降序排列
    const 排序后 = 带分结果
      .filter(r => r.分数 > 0)
      .sort((a, b) => b.分数 - a.分数)
      .slice(0, limit)
      .map(r => this._format(r.memo));

    return 排序后;
  }

  _format(m) {
    // 提取纯文本（去除HTML标签）
    const 纯文本 = m.内容 ? m.内容.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ') : '';
    return {
      id: m.id,
      标题: m.标题,
      内容: m.内容,
      内容片段: 纯文本.length > 100 ? 纯文本.slice(0, 100) + '…' : 纯文本,
      完整内容: m.内容,
      纯文本内容: 纯文本,
      日期: m.日期,
      文件夹: m.文件夹,
      标签: m.标签,
      收藏: m.收藏,
      更新时间: m.更新时间,
      // 结构元数据（供 AI 搜索用）
      hasTodo: m.hasTodo || false,
      hasCompletedTodo: m.hasCompletedTodo || false,
      todoCount: m.todoCount || 0,
      completedTodoCount: m.completedTodoCount || 0,
      todoDeadlines: m.todoDeadlines || [],
      hasImg: m.hasImg || false,
      imgCount: m.imgCount || 0,
      hasAttachment: m.hasAttachment || false,
      attachmentCount: m.attachmentCount || 0
    };
  }

  // ========== 批量迁移（从旧内存数据迁移到 IndexedDB）============

  /**
   * 补充历史备忘录的结构元数据（对旧数据一次性补充）
   * 启动时自动调用，有内容但无元数据字段时触发
   */
  补充历史元数据() {
    let 计数 = 0;
    for (const m of this.memos) {
      if (m.内容 && m.hasTodo === undefined) {
        const 元数据 = this.提取结构元数据(m.内容);
        Object.assign(m, 元数据);
        计数++;
      }
    }
    if (计数 > 0) {
      // 改写文件 + 更新摘要索引
      (async () => {
        try {
          for (const m of this.memos) {
            if (m.hasTodo !== undefined) {
              await this._writeMemoFile(m);
            }
          }
          await this._saveIndex();
        } catch (e) {
          console.error('[备忘录管理器] 补充元数据后保存失败:', e);
        }
      })();
      console.log(`[备忘录管理器] 补充了 ${计数} 条历史备忘录的结构元数据`);
    }
    return 计数;
  }

  /**
   * 迁移旧内存数据到 IndexedDB
   * 由 初始化.js 在启动时调用一次（用于从 localStorage 迁移到 IndexedDB）
   */
  async migrateFromMemory() {
    // 已有 IndexedDB 数据，跳过迁移
    if (this.memos.length > 0) {
      console.log(`[备忘录管理器] 已有 ${this.memos.length} 条 IndexedDB 数据，跳过迁移`);
      return;
    }

    // 没有旧数据，跳过迁移
    if (!window._备忘录数据 || window._备忘录数据.length === 0) {
      console.log('[备忘录管理器] 无旧数据需要迁移');
      return;
    }

    console.log(`[备忘录管理器] 开始迁移 ${window._备忘录数据.length} 条旧数据...`);
    for (const 旧 of window._备忘录数据) {
      const 备忘录 = {
        id: 旧.id,
        标题: 旧.标题,
        内容: 旧.内容,
        日期: 旧.日期,
        文件夹: 旧.文件夹 || '默认',
        标签: 旧.标签 || [],
        收藏: 旧.收藏 || false,
        创建时间: 旧.创建时间 || new Date().toISOString(),
        更新时间: 旧.更新时间 || new Date().toISOString()
      };
      this.memos.push(备忘录);
      await this._writeMemoFile(备忘录);
      if (旧.id >= this.nextId) this.nextId = 旧.id + 1;
    }
    await this._saveIndex();
    console.log(`[备忘录管理器] 迁移完成`);
  }
}

// 全局单例
window.MemoManager = MemoManager;
window.备忘录管理器 = null; // 初始化后赋值
