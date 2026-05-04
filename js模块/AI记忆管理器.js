/**
 * AI 记忆管理器
 * 支持长期记忆（IndexedDB）和用户画像更新
 */

class AIMemoryManager {
  constructor() {
    this.dbName = 'ai_memory_db';
    this.storeName = 'memories';
    this.configStoreName = 'configs'; // 新增：配置存储
    this.db = null;
    this.用户画像 = null;
    this._USE_SEMANTIC = false; // 语义检索开关，设为 true 启用（自动切换为关键词）
    this.ai身份 = null;
  }

  async 初始化() {
    // 初始化 IndexedDB
    await this._initDB();
    
    // 加载或初始化配置（优先从 IndexedDB，不存在则用默认模板）
    await this._loadConfigs();
    
    console.log('🧠 AI 记忆系统已初始化');
  }

  async _initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2); // 版本升级为 2
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 记忆存储
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('importance', 'importance', { unique: false });
          store.createIndex('agent_id', 'agent_id', { unique: false });
        } else {
          // 版本升级时添加索引
          try {
            const store = event.currentTarget.transaction.objectStore(this.storeName);
            if (!store.indexNames.contains('agent_id')) {
              store.createIndex('agent_id', 'agent_id', { unique: false });
            }
          } catch(e) { /* ignore */ }
        }
        
        // 配置存储（新增）
        if (!db.objectStoreNames.contains(this.configStoreName)) {
          db.createObjectStore(this.configStoreName, { keyPath: 'key' });
        }
      };
    });
  }

  async _loadConfigs() {
    // 1. 尝试从 IndexedDB 读取已保存的配置
    const 已保存身份 = await this._getConfig('ai_identity');
    const 已保存画像 = await this._getConfig('user_profile');
    
    if (已保存身份 && 已保存画像) {
      // 已有保存的配置，检查是否需要迁移
      this.ai身份 = 已保存身份;
      this.用户画像 = 已保存画像;
      
      // 兼容性：确保用户画像包含偏好记录字段
      if (!this.用户画像.偏好记录) {
        this.用户画像.偏好记录 = [];
      }
      
      // 迁移：删除"无法联网搜索"局限，添加联网搜索能力
      const 需要迁移 = this.ai身份.局限?.some(l => l.includes('无法联网搜索'));
      if (需要迁移) {
        console.log('🔄 检测到旧版本配置，正在迁移...');
        this.ai身份.局限 = this.ai身份.局限.filter(l => !l.includes('无法联网搜索'));
        
        // 添加联网搜索能力（如果还没有）
        const 有联网能力 = this.ai身份.能力清单?.some(c => c.includes('联网搜索'));
        if (!有联网能力) {
          this.ai身份.能力清单 = this.ai身份.能力清单 || [];
          this.ai身份.能力清单.push('联网搜索：开启联网开关后可搜索实时信息（新闻、天气、百科等）');
        }
        
        // 更新版本
        this.ai身份.版本 = '1.1.0';
        this.ai身份.最后更新 = new Date().toISOString().split('T')[0];
        
        // 保存更新后的配置
        await this._saveConfig('ai_identity', this.ai身份);
        console.log('✅ 配置迁移完成，已启用联网搜索能力');
      }
      
      console.log('✅ 从 IndexedDB 加载配置');
      return;
    }
    
    // 2. 首次运行，加载默认模板
    try {
      const 身份响应 = await fetch('./AI配置/身份.json');
      const 默认身份 = await 身份响应.json();
      
      const 画像响应 = await fetch('./AI配置/用户画像.json');
      const 默认画像 = await 画像响应.json();
      
      // 3. 保存到 IndexedDB（作为初始值）
      await this._saveConfig('ai_identity', 默认身份);
      await this._saveConfig('user_profile', 默认画像);
      
      this.ai身份 = 默认身份;
      this.用户画像 = 默认画像;
      
      console.log('✅ 首次运行，已初始化默认配置到 IndexedDB');
    } catch (错误) {
      console.warn('加载默认配置失败，使用内置默认值:', 错误);
      
      // 内置默认值（兜底）- 已包含联网搜索能力
      this.ai身份 = {
        名称: "爱助手",
        角色: "鸿蒙私人AI助理",
        性格: "温暖、细心、高效",
        能力清单: ["备忘录管理", "记忆存储", "AI对话", "联网搜索（开启开关后可用）"],
        局限: ["无法访问手机系统应用", "无法发送邮件或短信"]
      };
      
      this.用户画像 = {
        用户昵称: "",
        称呼方式: "您",
        偏好设置: { 回复风格: "简洁直接", emoji使用: "适量" },
        交互历史: { 对话次数: 0 }
      };
      
      await this._saveConfig('ai_identity', this.ai身份);
      await this._saveConfig('user_profile', this.用户画像);
    }
  }

  // IndexedDB 配置读写
  async _getConfig(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.configStoreName], 'readonly');
      const store = transaction.objectStore(this.configStoreName);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => resolve(null);
    });
  }

  async _saveConfig(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.configStoreName], 'readwrite');
      const store = transaction.objectStore(this.configStoreName);
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // ========== 记忆存储 ==========

  /**
   * 记住一件事
   * @param {string} 内容 - 记忆内容
   * @param {string} 类型 - 'fact'事实 | 'event'事件 | 'preference'偏好 | 'reminder'提醒
   * @param {number} 重要性 - 1-10，默认5
   */
  async 记住(内容, 类型 = 'fact', 重要性 = 5, agentIdOverride = null) {
    const 当前智能体Id = agentIdOverride || (window.当前智能体ID && window.当前智能体ID()) || 'default';
    const 记忆 = {
      内容,
      类型,
      重要性: Math.min(10, Math.max(1, 重要性)),
      时间戳: new Date().toISOString(),
      创建时间: new Date().toISOString(),
      agent_id: 当前智能体Id,
      embedding: null  // 预留：语义检索时由 Transformers.js 生成向量
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(记忆);
      
      request.onsuccess = () => {
        // 同步到画像：preference/fact 类型的记忆自动归档
        const 新记忆 = { ...记忆, id: request.result };
        this._syncToProfile(新记忆);
        resolve(新记忆);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 统一检索入口 searchMemories
   * 所有记忆检索统一走此方法，后续语义搜索等升级只需改内部实现，调用方不变
   * @param {Object} 选项
   * @param {string} [选项.关键词] - 搜索文本（可选，不传则按时间+重要性排序返回最新）
   * @param {number} [选项.条数=5] - 返回条数上限
   * @param {string} [选项.类型] - 过滤类型（如 'fact','preference','relationship','event'）
   * @param {number} [选项.最小重要性=0] - 最低重要性过滤
   * @param {number} [选项.时间偏差] - 0~1，越接近1越偏向新记忆（当前实现：简单时间倒序加权）
   * @param {boolean} [选项.语义检索] - 是否启用语义检索（需 Transformers.js 就绪，预留分支）
   * @param {string} [选项.agentId] - 指定智能体ID，不传则用当前智能体
   * @returns {Promise<Array>} 记忆条目数组，按综合得分降序
   */
  /**
   * 记住后自动同步到画像（preference/fact/event → 画像偏好记录）
   */
  _syncToProfile(记忆) {
    if (!this.用户画像 || !['preference', 'fact', 'event'].includes(记忆.类型)) return;
    const 画像 = this.用户画像;
    if (!画像.偏好记录) 画像.偏好记录 = [];
    const 内容 = 记忆.内容.trim();
    // 去重：已有完全相同的就不追加
    if (内容 && !画像.偏好记录.includes(内容)) {
      画像.偏好记录.push(内容);
      this.更新用户画像({ 偏好记录: 画像.偏好记录 }).catch(e => 
        console.warn('[AI记忆] 同步到画像失败:', e)
      );
    }
  }

  async searchMemories(选项 = {}) {
    // 语义检索分支：手动开关（_USE_SEMANTIC=true）或显示请求时启用
    if (this._USE_SEMANTIC || 选项.语义检索) {
      return this._semanticSearch(选项);
    }
    return this._keywordSearch(选项);
  }

  /**
   * 语义搜索引擎（预留桩）
   * 当 Transformers.js + all-MiniLM-L6-v2 就绪时实现
   * 接受与 searchMemories 相同的选项，返回按语义相似度排序的结果
   */
  async _semanticSearch(选项 = {}) {
    console.log('[AI记忆管理器] 语义检索启用（基于共同词相关性）');
    // 先用关键词检索拿到候选集
    const 候选 = await this._keywordSearch({ ...选项, 条数: 50 });
    
    const 搜索词 = (选项.关键词 || '').toLowerCase().trim();
    if (!搜索词 || 候选.length === 0) return 候选.slice(0, 选项.条数 || 5);
    
    const 搜索词集合 = new Set(搜索词.split(/[\s，,、。.！!？?：:；;]+/).filter(Boolean));
    
    候选.forEach(m => {
      const 文本 = (m.内容 + ' ' + (m.标题 || '')).toLowerCase();
      // 共同词比例：简单编辑距离替代
      const 文本词 = 文本.split(/[\s，,、。.！!？?：:；;]+/).filter(Boolean);
      const 共同词 = 文本词.filter(w => 搜索词集合.has(w)).length;
      // Jaccard 相似度
      const 分母 = new Set([...搜索词集合, ...文本词]).size;
      m.语义分 = 分母 > 0 ? 共同词 / 分母 : 0;
      
      // 总分 = 语义分 * 0.5 + 重要性(归一化) * 0.25 + 时间衰减 * 0.25
      const 时效分 = this._时间衰减分(m, 选项.时间偏差);
      m.总分 = m.语义分 * 0.5 + (m.重要性 || 0) / 10 * 0.25 + 时效分 * 0.25;
    });
    
    候选.sort((a, b) => (b.总分 || 0) - (a.总分 || 0));
    return 候选.slice(0, 选项.条数 || 5);
  }

  /**
   * 计算时间衰减分 0~1
   */
  _时间衰减分(记忆, 时间偏差 = 0) {
    if (!时间偏差 || !记忆.时间戳) return 0;
    const 毫秒差 = Date.now() - new Date(记忆.时间戳).getTime();
    return Math.max(0, 1 - 毫秒差 / (90 * 86400000)) * 时间偏差;
  }

  /**
   * 关键词检索（当前默认实现，显式分离以支持语义检索的无缝替换）
   */
  async _keywordSearch(选项 = {}) {
    const {
      关键词,
      条数 = 5,
      类型,
      最小重要性 = 0,
      时间偏差 = 0,
      agentId
    } = 选项;

    const 当前智能体Id = agentId || ((window.当前智能体ID && window.当前智能体ID()) || 'default');
    const 现在 = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        let 全部 = request.result;

        // 1. 按智能体过滤
        全部 = 全部.filter(m => !m.agent_id || m.agent_id === 当前智能体Id);

        // 2. 按类型过滤
        if (类型) {
          if (Array.isArray(类型)) {
            全部 = 全部.filter(m => 类型.includes(m.类型));
          } else {
            全部 = 全部.filter(m => m.类型 === 类型);
          }
        }

        // 3. 按重要性过滤
        if (最小重要性 > 0) {
          全部 = 全部.filter(m => (m.重要性 || 0) >= 最小重要性);
        }

        // 4. 关键词匹配（短词优先 + 单字兜底，加权评分）
        const 搜索词 = 关键词?.toLowerCase().trim().replace(/\u3000/g, ' ').replace(/\s+/g, ' ');
        if (搜索词) {
          const 停用词 = new Set(['的','了','是','在','我','你','他','她','它','们','这','那','有','不','就','也','都','还','又','很','把','被','让','给','到','和','与','或','但','而','及','从','对','比','用','以','为','么','呢','吧','啊','吗','呀','嗯','哦','想','要','会','能','可','以','什么','怎么','哪个','多少','几','点','些','个','一','里','外','内','中','上','下','大','小','多','少','好','坏','没','无','做','去','来','得','说','看','知','道','时','候','年','月','日','天','地','人','事','物','理','等','于','之','其','所','将','a','an','the','is','are','was','were','in','on','to','for','of','and','or','be','it','do','no','not']);
          // 通用动词/连词 bigram，命中不代表语义相关，降权
          const 弱信号词 = new Set(['喜欢','知道','觉得','认为','需要','可以','应该','已经','可能','还是','因为','所以','但是','如果','虽然','然后','后来','其实','这样','那样','什么','怎么','现在','今天','明天','昨天','等于','不是','也是','就是','或者','而且','并且','之后','之前','关于','根据','通过','进行']);

          // 提取短词（2-3字滑动窗口）和单字，分别去停用词
          const 短词 = [];
          const 单字 = [...搜索词].filter(c => /[\u4e00-\u9fff]/.test(c) && !停用词.has(c));
          for (let i = 0; i < 搜索词.length - 1; i++) {
            const 二字 = 搜索词.slice(i, i + 2);
            if (/[\u4e00-\u9fff]{2}/.test(二字) && !(停用词.has(二字[0]) && 停用词.has(二字[1]))) {
              短词.push(二字);
            }
          }
          for (let i = 0; i < 搜索词.length - 2; i++) {
            const 三字 = 搜索词.slice(i, i + 3);
            if (/[\u4e00-\u9fff]{3}/.test(三字)) {
              短词.push(三字);
            }
          }

          // 加权评分：短词命中=3分（弱信号=1分），单字命中=1分（已被短词覆盖的不重复计）
          全部 = 全部.map(m => {
            const 文本 = (m.内容 + ' ' + (m.标题 || '') + ' ' + (m.类型 || '')).toLowerCase();
            let 得分 = 0;
            const 已覆盖字 = new Set();
            for (const 词 of 短词) {
              if (文本.includes(词)) {
                得分 += 弱信号词.has(词) ? 1 : 3;
                for (const c of 词) 已覆盖字.add(c); // 短词覆盖的字不再单计
              }
            }
            for (const 字 of 单字) {
              if (!已覆盖字.has(字) && 文本.includes(字)) 得分 += 1;
            }
            return { ...m, _检索得分: 得分 };
          }).filter(m => m._检索得分 > 0);
        } else {
          // 无关键词时返回空数组，避免不相关消息命中重要性排序的记忆
          全部 = [];
        }

        // 5. 综合排序（检索得分优先，重要性次之，时效加权）
        全部.sort((a, b) => {
          // 检索得分高的排前面
          if ((b._检索得分 || 0) !== (a._检索得分 || 0)) return (b._检索得分 || 0) - (a._检索得分 || 0);
          let 分A = a.重要性 || 0;
          let 分B = b.重要性 || 0;

          if (时间偏差 > 0) {
            const 时效A = Math.max(0, 1 - (现在 - new Date(a.时间戳 || a.timestamp || 0).getTime()) / (90 * 86400000));
            const 时效B = Math.max(0, 1 - (现在 - new Date(b.时间戳 || b.timestamp || 0).getTime()) / (90 * 86400000));
            分A += 时效A * 时间偏差;
            分B += 时效B * 时间偏差;
          }

          return 分B - 分A;
        });

        console.log('[记忆检索] 关键词:', 搜索词, '结果数:', 全部.length, '前3条:', 全部.slice(0, Math.min(3, 全部.length)).map(m => ({ 内容: m.内容?.slice(0, 20), 重要性: m.重要性, 类型: m.类型 })));
        resolve(全部.slice(0, 条数));
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 搜索记忆（旧方法，保持向后兼容）
   * @param {string} 关键词
   * @param {number} 条数
   */
  async 搜索(关键词, 条数 = 10) {
    return this.searchMemories({ 关键词, 条数 });
  }

  /**
   * 获取所有记忆
   * @param {string|null} agentIdOverride - 如果传入则不按当前智能体过滤，返回指定智能体的记忆
   */
  async 获取所有记忆(agentIdOverride = null) {
    const 当前智能体Id = (window.当前智能体ID && window.当前智能体ID()) || 'default';
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        let 结果 = request.result;
        // 过滤记忆：如果传入 agentIdOverride 则按指定 ID 过滤，否则按当前智能体
        if (agentIdOverride !== null) {
          结果 = 结果.filter(m => m.agent_id === agentIdOverride);
        } else if (当前智能体Id !== 'default' || true) {
          结果 = 结果.filter(m => !m.agent_id || m.agent_id === 当前智能体Id);
        }
        结果.sort((a, b) => b.重要性 - a.重要性);
        resolve(结果);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 删除记忆
   */
  async 删除(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // ========== 用户画像管理 ==========

  /**
   * 更新用户画像（持久化到 IndexedDB）
   */
  async 更新用户画像(更新内容) {
    Object.assign(this.用户画像, 更新内容);
    this.用户画像.最后更新 = new Date().toISOString();
    await this._saveConfig('user_profile', this.用户画像);
    return this.用户画像;
  }

  /**
   * 记录用户昵称
   */
  async 设置用户昵称(昵称, 称呼方式 = null) {
    this.用户画像.用户昵称 = 昵称;
    if (称呼方式) this.用户画像.称呼方式 = 称呼方式;
    await this.更新用户画像({});
    
    // 同时记一条记忆
    await this.记住(`用户名字是「${昵称}」，希望被称作「${称呼方式 || 昵称}」`, 'preference', 8);
    
    return `好的，我会称呼您为「${称呼方式 || 昵称}」。`;
  }

  /**
   * 记录交互
   */
  async 记录交互() {
    if (!this.用户画像.交互历史) {
      this.用户画像.交互历史 = { 首次使用: null, 对话次数: 0, 最后活跃: null };
    }
    if (!this.用户画像.交互历史.首次使用) {
      this.用户画像.交互历史.首次使用 = new Date().toISOString();
    }
    this.用户画像.交互历史.对话次数++;
    this.用户画像.交互历史.最后活跃 = new Date().toISOString();
    
    // 每 10 次保存一次
    if (this.用户画像.交互历史.对话次数 % 10 === 0) {
      await this._saveConfig('user_profile', this.用户画像);
    }
  }

  /**
   * 更新 AI 身份（持久化到 IndexedDB）
   */
  async 更新AI身份(更新内容) {
    Object.assign(this.ai身份, 更新内容);
    this.ai身份.最后更新 = new Date().toISOString();
    await this._saveConfig('ai_identity', this.ai身份);
    return this.ai身份;
  }

  // ========== 系统信息 ==========

  /**
   * 获取 AI 自我介绍
   */
  获取自我介绍() {
    if (!this.ai身份) return '我是你的AI助理。';
    
    return `${this.ai身份.自我介绍 || '我是' + this.ai身份.名称}\n\n` +
      `📋 我的能力：\n${this.ai身份.能力清单?.map(c => `• ${c}`).join('\n') || '暂无'}\n\n` +
      `⚠️ 我的局限：\n${this.ai身份.局限?.map(l => `• ${l}`).join('\n') || '暂无'}`;
  }

  /**
   * 获取原始用户画像对象
   */
  获取原始画像() {
    return this.用户画像 || {};
  }

  /**
   * 获取用户画像摘要
   */
  获取用户画像摘要() {
    if (!this.用户画像) return '暂无用户信息。';
    
    const 画像 = this.用户画像;
    let 摘要 = `📊 用户画像：\n`;
    
    if (画像.用户昵称) {
      摘要 += `• 昵称：${画像.用户昵称}（称呼：${画像.称呼方式}）\n`;
    }
    
    if (画像.常用功能?.length > 0) {
      摘要 += `• 常用功能：${画像.常用功能.join('、')}\n`;
    }
    
    if (画像.交互历史?.对话次数 > 0) {
      摘要 += `• 对话次数：${画像.交互历史.对话次数}\n`;
      摘要 += `• 首次使用：${画像.交互历史.首次使用?.slice(0, 10) || '未知'}\n`;
    }
    
    if (画像.偏好记录?.length > 0) {
      摘要 += `• 偏好记录：${画像.偏好记录.join('、')}\n`;
    }

    摘要 += `• 最后更新：${画像.最后更新?.slice(0, 10) || '未知'}`;
    
    return 摘要;
  }
}

// 创建全局实例
window.AI记忆管理器 = new AIMemoryManager();
window._获取所有AI记忆 = () => window.AI记忆管理器.获取所有记忆();

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
  window.AI记忆管理器.初始化().catch(console.error);
});
