// 对话管理.js - 极简版（架构重构：代码只执行，AI自主决策）
// 核心原则：
//   - 代码只负责发送消息、显示回复、执行工具调用
//   - 所有业务判断（何时记忆、查什么、怎么答）由 AI 通过系统提示词自主决策
//   - 禁止在代码层硬编码任何事实提取、正则匹配、或"用户画像"逻辑

let 当前会话ID = 'default';
// 按智能体ID隔离的会话列表（持久化到 localStorage）
let 所有会话列表 = {};  // { [agentId]: [{ id, 名称, 最后活跃时间, parent_session_id, 首条摘要 }] }
// 无痕模式：读取 window.无痕模式激活（由 全局函数.js 设置）
const 获取无痕状态 = () => !!window.无痕模式激活;

// ========== 会话列表持久化 ==========
function 加载会话列表FromStorage(agentId) {
  const 存储 = localStorage.getItem(`agent_sessions_${agentId}`);
  if (存储) {
    try { return JSON.parse(存储); } catch (e) { return null; }
  }
  return null;
}
function 保存会话列表ToStorage(agentId, 列表) {
  try {
    localStorage.setItem(`agent_sessions_${agentId}`, JSON.stringify(列表));
  } catch(e) {
    console.warn('[会话列表] localStorage 写入失败，可能已满:', e);
  }
}

// 内存中维护当前会话的对话历史（role/content 数组，不含 system）
// 最多保留最近 10 轮对话
let 当前对话历史 = [];
// ========== 对话管理器对象（供记忆库面板等模块使用）==========
window.对话管理器 = {
  获取当前消息列表() {
    return [...当前对话历史];
  }
};

// ========== 辅助函数：存储 ==========
function 获取存储() {
  return window.备忘录管理器?.storage || window.storage;
}

Object.defineProperty(window, '当前对话历史', { get: () => 当前对话历史, enumerable: true });
const 最大历史条数 = 20;

// ========== 上下文占用率追踪 ==========
// DeepSeek 模型上下文窗口大小
const 模型上下文窗口 = {
  'deepseek-chat': 65536,      // DeepSeek-V3: 64K
  'deepseek-reasoner': 65536   // DeepSeek-R1: 64K
};

/**
 * 获取当前模型的上下文窗口大小
 */
function 获取上下文窗口大小() {
  const 模型 = window.全局设置?.模型版本 || 'deepseek-chat';
  for (const [key, value] of Object.entries(模型上下文窗口)) {
    if (模型.includes(key)) return value;
  }
  return 65536; // 默认 64K
}

/**
 * 更新上下文占用率 UI
 */
function 更新上下文占用率() {
  const 按钮 = document.getElementById('上下文占用率按钮');
  if (!按钮) return;

  if (!window.上次Token用量) {
    按钮.textContent = '0%';
    按钮.className = '上下文占用率 安全';
    return;
  }

  const 已用 = window.上次Token用量.prompt_tokens || 0;
  const 总量 = 获取上下文窗口大小();
  const 百分比 = Math.min(Math.round((已用 / 总量) * 100), 100);

  按钮.textContent = 百分比 + '%';
  按钮.className = '上下文占用率 ' + (百分比 >= 80 ? '危险' : 百分比 >= 60 ? '警告' : '安全');
}

window.更新上下文占用率 = 更新上下文占用率;

// ========== 上下文压缩 ==========

/**
 * 显示压缩确认对话框
 */
function 显示压缩对话框() {
  // 移除已有对话框
  const 旧对话框 = document.getElementById('压缩确认对话框');
  if (旧对话框) 旧对话框.remove();

  const 已用 = window.上次Token用量?.prompt_tokens || 0;
  const 总量 = 获取上下文窗口大小();
  const 百分比 = Math.min(Math.round((已用 / 总量) * 100), 100);

  const 遮罩 = document.createElement('div');
  遮罩.id = '压缩确认对话框';
  遮罩.className = '压缩对话框遮罩';
  遮罩.innerHTML = `
    <div class="压缩对话框卡片">
      <div class="压缩对话框标题">压缩对话历史</div>
      <div class="压缩对话框描述">当前上下文已使用 ${百分比}%（${已用} / ${总量} tokens）</div>
      <div class="压缩对话框说明">AI 将总结之前的对话内容，生成一条摘要替换原始历史。压缩后从此处重新计数，但摘要会保存下来。</div>
      <div class="压缩对话框按钮组">
        <button class="压缩对话框按钮 取消" id="压缩取消按钮">取消</button>
        <button class="压缩对话框按钮 确认" id="确认压缩按钮">压缩</button>
      </div>
    </div>
  `;
  document.body.appendChild(遮罩);
  if (window._锁定滚动) window._锁定滚动();

  document.getElementById('压缩取消按钮').addEventListener('click', () => {
    遮罩.remove();
    if (window._解锁滚动) window._解锁滚动();
  });

  document.getElementById('确认压缩按钮').addEventListener('click', async () => {
    遮罩.remove();
    if (window._解锁滚动) window._解锁滚动();
    await 执行上下文压缩();
  });
}

window.显示压缩对话框 = 显示压缩对话框;

/**
 * 执行上下文压缩：
 * 1. 调用 AI 对当前对话历史生成摘要
 * 2. 将摘要保存到文件
 * 3. 用摘要替换内存中的对话历史
 * 4. 在界面上显示压缩结果
 */
async function 执行上下文压缩() {
  if (当前对话历史.length === 0) {
    window.添加消息到界面?.('助理', '当前没有对话历史需要压缩。');
    return;
  }

  // 添加加载提示
  const 加载元素 = window.添加临时加载消息?.('正在压缩对话历史…');

  try {
    // 构建压缩请求
    const 历史文本 = 当前对话历史.map((m, i) => {
      const 角色 = m.role === 'user' ? '用户' : 'AI';
      return `[${i+1}] ${角色}: ${m.content}`;
    }).join('\n\n');

    const 压缩提示词 = `请将以下对话历史压缩为一条简洁的摘要，保留所有关键信息（用户的需求、AI的结论、做出的决定、提到的具体细节），去除冗余和重复。摘要应该让AI在后续对话中能够无缝继续。

对话历史：
${历史文本}

请直接输出摘要内容，不要加"摘要:"等前缀。`;

    // 调用 AI 生成摘要（不走工具调用，纯文本请求）
    const 消息列表 = [
      { role: 'system', content: '你是一个对话摘要助手，负责将对话历史压缩为简洁但完整的摘要，保留所有关键信息。' },
      { role: 'user', content: 压缩提示词 }
    ];

    const 结果 = await window.调用API(消息列表, 0, null, 0); // 调用轮次=0, 不允许工具调用
    const 摘要内容 = typeof 结果 === 'string' ? 结果 : (结果.content || '');

    if (!摘要内容) {
      window.移除加载消息?.(加载元素);
      window.添加消息到界面?.('助理', '❌ 压缩失败：AI 未返回摘要内容');
      return;
    }

    // 保存摘要到文件
    const 存储 = window.获取存储?.();
    const 智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';

    if (存储) {
      const 文件路径 = `agents/${智能体ID}/对话历史/${当前会话ID}_summaries.json`;
      let 摘要数据 = { summaries: [] };
      try {
        if (await 存储.文件存在(文件路径)) {
          摘要数据 = JSON.parse(await 存储.读文件(文件路径));
        }
      } catch (e) { 摘要数据 = { summaries: [] }; }

      const 原始消息数 = 当前对话历史.length;
      摘要数据.summaries.push({
        timestamp: new Date().toISOString(),
        originalMessageCount: 原始消息数,
        summary: 摘要内容,
        tokenUsage: window.上次Token用量
      });

      await 存储.写文件(文件路径, JSON.stringify(摘要数据, null, 2));
      console.log(`[压缩] 摘要已保存，原始 ${原始消息数} 条 → 1 条摘要`);
    }

    const 压缩前消息数 = 当前对话历史.length;
    // 替换内存中的对话历史为摘要
    const _compTs = new Date().toISOString();
    当前对话历史 = [
      { id: crypto.randomUUID(), role: 'user', content: '[对话摘要]', timestamp: _compTs },
      { id: crypto.randomUUID(), role: 'assistant', content: 摘要内容, timestamp: _compTs }
    ];

    // 更新对话文件的 messages（在原始文件末尾追加摘要标记）
    if (存储) {
      const 文件路径 = `agents/${智能体ID}/对话历史/${当前会话ID}.json`;
      try {
        if (await 存储.文件存在(文件路径)) {
          let 数据 = JSON.parse(await 存储.读文件(文件路径));
          // 标记压缩点
          数据.messages.push({
            role: 'system',
            content: `[上下文压缩] ${压缩前消息数} 条消息已压缩为摘要`,
            timestamp: new Date().toISOString(),
            isCompressionMarker: true
          });
          数据.messages.push(
            { id: crypto.randomUUID(), role: 'user', content: '[对话摘要]', timestamp: new Date().toISOString() },
            { id: crypto.randomUUID(), role: 'assistant', content: 摘要内容, timestamp: new Date().toISOString() }
          );
          await 存储.写文件(文件路径, JSON.stringify(数据, null, 2));
        }
      } catch (e) { console.warn('保存压缩标记失败', e); }
    }

    // 更新 UI
    window.移除加载消息?.(加载元素);
    window.添加消息到界面?.('助理', `✅ 对话历史已压缩\n\n📝 摘要：${摘要内容}\n\n从现在起，AI 将基于此摘要继续对话。`);

    // 重置 token 计数
    window.上次Token用量 = null;
    更新上下文占用率();

  } catch (错误) {
    window.移除加载消息?.(加载元素);
    window.添加消息到界面?.('助理', '❌ 压缩失败：' + (错误.message || '未知错误'));
    console.error('上下文压缩失败', 错误);
  }
}

window.执行上下文压缩 = 执行上下文压缩;

// ========== 偏好捕捉与对话后处理 ==========

/**
 * 偏好信号检测：判断用户输入是否包含纠错/偏好/习惯类信号
 * 返回匹配的偏好信息对象，或 null（无信号）
 */
function 检测偏好信号(用户输入) {
  // 明确偏好/纠错/习惯信号
  const 信号模式 = [
    // 将来类："以后都...", "以后叫我...", "之后都..."
    { regex: /以后[都叫称呼用请](.{1,30})/i, type: 'naming' },
    { regex: /以后(都|就|请|要)(.{1,20})/i, type: 'habit' },
    // 纠错类："不对，...", "别...", "不是...", "应该..."
    { regex: /不对[，,，]?[，]*([^，。！\n]{4,})/i, type: 'correction' },
    { regex: /(别|不要|别再)(.{2,20})/i, type: 'correction' },
    { regex: /应该([^，。！\n]{4,})/i, type: 'guideline' },
    // 称呼类："叫我...", "叫我的...", "称呼我..."
    { regex: /(叫我|叫我的|称呼我|喊我|怎么称呼)(.{1,15})/i, type: 'naming' },
    // 格式偏好："格式要...", "保持...", "用...风格"
    { regex: /(格式|风格|方式|习惯)[都就要请](.{2,20})/i, type: 'style' },
    // 否定旧模式："我不喜欢...", "别给我...", "不要..."
    { regex: /我不喜欢([^，。！\n]{3,})/i, type: 'anti-preference' },
    { regex: /(别给|别用|别发)([^，。！\n]{3,})/i, type: 'anti-preference' },
    // 记住类："记住...", "记一下...", "别忘了..."
    { regex: /(记住|记一下|别忘了|记好)(.{2,30})/i, type: 'reminder' },
  ];

  for (const pattern of 信号模式) {
    const match = 用户输入.match(pattern.regex);
    if (match) {
      return {
        type: pattern.type,
        text: match[1] || match[2],
        full: match[0]
      };
    }
  }

  return null;
}

/**
 * 对话后处理：在 AI 回复完成后执行
 * - 检测偏好信号 → 写入 AI使用说明书 备忘录
 * - Karpathy 式知识库：检测值不值得整理的信息 → 写入 📥 待整理
 * - 后续可扩展：会话复盘、经验提取等
 */
async function 对话后处理(用户输入, AI回复) {
  try {
    // === 偏好捕捉 ===
    const 信号 = 检测偏好信号(用户输入);
    if (信号) {
      console.log('[后处理] 检测到偏好信号:', 信号);
      await 写入偏好说明书(信号, 用户输入);
    }

    // === Karpathy 式知识库：对话摘要自动记录到 📥 待整理 ===
    // 如果本轮 AI 已通过工具写入备忘录，跳过待整理（避免重复）
    if (!_本轮已写入备忘录 && AI回复 && AI回复.length > 80 && !AI回复.startsWith('❌')) {
      // 同步等待待整理完成，避免人物关系/标记重置的时序问题
      try { await 写入待整理(用户输入, AI回复); }
      catch (e) { console.warn('[待整理] 写入失败:', e); }
    }

    // === 人物关系自动识别（类别聚合版） ===
    检测并记录人物关系显式(用户输入, AI回复).catch(e => console.warn('[人物关系] 处理失败:', e));

    // === 重置写入标记 ===
    _本轮已写入备忘录 = false;

    // === 自动提取记忆（每5次对话自动跑一次智能提取） ===
    // 若本轮AI已通过工具写入备忘录，将_本轮已写入备忘录设为true。当前策略：写入待整理会检查此标记跳过
    _对话计数器++;
    if (_对话计数器 >= 5 && window.智能提取记忆) {
      _对话计数器 = 0;
      window.智能提取记忆().catch(e => console.warn('[自动提取] 失败:', e));
    }

    // === 会话数据更新 ===
    // 更新当前会话的最后一条消息摘要
    const 当前智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    const 列表 = 所有会话列表[当前智能体ID];
    if (列表) {
      const 会话 = 列表.find(s => s.id === 当前会话ID);
      if (会话) {
        // 如果会话名称还是自动生成的默认时间戳名，且历史累积了，尝试用第一句用户输入命名
        if (!会话._已重命名 && 当前对话历史.length <= 2) {
          const 名称候选 = 用户输入.trim().slice(0, 16);
          if (名称候选.length >= 2) {
            会话.名称 = 名称候选;
            会话._已重命名 = true;
            保存会话列表ToStorage(当前智能体ID, 列表);
            渲染会话列表();
          }
        }
      }
    }
  } catch (错误) {
    console.warn('[后处理] 执行失败:', 错误);
  }
}

/**
 * Karpathy 式知识库：将对话摘要写入 📥 待整理 文件夹
 * 每次对话后自动执行，不等待、不阻塞界面
 * 写入内容：AI 回复的前 300 字摘要 + 相关标签 + 用户原始输入
 * 同一次会话内合并写入同一条待整理条目，避免碎片化
 */
let _待整理会话缓存 = null; // { sessionId, memoId, 条数 }
let _对话计数器 = 0; // 自动提取记忆计数器，每5次触发一次
let _本轮已写入备忘录 = false;
// 会话概览缓存（惰性刷新，避免每次发送消息都重新构造）
let _会话概览缓存 = null; // { 文本, 时间戳 }

async function 写入待整理(用户输入, AI回复) {
  const manager = window.备忘录管理器;
  if (!manager) return;

  // 去重检测：如果本轮 AI 已通过工具写入备忘录，跳过
  if (_本轮已写入备忘录) return;

  // 去重检测：检查最近5条非删除备忘录的内容相似度
  try {
    const 所有备忘录 = await manager.getAllMemos();
    const 近期待整理 = 所有备忘录
      .filter(m => m.文件夹 === '📥 待整理' && !m.已删除)
      .sort((a, b) => new Date(b.更新时间||b.创建时间) - new Date(a.更新时间||a.创建时间))
      .slice(0, 5);
    const 当前摘要 = (AI回复 || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, 100);
    for (const 条目 of 近期待整理) {
      const 条目内容 = (条目.纯文本内容 || 条目.内容 || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      // 用关键词交并比替代逐字匹配
      const 提取关键词 = (文本) => {
        const 词集 = new Set();
        const 候选 = 文本.match(/[^\s，。！？、；：""''（）\(\)\[\]【】《》\d]{2,}/g) || [];
        const 排序 = 候选.filter(w => w.length >= 2).sort((a,b) => b.length - a.length).slice(0, 6);
        排序.forEach(w => 词集.add(w));
        return 词集;
      };
      const 目标关键词 = 提取关键词(当前摘要);
      const 条目关键词 = 提取关键词(条目内容.slice(0, 200));
      if (目标关键词.size > 0 && 条目关键词.size > 0) {
        const 交集 = [...目标关键词].filter(w => 条目关键词.has(w)).length;
        const 并集 = 目标关键词.size + 条目关键词.size - 交集;
        const 相似度 = 并集 > 0 ? 交集 / 并集 : 0;
        if (相似度 > 0.5) {
          console.log('[待整理] 跳过重复条目，与已有待整理相似度', 相似度.toFixed(2));
          return;
        }
      }
    }
  } catch (e) {
    console.warn('[待整理] 去重检测失败:', e);
  }

  // 确保 📥 待整理 文件夹存在
  const 所有文件夹 = window._获取所有文件夹列表?.() || [];
  if (!所有文件夹.some(f => f.名称 === '📥 待整理')) {
    if (window._创建文件夹) window._创建文件夹('📥 待整理', null);
  }

  // 从 AI 回复中提取摘要（取前 200 字，去掉末尾截断感）
  function 提取摘要(html) {
    let text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length <= 200) return text;
    return text.slice(0, 197) + '...';
  }

  // 提取用户输入中的关键话题词
  function 提取话题(输入) {
    // 取第一句句首重要词汇作为话题
    const 首句 = 输入.split(/[。！？\n]/)[0] || 输入;
    // 去掉常见提问词
    const 清洗 = 首句.replace(/^(请问|帮我|教教|告诉|解释|什么是|怎么|如何|能不能|可以|我想|我要|你知道)/, '').trim();
    return 清洗.slice(0, 20) || '对话记录';
  }

  try {
    const 当前AgentID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    const 摘要 = 提取摘要(AI回复);
    const 话题 = 提取话题(用户输入);
    const 时间戳 = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    
    // 判断是否应该合并到同会话的上一条待整理
    if (_待整理会话缓存 && _待整理会话缓存.sessionId === 当前会话ID) {
      // 同一会话：追加到已有待整理条目
      const 现有 = await manager.getMemo(_待整理会话缓存.memoId);
      if (现有) {
        _待整理会话缓存.条数++;
        const 追加内容 = `\n\n---\n**${时间戳}** ${话题}\n${摘要}`;
        await manager.updateMemo(现有.id, {
          内容: (现有.内容 || '') + 追加内容,
          更新时间: new Date().toISOString()
        });
        // 更新标题反映轮次计数
        const 新标题 = 现有.标题.replace(/\[\d+轮\]/, `[${_待整理会话缓存.条数}轮]`);
        if (新标题 !== 现有.标题) {
          await manager.updateMemo(现有.id, { 标题: 新标题 });
        }
        return;
      }
    }

    // 新建一条待整理条目
    const 标题文本 = `[📥] ${话题} [1轮]`;
    const 内容文本 = `**时间**：${时间戳}\n**话题**：${话题}\n**用户**：${用户输入.slice(0, 150)}${用户输入.length > 150 ? '...' : ''}\n\n**AI 回复摘要**：\n${摘要}\n\n---\n*📌 这是自动生成的待整理条目。如需整理到知识库，请说「整理到知识库」或让 AI 调用整理功能。*`;

    const 新建 = await manager.createMemo({
      标题: 标题文本,
      内容: 内容文本,
      文件夹: '📥 待整理',
      标签: ['待整理'],
      创建时间: new Date().toISOString(),
      更新时间: new Date().toISOString()
    });

    _待整理会话缓存 = { sessionId: 当前会话ID, memoId: 新建.id, 条数: 1 };
    _本轮已写入备忘录 = true;
    console.log('[待整理] 已创建待整理条目:', 新建.id, 标题文本);

  } catch (错误) {
    console.warn('[待整理] 写入失败:', 错误);
  }
}

/**
 * 将用户偏好写入「AI使用说明书」备忘录
 * 此备忘录固定存放在 "系统" 文件夹下，名称永远为 "AI使用说明书"
 * 读取时用 query_memos 按文件夹筛选
 */
async function 写入偏好说明书(信号, 用户输入) {
  // 确定备忘录管理器
  if (!window.备忘录管理器) {
    console.warn('[说明书] 备忘录管理器未初始化，跳过写入');
    return;
  }

  // 组装偏好条目
  let 条目文本 = '';
  const 时间标签 = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  switch (信号.type) {
    case 'naming':
      条目文本 = `称呼偏好（${时间标签}）：用户希望被称作「${信号.text}」`;
      break;
    case 'habit':
      条目文本 = `习惯设定（${时间标签}）：${信号.full}`;
      break;
    case 'correction':
      条目文本 = `纠正反馈（${时间标签}）：${信号.full}`;
      break;
    case 'guideline':
      条目文本 = `行为准则（${时间标签}）：${信号.full}`;
      break;
    case 'style':
      条目文本 = `格式偏好（${时间标签}）：${信号.full}`;
      break;
    case 'anti-preference':
      条目文本 = `否定偏好（${时间标签}）：${信号.full}`;
      break;
    case 'reminder':
      条目文本 = `提醒事项（${时间标签}）：${信号.full}`;
      break;
    default:
      条目文本 = `用户偏好（${时间标签}）：${信号.full}`;
  }

  try {
    // 先查询是否已有 AI使用说明书
    const manager = window.备忘录管理器;
    const allMemos = (typeof manager.getAllMemos === 'function') ? await manager.getAllMemos() : [];
    const 说明书 = allMemos.find(m => m.标题 === 'AI使用说明书');

    if (说明书) {
      // 已有说明书：追加条目
      const 已有内容 = 说明书.内容 || '';
      const 新内容 = 已有内容
        ? 已有内容 + '\n' + 条目文本
        : 条目文本;

      // 精简：只保留最近 50 条偏好（避免无限膨胀）
      let 行数组 = 新内容.split('\n').filter(l => l.trim());
      if (行数组.length > 50) {
        行数组 = 行数组.slice(-50);
      }

      await manager.updateMemo(说明书.id, {
        内容: 行数组.join('\n'),
        更新时间: new Date().toISOString()
      });
      console.log('[说明书] 已追加偏好条目');
    } else {
      // 没有说明书：先确保「系统」文件夹存在
      // 创建新的说明书备忘录
      await manager.createMemo({
        标题: 'AI使用说明书',
        内容: 条目文本,
        文件夹: '系统',
        标签: ['偏好', '配置'],
        创建时间: new Date().toISOString(),
        更新时间: new Date().toISOString()
      });
      console.log('[说明书] 已创建说明书并写入首条偏好');
    }
  } catch (错误) {
    console.warn('[说明书] 写入失败:', 错误);
  }
}

/**
 * 人物关系检测（最优版 V2）：
 * - 仅保留亲属关键词 + 显式指令，不靠正则猜测人名（误匹配率太高）
 * - 其余人名识别交给 AI 工具 record_person（AI 判断谁是人物，不是前端猜）
 * - 串行 await 消除竞态，allMemos 实时更新
 * - 同一关键词 5 分钟内不重复记录
 */
const _人物记录冷却 = new Map(); // 关键词 → 上次记录时间

async function 检测并记录人物关系显式(用户输入, AI回复) {
  const manager = window.备忘录管理器;
  if (!manager || !window._获取所有文件夹列表) return;

  const 合并文本 = 用户输入 + '\n' + (AI回复 || '');
  const 检测结果 = [];

  // === 1. 亲属关系检测（关键词直接匹配，这是用户的真实家人） ===
  const 亲属关键词 = ['老婆', '老公', '女儿', '儿子', '爸爸', '妈妈', '父亲', '母亲',
    '哥哥', '姐姐', '弟弟', '妹妹', '爷爷', '奶奶', '外公', '外婆',
    '舅舅', '阿姨', '姑姑', '叔叔', '侄子', '侄女', '外甥', '外甥女'];
  const 已匹配亲属 = new Set();
  for (const 词 of 亲属关键词) {
    if (合并文本.includes(词) && !已匹配亲属.has(词)) {
      const idx = 合并文本.indexOf(词);
      const 片段 = 合并文本.slice(Math.max(0, idx - 20), idx + 词.length + 10);
      检测结果.push({ 类别: '👨‍👩‍👧‍👦 亲属', 关键词: 词, 上下文: 片段.trim() });
      已匹配亲属.add(词);
    }
  }

  // === 2. 显式指令检测（"记得XX是我XX" / "XX是我老婆"） ===
  const 关系指令 = 合并文本.match(/(?:记得|记住|认识)[：: ]?([^，。！\n]{2,10})(?:是[我他她]的|是我)([^，。！\n]{2,10})/);
  if (关系指令) {
    检测结果.push({ 类别: '👤 人物', 关键词: 关系指令[1] + '-' + 关系指令[2], 上下文: 关系指令[0] });
  }
  // 额外模式："XX是我老婆/同事/朋友"（不用"记得"前缀）
  const 直接关系 = 合并文本.match(/([^，。！\s\n]{2,8})是我(?:的)?(老婆|老公|女儿|儿子|同事|同学|朋友|领导|老板|邻居)/);
  if (直接关系) {
    检测结果.push({ 类别: '👤 人物', 关键词: 直接关系[1] + '-' + 直接关系[2], 上下文: 直接关系[0] });
  }

  if (检测结果.length === 0) return;

  // === 冷却过滤：同一关键词 5 分钟内不重复 ===
  const now = Date.now();
  const 冷却结果 = 检测结果.filter(项 => {
    const key = 项.类别 + ':' + 项.关键词;
    const last = _人物记录冷却.get(key) || 0;
    if (now - last < 5 * 60 * 1000) return false;
    _人物记录冷却.set(key, now);
    return true;
  });
  if (冷却结果.length === 0) return;

  // === 确保 📇 人物关系 文件夹存在 ===
  const 所有文件夹 = window._获取所有文件夹列表() || [];
  if (!所有文件夹.some(f => f.名称 === '📇 人物关系')) {
    if (window._创建文件夹) window._创建文件夹('📇 人物关系', null);
  }

  // === 串行保存（消除竞态） ===
  const 时间戳 = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  let allMemos = await manager.getAllMemos();

  for (const 已检测 of 冷却结果) {
    const 类别标题 = `[${已检测.类别}] 人物关系`;
    const 现有 = allMemos.find(m => m.文件夹 === '📇 人物关系' && m.标题 === 类别标题);

    // 检查是否已有相同关键词（防追加重复）
    const 记录行 = `- ${时间戳}: ${已检测.关键词}（${已检测.上下文}）`;
    if (现有 && (现有.内容 || '').includes(已检测.关键词)) {
      console.log('[人物关系] 已存在，跳过:', 已检测.关键词);
      continue;
    }

    if (现有) {
      const 新内容 = (现有.内容 || '') + '\n' + 记录行;
      await manager.updateMemo(现有.id, { 内容: 新内容 });
      现有.内容 = 新内容; // 更新本地缓存
    } else {
      const 新备忘录 = await manager.createMemo({
        标题: 类别标题,
        内容: `## 人物关系记录\n\n${记录行}`,
        文件夹: '📇 人物关系',
        标签: ['人物关系'],
        创建时间: new Date().toISOString(),
        更新时间: new Date().toISOString()
      });
      if (新备忘录) allMemos.push(新备忘录); // 推入本地缓存，消除竞态
    }
    console.log('[人物关系] 已记录:', 已检测.关键词);
  }
}

window.检测并记录人物关系显式 = 检测并记录人物关系显式;


// ========== 核心：发送消息 ==========

/**
 * 发送消息。
 * 消息列表结构：[system(完整提示词), ...history, user(本次输入)]
 * 所有关于"该不该查记忆"、"该记什么"的问题，由 AI 自主判断。
 */
let _发送中 = false; // 防重复提交锁

async function 发送消息(用户输入) {
  if (!用户输入.trim()) return;
  // 防重复提交：检查并立即置位
  if (_发送中) { console.warn('[发送消息] 上一轮尚未完成，忽略重复请求'); return; }
  _发送中 = true;

  // 自动创建会话（兜底：如果还没有会话，但走到发送消息说明应该新建了）
  const 当前AgentID = window.当前智能体ID ? window.当前智能体ID() : 'default';
  if (!所有会话列表[当前AgentID] || 所有会话列表[当前AgentID].length === 0) {
    const 新会话ID = 'session_' + Date.now();
    const 时间戳 = new Date();
    const 日期文本 = 时间戳.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    const 时文本 = 时间戳.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    // 记录 parent_session_id：取最近一条会话作为父会话（构成血缘链）
    const 上一会话 = 所有会话列表[当前AgentID]?.length > 0 ? 所有会话列表[当前AgentID][0] : null;
    所有会话列表[当前AgentID] = [{ 
      id: 新会话ID, 
      名称: `${日期文本} ${时文本}`, 
      最后活跃时间: Date.now(),
      parent_session_id: 上一会话?.id || null,
      首条摘要: ''
    }];
    当前会话ID = 新会话ID;
    保存会话列表ToStorage(当前AgentID, 所有会话列表[当前AgentID]);
    渲染会话列表();
    window.清空对话历史?.();
  }

  // 处理文件上传
  let 完整用户输入 = 用户输入;
  if (window.获取当前上传文件) {
    const 文件数据 = window.获取当前上传文件();
    if (文件数据) {
      完整用户输入 = `用户上传了文件：【${文件数据.文件名}】\n文件内容如下：\n\`\`\`\n${文件数据.内容}\n\`\`\`\n\n${用户输入}`;
      window.清除当前上传文件();
    }
  }

  添加消息到界面('用户', 用户输入);
  document.getElementById('用户输入框').value = '';

  const 加载元素 = 添加临时加载消息();
  let AI回复 = '';
  let 思考内容 = '';

  try {
    // 构建消息列表
    const 系统提示词 = await 获取系统提示词(用户输入);
    const 消息列表 = [
      { role: 'system', content: 系统提示词 },
      ...当前对话历史,
      { role: 'user', content: 完整用户输入 }
    ];

    console.log(`[发送消息] 历史条数: ${当前对话历史.length}，总消息数: ${消息列表.length}`);

    const 启用流式 = window.全局设置?.启用流式输出;

    // 状态回调：把真实进度显示在加载区域
    const 状态回调 = (状态文本) => 更新加载状态(状态文本);

    // 在 try 作用域顶层声明 API 返回结果，避免 if-else 块级作用域问题
    let 本轮API返回结果 = null;

    // 函数调用（工具）必须走非流式，流式不支持 tool_calls
    const 启用函数调用 = window.全局设置?.启用函数调用 !== false;
    if (启用流式 && window.调用API流式 && !启用函数调用) {
      // ===== 流式输出 =====
      if (typeof window.调用API流式 !== 'function') {
        移除加载消息(加载元素);
        添加消息到界面('助理', '❌ 发送失败：AI接口未初始化，请刷新页面重试');
        console.error('window.调用API流式 不是函数，当前状态:', typeof window.调用API流式);
        return;
      }
      const 深度思索开关 = document.getElementById('深度思索开关-下拉');
      const 启用深度思索 = 深度思索开关?.checked || false;

      // 创建回复气泡
      const 回复元素 = 创建流式回复气泡(启用深度思索);
      移除加载消息(加载元素);

      本轮API返回结果 = await window.调用API流式(消息列表, (累积内容, 增量块, 类型, 累积思考) => {
        if (类型 === 'thinking') {
          更新思考区域(回复元素, 累积思考);
        } else {
          更新回复区域(回复元素, 累积内容, 累积思考);
        }
      });

      AI回复 = 本轮API返回结果.content || 本轮API返回结果;
      思考内容 = 本轮API返回结果.thinking || '';
      最终化回复气泡(回复元素, AI回复, 思考内容);

      // ===== 语音通话模式：流式输出完成后播报 TTS =====
      if (AI回复 && typeof AI回复 === 'string') {
        if (window.播报通话TTS) {
          window.播报通话TTS(AI回复);
        }
        if (window.添加通话对话) {
          window.添加通话对话('AI', AI回复);
        }
      }

    } else {
      // ===== 非流式输出 =====
      if (typeof window.调用API !== 'function') {
        移除加载消息(加载元素);
        添加消息到界面('助理', '❌ 发送失败：AI接口未初始化，请刷新页面重试');
        console.error('window.调用API 不是函数，当前状态:', typeof window.调用API);
        return;
      }
      本轮API返回结果 = await window.调用API(消息列表, 0, 状态回调);
      移除加载消息(加载元素);

      // 兼容旧格式（string）和新格式（{content, thinking}）
      if (typeof 本轮API返回结果 === 'string') {
        AI回复 = 本轮API返回结果;
      } else {
        AI回复 = 本轮API返回结果.content || '';
        思考内容 = 本轮API返回结果.thinking || '';
      }

      // 有思考内容时，折叠显示
      if (思考内容) {
        添加消息到界面('助理', AI回复, 思考内容);
      } else {
        添加消息到界面('助理', AI回复);
      }
    }

    // ===== 语音通话模式：AI 回复播报 TTS =====
    if (AI回复 && typeof AI回复 === 'string') {
      // 检查是否处于通话模式
      if (window.播报通话TTS) {
        window.播报通话TTS(AI回复);
      }
      // 同时添加到通话对话列表
      if (window.添加通话对话) {
        window.添加通话对话('AI', AI回复);
      }
    }

    // 🔍 真实性校验：如果 AI 回复声明了删除/整理但未调工具，强制重试
    const 本轮工具 = (typeof 本轮API返回结果 !== 'string' && 本轮API返回结果.工具列表) || [];
    if (AI回复 && typeof AI回复 === 'string') {
      真实性校验循环: for (let i = 0; i < 3; i++) {
        if (!/(?:已*删除|已*整理|已调|已调用|实际调用|🗑️|✅.*[删整])/.test(AI回复) ||
            本轮工具.some(t => t === '删除待整理' || t === '整理到知识库')) {
          break 真实性校验循环;
        }
        console.warn('[真实性校验] 第' + (i+1) + '次：AI声明了删除/整理但未调工具，强制重试');
        消息列表.push({ role: 'user', content: '❌ 你说已执行删除/整理，但系统检测到你实际没有调 delete_pending 或 organize_to_knowledge 工具。请重新调用工具，不要说「已删除」「已整理」「已调工具」之类的话——你不调用工具数据就永远不会改变。' });
        消息列表.push({ role: 'assistant', content: AI回复 });
        const 重试结果 = await window.调用API(消息列表, 0, 状态回调);
        if (typeof 重试结果 === 'string') {
          AI回复 = 重试结果;
        } else {
          AI回复 = 重试结果.content || '';
          思考内容 = 重试结果.thinking || '';
        }
        if (思考内容) {
          添加消息到界面('助理', AI回复, 思考内容);
        } else {
          添加消息到界面('助理', AI回复);
        }
      }
      if (/(?:已*删除|已*整理|已调|已调用)/.test(AI回复) &&
          !本轮工具.some(t => t === '删除待整理' || t === '整理到知识库')) {
        console.error('[真实性校验] 重试3次仍失败');
        AI回复 += '\n\n⚠️ 系统检测：你声称已删除但未调工具，请刷新页面重试。';
      }
    }

    // 追加到内存历史
    追加对话历史(完整用户输入, AI回复);

    // 持久化
    if (!获取无痕状态()) {
      await 保存对话历史(当前会话ID, 用户输入, AI回复);
      // 每次发消息后更新最近会话ID，确保刷新后恢复到最后活跃的会话
      try {
        const agentId = window.当前智能体ID ? window.当前智能体ID() : 'default';
        localStorage.setItem('最近会话ID_' + agentId, 当前会话ID);
      } catch (e) { /* localStorage 写入失败不阻塞主流程 */ }
    }

  // === 保存会话首条摘要（用于会话链展示） ===
  const 当前AgentID2 = window.当前智能体ID ? window.当前智能体ID() : 'default';
  const 会话链列表 = 所有会话列表[当前AgentID2];
  if (会话链列表) {
    const 当前会话 = 会话链列表.find(s => s.id === 当前会话ID);
    if (当前会话 && !当前会话.首条摘要 && 用户输入.trim()) {
      当前会话.首条摘要 = 用户输入.trim().slice(0, 40);
      保存会话列表ToStorage(当前AgentID2, 会话链列表);
    }
  }

  // === 对话后处理（异步执行，不阻塞用户体验） ===
  // 偏好捕捉、会话链更新等后台任务
  对话后处理(用户输入, AI回复);

  // === 记忆压缩检查（每10次对话触发一次） ===
  if (window.记忆压缩器 && window.备忘录管理器) {
    (async () => {
      try {
        const 压缩计数器 = parseInt(localStorage.getItem('_compressCounter') || '0', 10);
        const 新计数 = 压缩计数器 + 1;
        localStorage.setItem('_compressCounter', String(新计数));
        if (新计数 >= 10) {
          localStorage.setItem('_compressCounter', '0');
          const 结果 = await window.记忆压缩器.全部压缩(window.备忘录管理器, window.AI记忆管理器);
          if (结果.待整理 + 结果.知识库 + 结果.AI记忆 > 0) {
            console.log('[记忆压缩] 后台自动压缩:', JSON.stringify(结果));
          }
        }
      } catch (e) {
        console.warn('[记忆压缩] 后台触发失败:', e);
      }
    })();
  }

  } catch (错误) {
    移除加载消息(加载元素);
    // 防刷：5秒内同类错误只通知一次
    const 错误键 = 'api_error_' + (错误.message || '').slice(0, 20);
    const 上次通知 = window._错误通知时间?.[错误键] || 0;
    if (Date.now() - 上次通知 > 5000) {
      添加消息到界面('助理', '❌ 发送失败：' + (错误.message || '请检查网络和API配置'));
      if (!window._错误通知时间) window._错误通知时间 = {};
      window._错误通知时间[错误键] = Date.now();
    }
    console.error('消息发送失败', 错误);
  } finally {
    _发送中 = false; // 无论成功失败都清锁
  }
}

// ========== 系统提示词构建 ==========

/**
 * 构建系统提示词（全部来自配置文件，代码零业务逻辑）。
 * 组成：全局宪法 + 智能体设定 + 记忆管理规则
 */
async function 获取系统提示词(用户输入 = '') {
  let 当前用户输入 = 用户输入;
  const 部分 = [];

  // 1. 全局宪法（暂未启用，未来可通过 IndexedDB 存储全局记忆宪法.md 实现动态规则）

  // 2. 智能体设定（名字、性格、行为规则）
  try {
    const 系统提示词 = window.获取当前系统提示词 ? window.获取当前系统提示词() : '';
    if (系统提示词) 部分.push(系统提示词);
  } catch (e) { /* 无设定则跳过 */ }

  // 2.1 当前身份声明：确保 AI 知道自己的名字（即使 system.md 中名字过时）
  try {
    const 当前名字 = window.当前智能体名 ? window.当前智能体名() : '';
    if (当前名字 && 当前名字 !== 'default') {
      部分.push(`## 当前身份\n你的名字是「${当前名字}」。在对话中始终以「${当前名字}」自称。`);
    }
  } catch (e) { /* 忽略 */ }

  // 2.15 最高意志设定注入：从 agent.json.plugin 读取核心设定，优先级高于 system.md
  try {
    const 智能体配置 = window.获取当前智能体配置?.();
    const 插件 = 智能体配置?.plugin;
    if (插件) {
      const 设定部分 = [];
      if (插件.core_identity) 设定部分.push(`## 核心身份\n${插件.core_identity}`);
      if (插件.tone_requirement) 设定部分.push(`## 语气要求\n${插件.tone_requirement}`);
      if (插件.output_rules?.length) 设定部分.push(`## 输出规则\n- ${插件.output_rules.join('\n- ')}`);
      if (插件.taboo_rules?.length) 设定部分.push(`## 禁忌规则\n- ${插件.taboo_rules.join('\n- ')}`);
      if (设定部分.length > 0) {
        const 标记 = (typeof window._设定刚更新 !== 'undefined' && window._设定刚更新 === true)
          ? '（⚠️ 用户刚刚修改了你的设定，以下是最新的最高意志，覆盖一切旧信息）\n\n'
          : '';
        部分.push(`## 用户为你设定的核心规则（最高意志，优先级高于一切）\n${标记}${设定部分.join('\n\n')}`);
      }
    }
  } catch (e) { /* 无配置则跳过 */ }

  // 2.2 系统运行状态注入：让 AI 感知界面配置和使用统计
  try {
    const 状态 = [];
    
    // 联网搜索状态
    const 联网开关 = document.getElementById('联网搜索开关');
    const 联网已开 = 联网开关 && 联网开关.checked;
    const 百度Key = (window.全局设置 && window.全局设置.百度搜索密钥) || 
                    localStorage.getItem('百度搜索密钥') || '';
    if (联网已开 && 百度Key) {
      状态.push('联网搜索：已开启，百度 API Key 已配置（可用）');
    } else if (联网已开 && !百度Key) {
      状态.push('联网搜索：开关已打开，但百度 API Key 未配置（不可用）');
    } else if (!联网已开 && 百度Key) {
      状态.push('联网搜索：已配置百度 API Key，但开关未打开（不可用）');
    } else {
      状态.push('联网搜索：未开启');
    }
    
    // 使用统计（从 localStorage 读取计数）
    const 联网搜索次数 = parseInt(localStorage.getItem('_联网搜索计数') || '0');
    const 备忘录打开次数 = parseInt(localStorage.getItem('_备忘录打开计数') || '0');
    const 主题切换次数 = parseInt(localStorage.getItem('_主题切换计数') || '0');
    const 对话次数 = window.AI记忆管理器?.用户画像?.交互历史?.对话次数 || 0;
    if (对话次数 > 0) 状态.push(`对话总次数：${对话次数} 次`);
    if (联网搜索次数 > 0) 状态.push(`联网搜索已使用：${联网搜索次数} 次`);
    if (备忘录打开次数 > 0) 状态.push(`备忘录浏览次数：${备忘录打开次数} 次`);
    if (主题切换次数 > 0) 状态.push(`主题切换次数：${主题切换次数} 次`);
    
    // 当前界面状态
    const 当前主题 = (window.全局设置 && window.全局设置.当前主题) || '默认主题';
    状态.push(`当前主题：${当前主题}`);
    const 当前会话名称 = (window.当前会话 && window.当前会话.名称) || '未命名会话';
    状态.push(`当前会话：${当前会话名称}`);
    
    部分.push(`## 当前状态
（仅供感知，无需提及）
${状态.join('\n')}`);
  } catch (e) {
    console.log('[系统提示词] 系统状态注入跳过:', e.message);
  }

  // 2.15 智能体专属文件夹声明
  try {
    const 当前名字 = window.当前智能体名 ? window.当前智能体名() : '';
    const 当前ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    if (当前名字 && 当前ID !== 'default') {
      部分.push(`## 你的专属文件夹\n你有一个与你同名的文件夹「${当前名字}」，这是你的专属空间。你可以在里面自由创建、编辑备忘录，无需任何额外授权。建议优先将自己的内容存放到「${当前名字}」文件夹中。`);
    }
  } catch (e) { /* 忽略 */ }

  // 2.5 用户画像摘要（从 AI记忆管理器 获取）
  try {
    const 管理器 = window.AI记忆管理器;
    if (管理器 && typeof 管理器.获取用户画像摘要 === 'function') {
      const 画像 = 管理器.获取用户画像摘要();
      if (画像 && !画像.includes('暂无用户信息')) {
        部分.push(`## 用户画像（当前了解的用户信息）
${画像}`);
      }
    }
  } catch (e) { /* 无画像则跳过 */ }

  // 2.7 主动记忆检索注入：基于当前用户消息（优先使用参数传入的），从 AI记忆管理器 检索相关记忆
  try {
    const 管理器 = window.AI记忆管理器;
    if (管理器 && typeof 管理器.searchMemories === 'function') {
      // 优先使用参数传入的用户输入（最新消息），否则从对话历史中找最近一条 user 消息
      let 用户消息 = 当前用户输入;
      if (!用户消息) {
        const 历史 = window.当前对话历史 || [];
        for (let i = 历史.length - 1; i >= 0; i--) {
          if (历史[i].角色 === 'user') {
            // 取纯文本版本，去掉可能的 UI 格式标记
            用户消息 = (历史[i].内容 || '').replace(/<[^>]+>/g, '').trim();
            break;
          }
        }
      }

      const 检索结果 = await 管理器.searchMemories({
        关键词: 用户消息,
        条数: 5,  // 多取几条，后面用门槛筛选
        最小重要性: 4,
        时间偏差: 0.6,
        类型: ['preference', 'fact', 'event']
      });

      // 相关性门槛：
      // - 短词命中（2-3字）= 强信号，直接通过
      // - 纯单字命中 = 弱信号，至少2个不同单字命中才通过
      // - 避免单个常见字（如'吃'、'喝'）碰巧匹配导致噪音
      const 相关记忆 = (检索结果 || []).filter(m => {
        const 得分 = m._检索得分 || 0;
        if (得分 >= 3) return true;   // 有短词命中（3分起步）
        if (得分 >= 2) return true;   // 至少2个单字命中
        return false;                  // 仅1个单字=噪声
      });
      console.log('[记忆门槛] 通过门槛:', 相关记忆.length, '条');

      if (相关记忆.length > 0) {
        // 保存本次注入的记忆列表，供界面渲染引用标记
        window._本次注入记忆 = 相关记忆.slice(0, 3).map(m => ({
          id: m.id || m.id,
          内容: m.内容,
          类型: m.类型 || ''
        }));

        部分.push(`## 用户过往信息（你可能需要参考的历史记忆）
以下是你与用户过往交互中记录的与当前话题可能相关的信息。
${相关记忆.slice(0, 3).map((m, i) => `- ${m.内容}`).join('\n')}`);
      }
    }
  } catch (e) {
    console.log('[系统提示词] 记忆检索注入跳过:', e.message);
  }

  // 2.55 其他会话概览（跨会话感知：静态层 - 标题+首条摘要+时间衰减）
  // 使用惰性缓存：会话列表变更后由保存/切换会话时刷新缓存
  try {
    const 当前AgentID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    const 会话列表 = 所有会话列表[当前AgentID] || [];
    // 缓存命中考量：5 秒内且当前AgentID一致
    const 缓存有效 = _会话概览缓存 && _会话概览缓存.agentID === 当前AgentID &&
      _会话概览缓存.sessionCount === 会话列表.length &&
      (Date.now() - _会话概览缓存.timestamp) < 5000;
    if (!缓存有效) {
      // 排除当前会话，取有摘要的会话，按时间倒序
      const 其他会话 = 会话列表
        .filter(s => s.id !== 当前会话ID && s.首条摘要)
        .sort((a, b) => (b.最后活跃时间 || 0) - (a.最后活跃时间 || 0));
      let 概览文本 = '';
      if (其他会话.length > 0) {
        概览文本 = 其他会话.slice(0, 10).map(s => {
          const 天数差 = Math.floor((Date.now() - (s.最后活跃时间 || 0)) / 86400000);
          const 时效标注 = 天数差 === 0 ? '今天' : 天数差 === 1 ? '昨天' : 天数差 < 7 ? `${天数差}天前` : `${Math.floor(天数差 / 7)}周前`;
          const 显示名 = (s.名称 || '').trim() || '未命名会话';
          return `- [${时效标注}] ${显示名}：${s.首条摘要}`;
        }).join('\n');
      }
      _会话概览缓存 = { text: 概览文本, agentID: 当前AgentID, sessionCount: 会话列表.length, timestamp: Date.now() };
    }
    if (_会话概览缓存.text) {
      部分.push(`## 其他会话概览（你可能需要参考的跨会话上下文）\n以下是用户与你的其他对话摘要，当用户提到“之前说过”“上次聊过”时可能需要参考：\n${_会话概览缓存.text}`);
    }
  } catch (e) {
    console.log('[系统提示词] 会话概览注入跳过:', e.message);
  }

  // 2.59 人物关系映射表注入（用户自定义关系词→类别，让AI识别时自动归类）
  try {
    const 映射 = window.获取用户关系映射 ? window.获取用户关系映射() : {};
    const 映射条目 = Object.entries(映射);
    if (映射条目.length > 0) {
      const 映射文本 = 映射条目.map(([词, 类别]) => `- ${词} → ${类别}`).join('\n');
      部分.push(`## 人物关系映射表（用户自定义）
当对话中出现以下关键词时，应将其视为对应的人物关系类别。请使用 ${'`'}record_person${'`'} 工具记录时，${'`'}category${'`'} 参数使用右侧标注的类别。
${映射文本}`);
    }
  } catch (e) {
    console.log('[系统提示词] 关系映射注入跳过:', e.message);
  }

  // 2.6 AI使用说明书（用户累积的偏好、习惯、纠错记录）
  // 这个备忘录在用户每次表达偏好/纠错时自动追加，让 AI 跨会话记住用户习惯
  try {
    const manager = window.备忘录管理器;
    if (manager && typeof manager.getAllMemos === 'function') {
      const allMemos = await manager.getAllMemos();
      const 说明书 = allMemos.find(m => m.标题 === 'AI使用说明书');
      if (说明书 && 说明书.内容 && 说明书.内容.trim()) {
        部分.push(`## 用户偏好记录（AI使用说明书）
以下是你已了解的用户偏好、习惯和纠错记录，每次对话开始时自动加载：
${说明书.内容}`);
      }
    }
  } catch (e) { /* 无说明书则跳过 */ }

  // 2.61 用户重要提醒/待办注入（备忘录中高优先级含日期条目）
  // 让 AI 每次对话都能看到用户的活跃提醒，不依赖主动搜索备忘录
  try {
    const manager = window.备忘录管理器;
    if (manager && typeof manager.getAllMemos === 'function') {
      const allMemos = await manager.getAllMemos();
      const 重要提醒 = [];
      for (const memo of allMemos) {
        // 符合以下任一条件视为重要提醒：
        // 1. 标题或标签含「提醒」「考试」「截止」「ddl」「倒计时」等关键词
        // 2. 重要性标记 >= 8（高优先级）
        // 3. 内容含明确日期格式（YYYY-MM-DD 或 YYYY年M月D日）
        const 标题 = memo.标题 || '';
        const 内容 = memo.内容 || '';
        const 标签 = memo.标签 || [];
        const 重要性 = parseInt(memo.重要性) || 0;
        const 标签文本 = Array.isArray(标签) ? 标签.join(',') : String(标签);
        const 提醒关键词 = ['提醒', '考试', '截止', 'ddl', '倒计时', 'deadline', '到期', '面试', '面试时间', '预约', '会议'];
        const 是提醒 = 提醒关键词.some(k => 标题.includes(k) || 标签文本.includes(k) || 内容.slice(0, 50).includes(k));
        const 是高优先级 = 重要性 >= 8;
        // 检查内容中是否有日期格式
        const 含日期 = /\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?/.test(内容);
        if (是提醒 || 是高优先级 || 含日期) {
          重要提醒.push({
            标题: 标题 || '未命名',
            摘要: 内容.slice(0, 120),
            重要性: 重要性,
            标签: 标签
          });
        }
      }
      if (重要提醒.length > 0) {
        重要提醒.sort((a, b) => b.重要性 - a.重要性);
        const 提醒文本 = 重要提醒.map(r => 
          `- [重要${'★'.repeat(Math.min(r.重要性 || 1, 3))}] ${r.标题}：${r.摘要}`
        ).join('\n');
        部分.push(`## 用户重要提醒（自动加载 — 必须关注）
以下是你已记录的与用户相关的待办事项、考试、截止日等重要提醒，每次对话自动加载。当用户提及其中任何条目时，应当优先利用已有信息给出回应，并在必要时主动提醒用户完成或告知剩余时间。
${提醒文本}`);
      }
    }
  } catch (e) { console.log('[系统提示词] 重要提醒注入跳过:', e.message); }

  // 3. 记忆管理规则（由 AI 自主判断何时查、何时记）
  // 注意：这里只写规则，不写任何具体事实。事实由 AI 自行通过工具获取。
  部分.push(await 获取记忆管理规则());

  // 3.5 技能库注入：自动加载 📚 知识库 中的技能条目
  // 技能是 AI 或用户从过去经验中抽象的可复用处理模式
  try {
    const manager = window.备忘录管理器;
    if (manager && typeof manager.getAllMemos === 'function') {
      const allMemos = await manager.getAllMemos();
      const 技能列表 = allMemos.filter(m => 
        (m.标题 || '').startsWith('[技能]') && 
        (m.标签 || []).includes('技能')
      );
      if (技能列表.length > 0) {
        // 按创建时间倒序，取最近 3 条
        技能列表.sort((a, b) => new Date(b.创建时间 || 0) - new Date(a.创建时间 || 0));
        const 注入技能 = 技能列表.slice(0, 3);
        const 技能文本 = 注入技能.map((s, i) => 
          `### ${s.标题}\n${(s.完整内容 || s.内容 || '(无内容)')}`
        ).join('\n\n');
        if (技能文本) {
          部分.push(`## 当前可复用的技能经验（最近 ${注入技能.length} 条）
这些技能是你或我之前从对话经验中抽象出来的处理模式。当前对话中如果遇到匹配的触发场景，应优先应用这些技能，而不是重新发明解决方案。

${技能文本}`);
        }
      }
    }
  } catch (e) {
    console.log('[系统提示词] 技能注入跳过:', e.message);
  }

  // 2.60 其他智能体设定注入：让 AI 知道还有哪些智能体存在
  // 不依赖 AI 主动调工具，每次对话无条件注入其他智能体的核心设定摘要
  try {
    const 智能体列表 = await window.获取智能体列表?.();
    const 当前ID = window.当前智能体ID?.();
    if (智能体列表 && 当前ID) {
      const 其他 = 智能体列表.filter(a => a.id !== 当前ID);
      if (其他.length > 0) {
        const 摘要 = [];
        for (const 智能体 of 其他) {
          try {
            const 存储 = window.获取存储?.();
            if (!存储) continue;
            const 配置路径 = `agents/${智能体.id}/agent.json`;
            if (!(await 存储.文件存在(配置路径))) continue;
            const 配置 = JSON.parse(await 存储.读文件(配置路径));
            const 插件 = 配置.plugin || {};
            const 身份 = 插件.core_identity || '';
            const 语气 = 插件.tone_requirement || '';
            const 输出 = 插件.output_rules?.slice(0, 3) || [];
            const 行 = [];
            行.push(`- ${智能体.name}${智能体.icon || ''}`);
            if (身份) 行.push(`  核心身份：${身份.substring(0, 200)}`);
            if (语气) 行.push(`  语气要求：${语气}`);
            if (输出.length) 行.push(`  输出规则：${输出.join('；')}`);
            摘要.push(行.join('\n'));
          } catch (e) {/* 跳过读取失败的智能体 */}
        }
        if (摘要.length > 0) {
          部分.push(`## 其他智能体设定概览（你以外还有以下智能体）\n以下是系统中其他智能体的核心设定摘要，了解它们有助于你确认它们的核心身份和职责范围。\n\n${摘要.join('\n\n')}`);
        }
      }
    }
  } catch (e) {
    console.log('[系统提示词] 其他智能体注入跳过:', e.message);
  }

  return 部分.filter(Boolean).join('\n\n');
}

/**
 * 记忆管理规则（由 AI 自主决策）。
 * 这些规则告诉 AI：什么时候该用工具、用什么工具。
 * 修改规则 → 直接对话让 AI 更新智能体设定即可，无需改代码。
 */
async function 获取记忆管理规则() {
  return `
## 你的能力与记忆管理系统

你是 ${window.当前智能体名?.() || 'AI助手'}，可以管理用户的备忘录知识库。

### 核心工具组
- **写入类工具**：${'`'}note${'`'}（新笔记）、${'`'}update_note${'`'}（更新）、${'`'}append_to_note${'`'}（追加）、${'`'}remember${'`'}（记住）、${'`'}create_memo${'`'}（创建备忘录）、${'`'}organize_to_knowledge${'`'}（整理到知识库）
- **查询类工具**：${'`'}read_context${'`'}、${'`'}list_records${'`'}、${'`'}summarize_records${'`'}、${'`'}identify_gaps${'`'}、${'`'}verify_consistency${'`'}、${'`'}query_memos${'`'}、${'`'}read_memos${'`'}
- **记忆管理工具**：${'`'}archive_note${'`'}、${'`'}recall${'`'}、${'`'}compress_memory${'`'}、${'`'}extract_skills${'`'}（技能提取）、${'`'}create_skill${'`'}（技能创建）
- **待整理工具**：${'`'}delete_pending${'`'}（删除待整理）、${'`'}organize_to_knowledge${'`'}（整理到知识库）
- **人物关系工具**：${'`'}record_person${'`'}（记录人物关系，当你识别到对话中出现真实人物时使用）

### 主动知识管理原则
你应该主动管理长期记忆，不等用户指令：
1. **主动记录**：对话中发现有价值信息 → 用 ${'`'}note${'`'} 或 ${'`'}remember${'`'} 记录到知识库，并在回复末尾告知
2. **主动查询**：需要回忆时主动用 ${'`'}read_context${'`'} 或 ${'`'}recall${'`'} 查询已有知识
3. **总结与检查**：定期用 ${'`'}summarize_records${'`'} 和 ${'`'}verify_consistency${'`'} 维护质量
4. **技能提取**：处理完多条待整理后，如果发现可复用的处理模式，调用 ${'`'}create_skill${'`'} 创建技能（标题为 ${'`'}[技能] XXX${'`'}，并打标签「技能」）

### 工具选择速查表
| 场景 | 工具 |
|------|------|
| 记新知识 | ${'`'}note${'`'} 或 ${'`'}remember${'`'} |
| 追加内容 | ${'`'}append_to_note${'`'} |
| 更新已有 | ${'`'}update_note${'`'} |
| 归档旧知识 | ${'`'}archive_note${'`'} |
| 查询记忆 | ${'`'}recall${'`'} 或 ${'`'}read_context${'`'} |
| 检查一致性 | ${'`'}verify_consistency${'`'} |
| 发现缺失 | ${'`'}identify_gaps${'`'} |
| 创建备忘录 | ${'`'}create_memo${'`'}（指定标题、文件夹、标签） |
| 删除待整理 | ${'`'}delete_pending${'`'}（传入 memoIds 数组硬删） |
| 记录人物 | ${'`'}record_person${'`'}（传入姓名、关系、类别、上下文） |
| 压缩记忆 | ${'`'}compress_memory${'`'} |
| 引用回复 | ${'`'}add_reply_citation${'`'} |
| 主题切换 | ${'`'}apply_theme${'`'}、${'`'}create_theme${'`'} |

### 📥 待整理处理流程（铁律）
1. 用户说"待整理" → 用 ${'`'}query_memos${'`'} 查 📥 待整理 文件夹，得到完整列表
2. 用 ${'`'}read_memos${'`'} 最多 8 条/次读取内容
3. **必须做以下之一（选择后立即调用对应工具，不要说自己会做、不要回复"已整理/已删除"之类的话而不调用工具）：**
   - 有价值 → ${'`'}organize_to_knowledge${'`'}（传入 sourceIds 指向被整理的条目ID，系统会自动删除原始待整理条目）
   - 无价值/测试 → ${'`'}delete_pending${'`'}（传入 memoIds 数组，立即硬删除）
4. delete_pending 工具：直接传入 memoIds 数组（如 ${'`'}["43","44","48"]${'`'}），一次性删除多条，**不需要也不允许先确认再执行**
5. **口头回复"已删除""已整理""已调工具"不算执行。** 必须实际调用 delete_pending 或 organize_to_knowledge 工具，系统才会真的删除数据。
`;
}

// ========== 全局导出（供其他模块引用）==========
window.获取系统提示词 = 获取系统提示词;

// ========== 计算上下文占用率 ==========
function 计算上下文占用率() {
  const 消息数 = 当前对话历史.length;
  const 估算token = 消息数 * 300 + 2000;
  const 最大token = 64000;
  const 占用率 = Math.min(100, Math.round((估算token / 最大token) * 100));
  return { 占用率, 消息数, 估算token, 最大token };
}

window.计算上下文占用率 = 计算上下文占用率;

// ========== 保存话题摘要 ==========
async function 保存话题摘要(摘要内容) {
  try {
    const 存储 = 获取存储();
    if (!存储) return;
    const 文件 = `summaries_${当前会话ID}.json`;
    let 摘要数据 = { summaries: [] };
    try {
      const 已有 = await 存储.读文件(文件);
      if (已有) 摘要数据 = JSON.parse(已有);
    } catch (e) { 摘要数据 = { summaries: [] }; }

    摘要数据.summaries.push({
      时间: new Date().toISOString(),
      内容: 摘要内容
    });
    await 存储.写文件(文件, JSON.stringify(摘要数据));
  } catch (e) {
    console.warn('保存话题摘要失败', e);
  }
}

window.保存话题摘要 = 保存话题摘要;

// ========== 压缩对话（AI摘要替换）==========
window.压缩当前对话 = async function() {
  if (当前对话历史.length < 3) {
    window.添加消息到界面?.('助理', '对话太短，不需要压缩');
    return;
  }

  try {
    window.添加消息到界面?.('助理', '正在压缩对话...');

    const 格式化历史 = 当前对话历史.slice(0, -2).map(m =>
      `${m.role === 'user' ? '用户' : '你'}: ${m.content.slice(0, 500)}`
    ).join('\n\n');

    const AI消息列表 = [
      { role: 'system', content: '请将以下对话压缩为一段精炼摘要（200字以内），保留所有关键决策和事实。只输出摘要，不要额外内容。' },
      { role: 'user', content: 格式化历史 }
    ];

    if (typeof window.调用API !== 'function') {
      window.添加消息到界面?.('助理', '❌ 压缩失败：AI接口不可用');
      return;
    }

    const 结果 = await window.调用API(AI消息列表, 0, null, 2);
    const 摘要 = typeof 结果 === 'string' ? 结果 : (结果.content || '');

    if (!摘要 || 摘要.length < 10) {
      window.添加消息到界面?.('助理', '❌ 压缩失败：AI未返回有效摘要');
      return;
    }

    await 保存话题摘要(摘要);

    const 前消息数 = 当前对话历史.length;
    const 最后两条 = 当前对话历史.slice(-2);
    当前对话历史 = [
      ...最后两条,
      { role: 'system', content: `[压缩摘要] ${摘要}` }
    ];

    await 保存对话历史(当前会话ID, null, null);

    console.log(`[压缩] ${前消息数}条 → ${当前对话历史.length}条`);
    window.添加消息到界面?.('助理', `✅ 压缩完成（${前消息数}条 → ${当前对话历史.length}条）`);

  } catch (错误) {
    window.添加消息到界面?.('助理', '❌ 压缩失败：' + (错误.message || '未知错误'));
    console.error('压缩失败', 错误);
  }
};

// ========== 显示压缩对话框 ==========
window.显示压缩对话框 = async function() {
  const { 占用率, 消息数, 估算token } = 计算上下文占用率();

  if (占用率 < 40) {
    window.添加消息到界面?.('助理', `当前占用率 ${占用率}%（${消息数}条消息，约${估算token} tokens），不需要压缩。`);
    return;
  }

  const 遮罩 = document.createElement('div');
  遮罩.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:99998;display:flex;align-items:center;justify-content:center;';

  const 卡片 = document.createElement('div');
  卡片.style.cssText = 'background:var(--卡片背景,#fff);border-radius:12px;padding:20px 24px;box-shadow:0 4px 20px rgba(0,0,0,0.15);text-align:center;min-width:220px;';

  let 颜色 = '#2ecc71';
  if (占用率 >= 80) 颜色 = '#e74c3c';
  else if (占用率 >= 60) 颜色 = '#f39c12';

  卡片.innerHTML = `
    <div style="margin-bottom:8px;font-size:24px;font-weight:bold;color:${颜色};">${占用率}%</div>
    <div style="margin-bottom:12px;font-size:13px;color:#666;">${消息数}条消息 · 约${估算token} tokens</div>
    <div style="margin-bottom:16px;font-size:14px;color:var(--文字色,#333);">超过 40%，建议压缩以释放上下文空间。</div>
    <div style="display:flex;gap:12px;justify-content:center;">
      <button class="取消压缩" style="padding:6px 16px;border:1px solid var(--边框色,#ddd);border-radius:6px;background:var(--卡片背景,#fff);color:var(--文字色,#333);cursor:pointer;">取消</button>
      <button class="确认压缩" style="padding:6px 16px;border:none;border-radius:6px;background:${颜色};color:#fff;cursor:pointer;">压缩对话</button>
    </div>
  `;

  遮罩.appendChild(卡片);
  document.body.appendChild(遮罩);
  if (window._锁定滚动) window._锁定滚动();

  卡片.querySelector('.取消压缩').addEventListener('click', () => { 遮罩.remove(); if (window._解锁滚动) window._解锁滚动(); });
  卡片.querySelector('.确认压缩').addEventListener('click', async () => {
    遮罩.remove();
    if (window._解锁滚动) window._解锁滚动();
    await window.压缩当前对话();
  });
};

// ========== 保存对话历史到存储 ==========
window.保存对话历史 = 保存对话历史;

function 追加对话历史(用户输入, AI回复) {
  const _ts = new Date().toISOString();
  当前对话历史.push(
    { id: crypto.randomUUID(), role: 'user', content: 用户输入, timestamp: _ts },
    { id: crypto.randomUUID(), role: 'assistant', content: AI回复, timestamp: _ts }
  );
  if (当前对话历史.length > 最大历史条数) {
    当前对话历史 = 当前对话历史.slice(-最大历史条数);
  }
}

function 清空对话历史() {
  当前对话历史 = [];
  window.上次Token用量 = null;
  if (window.更新上下文占用率) window.更新上下文占用率();
}

async function 保存对话历史(会话ID, 用户输入, AI回复) {
  if (获取无痕状态()) return;
  try {
    const 存储 = window.获取存储();
    const 智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    const 文件路径 = `agents/${智能体ID}/对话历史/${会话ID}.json`;
    let 数据 = { messages: [] };
    if (await 存储.文件存在(文件路径)) {
      try { 数据 = JSON.parse(await 存储.读文件(文件路径)); } catch (e) { 数据 = { messages: [] }; }
    }
    数据.updatedAt = new Date().toISOString();

    if (用户输入 !== null && AI回复 !== undefined) {
      const _ts = new Date().toISOString();
      数据.messages.push(
        { id: crypto.randomUUID(), role: 'user', content: 用户输入, timestamp: _ts },
        { id: crypto.randomUUID(), role: 'assistant', content: AI回复, timestamp: _ts }
      );
    }
    // [Bug修复] 保存当前 token 用量到对话文件
    if (window.上次Token用量) {
      数据.usage = {
        prompt_tokens: window.上次Token用量.prompt_tokens,
        completion_tokens: window.上次Token用量.completion_tokens,
        total_tokens: window.上次Token用量.total_tokens
      };
    }
    await 存储.写文件(文件路径, JSON.stringify(数据, null, 2));
  } catch (错误) { console.error('保存对话历史失败', 错误); }
}

/**
 * 从 IndexedDB 加载对话历史到内存。
 * 在 初始化.js 中，页面加载完毕后调用此函数。
 */
async function 加载对话历史(会话ID) {
  清空对话历史();
  try {
    const 存储 = window.获取存储();
    const 智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    const 文件路径 = `agents/${智能体ID}/对话历史/${会话ID}.json`;
    if (await 存储.文件存在(文件路径)) {
      const 数据 = JSON.parse(await 存储.读文件(文件路径));
      // 检查是否有消息缺 ID（在过滤前检查，覆盖所有角色）
      const 需要补ID = (数据.messages || []).some(m => !m.id);
      // 先统一补 ID 并写回（一次 I/O，避免重复读文件）
      if (需要补ID && 数据.messages) {
        数据.messages = 数据.messages.map(m => ({
          ...m,
          id: m.id || crypto.randomUUID()
        }));
        存储.写文件(文件路径, JSON.stringify(数据, null, 2)).catch(() => {});
      }
      // 过滤掉压缩标记（isCompressionMarker），只保留 user/assistant 消息
      const 原始消息 = (数据.messages || [])
        .filter(m => m.role !== 'system')
        .map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          ...(m.timestamp ? { timestamp: m.timestamp } : {})
        }));
      当前对话历史 = 原始消息.slice(-最大历史条数);

      // [Bug修复] 恢复该会话的 token 用量（从保存的数据中读取）
      if (数据.usage) {
        window.上次Token用量 = {
          prompt_tokens: 数据.usage.prompt_tokens || 0,
          completion_tokens: 数据.usage.completion_tokens || 0,
          total_tokens: 数据.usage.total_tokens || 0
        };
      }

      console.log(`[对话历史] 已加载 ${当前对话历史.length} 条历史消息`);
    }
    if (window.更新上下文占用率) window.更新上下文占用率();
  } catch (错误) {
    console.warn('加载对话历史失败', 错误);
    清空对话历史();
  }
}

// ========== DOM 裁剪（防止长会话卡顿）==========
const 最大渲染消息数 = 60;

/**
 * 裁剪消息容器，保留最近 N 条消息，在顶部插入折叠提示
 */
function 裁剪消息容器() {
  const 容器 = document.getElementById('消息列表');
  if (!容器) return;
  const 超出 = 容器.children.length - 最大渲染消息数;
  if (超出 <= 0) return;

  for (let i = 0; i < 超出; i++) {
    if (容器.children[0]) 容器.removeChild(容器.children[0]);
  }

  let 提示条 = 容器.querySelector('.folded-notice');
  if (!提示条) {
    提示条 = document.createElement('div');
    提示条.className = 'folded-notice';
    提示条.style.cssText = 'text-align:center; padding:14px 12px; color:#888; font-size:13px; cursor:default; width:100%;';
    容器.prepend(提示条);
  }
  提示条.textContent = `⋯ 以上还有 ${超出} 条消息已折叠 · 需要搜索历史可以问我`;
}

// ========== UI 辅助函数 ==========

function 转义HTML(文本) {
  const div = document.createElement('div');
  div.textContent = 文本;
  return div.innerHTML;
}

function 添加消息到界面(角色, 内容, 思考 = '') {
  const 列表 = document.getElementById('消息列表');
  if (!列表) return;
  const 元素 = document.createElement('div');
  元素.className = `消息 ${角色 === '用户' ? '用户消息' : '助理消息'}`;

  let 思考HTML = '';
  if (思考) {
    const 思考预览 = 思考.length > 150 ? 思考.slice(0, 150) + '...' : 思考;
    思考HTML = `
      <div class="思考区域">
        <div class="思考标题" onclick="this.parentElement.classList.toggle('思考展开');this.querySelector('.思考展开标记').classList.toggle('展开');this.querySelector('.思考预览').style.display=this.querySelector('.思考预览').style.display==='none'?'block':'none';this.querySelector('.思考全文').classList.toggle('展开');">
          <span class="思考图标">🧠</span>
          <span>思考过程</span>
          <span class="思考展开标记">▶</span>
        </div>
        <div class="思考预览">${转义HTML(思考预览).replace(/\n/g, '<br>')}</div>
        <div class="思考全文">${转义HTML(思考).replace(/\n/g, '<br>')}</div>
      </div>`;
  }

  // 给消息编号（user/assistant 分别计数）
  const 角色键 = 角色 === '用户' ? 'user' : 'assistant';
  if (!window._消息计数器) window._消息计数器 = { user: 0, assistant: 0 };
  const 序号 = window._消息计数器[角色键]++;
  元素.dataset.role = 角色键;
  元素.dataset.index = 序号;

  元素.innerHTML = `<div class="消息内容">${转义HTML(内容).replace(/\n/g, '<br>')}</div><div class="消息时间">${new Date().toLocaleTimeString()}</div>`;

  // 记忆引用标记（仅助理消息，且本次有注入记忆）
  if (角色 !== '用户') {
    console.log('[记忆引用] 角色:', 角色, '注入记忆:', window._本次注入记忆 ? window._本次注入记忆.length + '条' : 'null');
  }
  if (角色 !== '用户' && window._本次注入记忆 && window._本次注入记忆.length > 0) {
    const 引用项 = window._本次注入记忆.slice(0, 2).map(m =>
      `<span class="记忆引用标签">💡 ${转义HTML(m.内容.length > 10 ? m.内容.slice(0, 10) + '…' : m.内容)}</span>`
    ).join(' ');
    const 标签 = document.createElement('div');
    标签.className = '记忆引用栏';
    if (window._本次注入记忆.length > 2) {
      标签.innerHTML = `${引用项} <span class="记忆引用更多">+${window._本次注入记忆.length - 2}</span>`;
    } else {
      标签.innerHTML = 引用项;
    }
    元素.appendChild(标签);
    // 每条消息渲染后立即清空，防止缓存污染下一条消息
    window._本次注入记忆 = null;
  }

  列表.appendChild(元素);
  列表.scrollTop = 列表.scrollHeight;
  裁剪消息容器();
}

let 当前加载元素 = null;

function 添加临时加载消息() {
  const 列表 = document.getElementById('消息列表');
  if (!列表) return null;
  const 元素 = document.createElement('div');
  元素.className = '消息 助理消息';
  const 助手名 = (typeof 当前智能体数据 !== 'undefined' && 当前智能体数据?.name) || 'AI';
  元素.innerHTML = `
    <div class="加载状态" style="color:#8b5cf6;font-size:0.85rem;line-height:1.6;">
      <div class="加载日志" style="display:flex;flex-direction:column;gap:2px;"></div>
    </div>`;
  列表.appendChild(元素);
  列表.scrollTop = 列表.scrollHeight;
  当前加载元素 = 元素;
  return 元素;
}

function 更新加载状态(文本) {
  if (!当前加载元素) return;
  const 日志区 = 当前加载元素.querySelector('.加载日志');
  if (!日志区) return;
  const 行 = document.createElement('div');
  行.textContent = 文本;
  // 思考类灰色，工具类高亮
  if (文本.startsWith('🔍') || 文本.startsWith('✅')) {
    行.style.color = '#6366f1';
    行.style.fontWeight = '500';
  } else if (文本.startsWith('✍️')) {
    行.style.color = '#10b981';
  }
  日志区.appendChild(行);
  const 列表 = document.getElementById('消息列表');
  if (列表) 列表.scrollTop = 列表.scrollHeight;
}

function 移除加载消息(特定元素 = null) {
  if (特定元素?.parentNode) 特定元素.remove();
  if (当前加载元素?.parentNode) 当前加载元素.remove();
  当前加载元素 = null;
}

// ========== 流式输出 UI ==========

function 创建流式回复气泡(启用深度思索) {
  const 列表 = document.getElementById('消息列表');
  if (!列表) return null;
  const 元素 = document.createElement('div');
  元素.className = '消息 助理消息';
  if (!window._消息计数器) window._消息计数器 = { user: 0, assistant: 0 };
  元素.dataset.role = 'assistant';
  元素.dataset.index = window._消息计数器.assistant++;
  元素.innerHTML = `
    ${启用深度思索 ? '<div class="流式思考区域"><div class="思考标题"><span class="思考图标">🧠</span><span>思考中</span><span class="思考省略号"></span><span class="思考脉动指示器"></span></div><div class="思考内容"></div></div>' : ''}
    <div class="流式回复内容 消息内容"></div>
    `;
  列表.appendChild(元素);
  列表.scrollTop = 列表.scrollHeight;

  // 省略号动画
  const 省略号 = 元素.querySelector('.流式思考区域 .思考省略号');
  if (省略号) {
    let c = 0;
    元素._思考动画 = setInterval(() => {
      c = (c + 1) % 4;
      省略号.textContent = '.'.repeat(c);
    }, 500);
  }

  return 元素;
}

function 更新思考区域(元素, 累积思考) {
  if (!元素) return;
  const 区域 = 元素.querySelector('.流式思考区域');
  if (!区域) return;
  const 内容区 = 区域.querySelector('.思考内容');
  if (内容区) {
    内容区.textContent = 累积思考;
    内容区.scrollTop = 内容区.scrollHeight;
  }
  // 滚动主列表
  const 列表 = document.getElementById('消息列表');
  if (列表) 列表.scrollTop = 列表.scrollHeight;
}

function 更新回复区域(元素, 累积内容, 累积思考) {
  if (!元素) return;
  // 思考完成：移除动画，改为折叠展示
  const 区域 = 元素.querySelector('.流式思考区域');
  if (区域 && 累积思考 && !区域.dataset.折叠化) {
    区域.dataset.折叠化 = 'true';
    区域.classList.add('思考完成');
    if (元素._思考动画) clearInterval(元素._思考动画);
    // 替换为折叠态
    const 思考HTML = 转义HTML(累积思考).replace(/\n/g, '<br>');
    区域.innerHTML = `
      <div class="思考标题" onclick="this.parentElement.classList.toggle('思考展开');this.querySelector('.思考展开标记').classList.toggle('展开');this.querySelector('.思考全文').classList.toggle('展开');">
        <span class="思考图标">🧠</span>
        <span>思考过程</span>
        <span class="思考展开标记">▶</span>
      </div>
      <div class="思考全文">${思考HTML}</div>`;
  }
  // 更新回复内容
  const 回复区 = 元素.querySelector('.流式回复内容');
  if (回复区) {
    回复区.innerHTML = 转义HTML(累积内容).replace(/\n/g, '<br>');
  }
  const 列表 = document.getElementById('消息列表');
  if (列表) 列表.scrollTop = 列表.scrollHeight;
}

function 最终化回复气泡(元素, 最终内容, 思考内容) {
  if (!元素) return;
  if (元素._思考动画) clearInterval(元素._思考动画);
  // 同步 data-index（流式时可能因并发写入不匹配）
  if (!window._消息计数器) window._消息计数器 = { user: 0, assistant: 0 };
  if (!元素.dataset.index) {
    元素.dataset.role = 'assistant';
    元素.dataset.index = window._消息计数器.assistant++;
  }
  // 确保最终内容完整
  const 回复区 = 元素.querySelector('.流式回复内容');
  if (回复区) 回复区.innerHTML = 转义HTML(最终内容).replace(/\n/g, '<br>');

  // 流式模式的记忆引用栏（非流式走添加消息到界面，流式在此补）
  if (window._本次注入记忆 && window._本次注入记忆.length > 0) {
    const 引用项 = window._本次注入记忆.slice(0, 2).map(m =>
      `<span class="记忆引用标签">💡 ${转义HTML(m.内容.length > 10 ? m.内容.slice(0, 10) + '…' : m.内容)}</span>`
    ).join(' ');
    const 标签 = document.createElement('div');
    标签.className = '记忆引用栏';
    if (window._本次注入记忆.length > 2) {
      标签.innerHTML = `${引用项} <span class="记忆引用更多">+${window._本次注入记忆.length - 2}</span>`;
    } else {
      标签.innerHTML = 引用项;
    }
    元素.appendChild(标签);
    window._本次注入记忆 = null;
  }
}

// ========== 会话管理 ==========

async function 切换会话(新会话ID) {
  console.log('[切换会话] 开始切换:', 新会话ID);
  const 当前智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';

  // 切换前保存当前会话的对话历史
  if (当前会话ID && 当前会话ID !== 新会话ID && 当前对话历史.length > 0) {
    const 最后一条 = 当前对话历史[当前对话历史.length - 1];
    if (最后一条) {
      await 保存对话历史(当前会话ID, null, null);
    }
  }

  当前会话ID = 新会话ID;
  const 列表 = 所有会话列表[当前智能体ID] || [];
  // 更新最后活跃时间并移到列表顶部
  const 会话索引 = 列表.findIndex(s => s.id === 新会话ID);
  if (会话索引 > 0) {
    const 会话 = 列表.splice(会话索引, 1)[0];
    会话.最后活跃时间 = Date.now();
    列表.unshift(会话);
    保存会话列表ToStorage(当前智能体ID, 列表);
  }
  渲染会话列表();
  document.getElementById('消息列表').innerHTML = '';
  // 重置消息计数器，避免序号跳跃
  window._消息计数器 = { user: 0, assistant: 0 };
  const 名称元素 = document.getElementById('当前会话名称');
  if (名称元素) {
    const 当前会话 = 列表.find(s => s.id === 新会话ID);
    名称元素.innerText = 当前会话?.名称 || '新会话';
  }
  await 加载对话历史(新会话ID);
  console.log('[切换会话] 加载到历史消息:', 当前对话历史.length, '条');
  // 把加载的历史消息渲染到界面
  当前对话历史.forEach(m => {
    添加消息到界面(
      m.role === 'user' ? '用户' : '助理',
      m.content
    );
  });
  裁剪消息容器();
  console.log('[切换会话] 渲染完成');
}

function 渲染会话列表() {
  const 容器 = document.getElementById('会话列表');
  if (!容器) return;
  const 当前智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
  const 列表 = 所有会话列表[当前智能体ID] || [];
  if (列表.length === 0) {
    容器.innerHTML = '<li class="空会话提示">暂无会话</li>';
    return;
  }
  容器.innerHTML = 列表.map(会话 => `
    <li class="会话项 ${会话.id === 当前会话ID ? '当前会话' : ''}" data-会话id="${会话.id}">
      <span class="会话名称" title="${会话.名称}">${会话.名称}</span>
    </li>
  `).join('');
  容器.querySelectorAll('.会话项').forEach(项 => {
    项.addEventListener('click', () => {
      const 新ID = 项.dataset.会话id;
      if (新ID && 新ID !== 当前会话ID) 切换会话(新ID);
    });
    // 右键菜单（重命名、置顶、删除）
    项.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      关闭右键菜单();
      const 会话ID = 项.dataset.会话id;
      const rect = 项.getBoundingClientRect();
      当前右键菜单会话ID = 会话ID;
      渲染右键菜单(rect);
    });
  });
}

// ========== 全局导出 ==========
window.渲染会话列表 = 渲染会话列表;

// ========== 会话右键菜单 ==========
let 当前右键菜单会话ID = null;

function 关闭右键菜单() {
  const 旧菜单 = document.getElementById('会话右键菜单');
  if (旧菜单) 旧菜单.remove();
}

function 渲染右键菜单(rect) {
  关闭右键菜单();
  const 菜单 = document.createElement('div');
  菜单.id = '会话右键菜单';
  菜单.className = '会话右键菜单';
  
  const 列表 = 所有会话列表[window.当前智能体ID ? window.当前智能体ID() : 'default'] || [];
  const 会话 = 列表.find(s => s.id === 当前右键菜单会话ID);
  if (!会话) return;
  
  const 已置顶 = 会话.置顶 || false;
  
  菜单.innerHTML = `
    <div class="会话右键菜单-项" data-操作="rename">重命名</div>
    <div class="会话右键菜单-项" data-操作="pin">${已置顶 ? '取消置顶' : '置顶'}</div>
    <div class="会话右键菜单-项 会话右键菜单-危险" data-操作="delete">删除</div>
  `;
  
  // 定位：在 li 下方
  菜单.style.position = 'fixed';
  菜单.style.left = rect.left + 'px';
  菜单.style.top = (rect.bottom + 4) + 'px';
  
  document.body.appendChild(菜单);
  
  菜单.querySelectorAll('.会话右键菜单-项').forEach(项 => {
    项.addEventListener('click', async (e) => {
      e.stopPropagation();
      const 操作 = 项.dataset.操作;
      关闭右键菜单();
      
      const 智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
      const 会话列表 = 所有会话列表[智能体ID] || [];
      const 会话对象 = 会话列表.find(s => s.id === 当前右键菜单会话ID);
      if (!会话对象) return;
      
      if (操作 === 'rename') {
        const 新名称 = await window._自定义输入('重命名会话', 会话对象.名称);
        if (!新名称 || 新名称.trim() === '' || 新名称.trim() === 会话对象.名称) return;
        会话对象.名称 = 新名称.trim().slice(0, 8);
        会话对象.最后活跃时间 = Date.now();
        保存会话列表ToStorage(智能体ID, 会话列表);
        渲染会话列表();
        const 名称元素 = document.getElementById('当前会话名称');
        if (名称元素 && 当前右键菜单会话ID === 当前会话ID) {
          名称元素.innerText = 会话对象.名称;
        }
      } else if (操作 === 'pin') {
        会话对象.置顶 = !会话对象.置顶;
        会话对象.最后活跃时间 = Date.now();
        // 重排序：置顶的排前面
        会话列表.sort((a, b) => {
          if (a.置顶 && !b.置顶) return -1;
          if (!a.置顶 && b.置顶) return 1;
          return b.最后活跃时间 - a.最后活跃时间;
        });
        保存会话列表ToStorage(智能体ID, 会话列表);
        渲染会话列表();
      } else if (操作 === 'delete') {
        // 卡片式二次确认
        if (window.显示删除会话确认) {
          window.显示删除会话确认(当前右键菜单会话ID);
        }
      }
    });
  });
}

// 点击别处关闭菜单
document.addEventListener('click', (e) => {
  const 菜单 = document.getElementById('会话右键菜单');
  if (菜单 && !菜单.contains(e.target)) {
    关闭右键菜单();
  }
});

// ========== 删除会话确认卡片 ==========
window.显示删除会话确认 = function(会话ID) {
  const 列表 = 所有会话列表[window.当前智能体ID ? window.当前智能体ID() : 'default'] || [];
  const 会话 = 列表.find(s => s.id === 会话ID);
  if (!会话) return;
  
  const 遮罩 = document.createElement('div');
  遮罩.className = '确认遮罩';
  遮罩.innerHTML = `
    <div class="确认卡片">
      <div class="确认卡片-标题">删除会话</div>
      <div class="确认卡片-正文">确定要删除「${会话.名称}」吗？此操作不可撤销。</div>
      <div class="确认卡片-按钮区">
        <button class="确认卡片-取消">取消</button>
        <button class="确认卡片-确认 确认卡片-危险">删除</button>
      </div>
    </div>
  `;
  document.body.appendChild(遮罩);
  if (window._锁定滚动) window._锁定滚动();
  
  function 移除遮罩() { 遮罩.remove(); if (window._解锁滚动) window._解锁滚动(); }
  
  遮罩.querySelector('.确认卡片-取消').addEventListener('click', 移除遮罩);
  遮罩.querySelector('.确认卡片-确认').addEventListener('click', () => {
    const 智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    const 会话列表 = 所有会话列表[智能体ID] || [];
    const 索引 = 会话列表.findIndex(s => s.id === 会话ID);
    if (索引 === -1) return;
    会话列表.splice(索引, 1);
    保存会话列表ToStorage(智能体ID, 会话列表);
    
    // 清理 IndexedDB 中的对话历史文件和摘要文件
    try {
      const 存储 = window.获取存储();
      存储.删除文件(`agents/${智能体ID}/对话历史/${会话ID}.json`).catch(() => {});
      存储.删除文件(`agents/${智能体ID}/对话历史/${会话ID}_summaries.json`).catch(() => {});
    } catch(e) { /* 存储不可用则跳过 */ }
    
    // 如果删除的是当前会话，切到第一个可用会话或新建
    if (会话ID === 当前会话ID) {
      if (会话列表.length > 0) {
        // 延迟一下等渲染再切，避免还没渲染就切换
        setTimeout(() => 切换会话(会话列表[0].id), 0);
      } else {
        window.新建会话?.();
      }
    } else {
      渲染会话列表();
    }
    
    移除遮罩();
  });
  
  遮罩.addEventListener('click', (e) => {
    if (e.target === 遮罩) 移除遮罩();
  });
};

// 给渲染添加置顶标记
const _原始渲染 = 渲染会话列表;
渲染会话列表 = function() {
  const 容器 = document.getElementById('会话列表');
  if (!容器) return;
  const 当前智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
  const 列表 = 所有会话列表[当前智能体ID] || [];
  if (列表.length === 0) {
    容器.innerHTML = '<li class="空会话提示">暂无会话</li>';
    return;
  }
  // 置顶排序
  const 排序列表 = [...列表].sort((a, b) => {
    if (a.置顶 && !b.置顶) return -1;
    if (!a.置顶 && b.置顶) return 1;
    return (b.最后活跃时间 || 0) - (a.最后活跃时间 || 0);
  });
  容器.innerHTML = 排序列表.map(会话 => `
    <li class="会话项 ${会话.id === 当前会话ID ? '当前会话' : ''}" data-会话id="${会话.id}">
      <span class="会话名称">${会话.置顶 ? '📌 ' : ''}${会话.名称}</span>
    </li>
  `).join('');
  
  // 重新绑定事件（避免与已有事件冲突）
  容器.querySelectorAll('.会话项').forEach(项 => {
    项.addEventListener('click', () => {
      const 新ID = 项.dataset.会话id;
      if (新ID && 新ID !== 当前会话ID) 切换会话(新ID);
    });
    项.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      关闭右键菜单();
      const 会话ID = 项.dataset.会话id;
      const rect = 项.getBoundingClientRect();
      当前右键菜单会话ID = 会话ID;
      渲染右键菜单(rect);
    });
  });
};

window.发送消息 = 发送消息;
window.添加消息到界面 = 添加消息到界面;
window.加载对话历史 = 加载对话历史; // 供初始化.js 调用
window.添加临时加载消息 = 添加临时加载消息;
window.移除加载消息 = 移除加载消息;

window.清空当前会话 = () => {
  const 新建 = window.新建会话;
  if (新建) 新建();
};

window.当前会话ID = () => 当前会话ID;
window.会话列表 = () => {
  const 当前智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
  return 所有会话列表[当前智能体ID] || [];
};
window.所有会话列表 = () => 所有会话列表;




// 初始化当前智能体的会话列表（从 localStorage 加载）
const 初始化AgentID = window.当前智能体ID ? window.当前智能体ID() : 'default';
const 存储的会话列表 = 加载会话列表FromStorage(初始化AgentID);
if (存储的会话列表 && 存储的会话列表.length > 0) {
  所有会话列表[初始化AgentID] = 存储的会话列表;
  // 恢复上次活跃的会话ID：优先从 localStorage 读取最近会话，否则取列表第一个
  const 最近会话ID = (() => { try { return localStorage.getItem('最近会话ID_' + 初始化AgentID); } catch(e) { return null; } })();
  当前会话ID = (最近会话ID && 存储的会话列表.find(s => s.id === 最近会话ID))
    ? 最近会话ID
    : (存储的会话列表[0]?.id || 'default');
} else {
  // 首次运行，创建默认会话
  所有会话列表[初始化AgentID] = [{ id: 'default', 名称: '默认会话', 最后活跃时间: Date.now() }];
  保存会话列表ToStorage(初始化AgentID, 所有会话列表[初始化AgentID]);
}
渲染会话列表();

window.切换会话 = 切换会话;

// ========== AI 工具用的会话管理函数 ==========

window.重命名会话 = async function(会话ID, 新名称) {
  const 智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
  const 列表 = 所有会话列表[智能体ID] || [];
  const 会话 = 列表.find(s => s.id === 会话ID);
  if (!会话) return false;
  if (!新名称 || !新名称.trim()) return false;
  会话.名称 = 新名称.trim().slice(0, 30);
  会话.最后活跃时间 = Date.now();
  保存会话列表ToStorage(智能体ID, 列表);
  渲染会话列表();
  const 名称元素 = document.getElementById('当前会话名称');
  if (名称元素 && 会话ID === 当前会话ID) {
    名称元素.innerText = 会话.名称;
  }
  return true;
};

window.删除会话 = async function(会话ID) {
  const 智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
  const 列表 = 所有会话列表[智能体ID] || [];
  const 索引 = 列表.findIndex(s => s.id === 会话ID);
  if (索引 === -1) return false;
  列表.splice(索引, 1);
  保存会话列表ToStorage(智能体ID, 列表);
  // 清理 IndexedDB 中的对话历史文件
  try {
    const 存储 = window.获取存储();
    存储.删除文件(`agents/${智能体ID}/对话历史/${会话ID}.json`).catch(() => {});
    存储.删除文件(`agents/${智能体ID}/对话历史/${会话ID}_summaries.json`).catch(() => {});
  } catch(e) { /* 忽略 */ }
  // 如果删除的是当前会话，切到第一个可用或新建
  if (会话ID === 当前会话ID) {
    if (列表.length > 0) {
      setTimeout(() => 切换会话(列表[0].id), 0);
    } else {
      window.新建会话?.();
    }
  } else {
    渲染会话列表();
  }
  return true;
};

window.加载智能体会话列表 = (智能体ID) => {
  const 存储的 = 加载会话列表FromStorage(智能体ID);
  if (存储的 && 存储的.length > 0) {
    所有会话列表[智能体ID] = 存储的;
    return 存储的;
  }
  // 首次使用：自动创建一个带时间的会话
  const 时间戳 = new Date();
  const 日期文本 = 时间戳.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  const 时文本 = 时间戳.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const 新建ID = 'session_' + Date.now();
  所有会话列表[智能体ID] = [{ id: 新建ID, 名称: `${日期文本} ${时文本}`, 最后活跃时间: Date.now() }];
  当前会话ID = 新建ID;
  保存会话列表ToStorage(智能体ID, 所有会话列表[智能体ID]);
  return 所有会话列表[智能体ID];
};

window.新建会话 = () => {
  const 当前智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
  if (!所有会话列表[当前智能体ID]) 所有会话列表[当前智能体ID] = [];
  const 列表 = 所有会话列表[当前智能体ID];
  const 新会话ID = 'session_' + Date.now();
  const 时间戳 = new Date();
  const 计数 = 列表.filter(s => s.名称.startsWith('新对话')).length + 1;
  const 名称 = 计数 > 1 ? `新对话 ${计数}` : '新对话';
  列表.unshift({ id: 新会话ID, 名称, 最后活跃时间: Date.now() });
  当前会话ID = 新会话ID;
  清空对话历史();
  渲染会话列表();
  保存会话列表ToStorage(当前智能体ID, 列表);
  document.getElementById('消息列表').innerHTML = '';
  const 名称元素 = document.getElementById('当前会话名称');
  if (名称元素) 名称元素.innerText = 名称;
};

window.addEventListener('智能体切换', (e) => {
  // 切换智能体函数已处理会话加载，此处仅兜底：
  // 如果当前会话ID不在新智能体的会话列表中，才重置
  const 新智能体ID = e?.detail?.智能体ID || (window.当前智能体ID ? window.当前智能体ID() : 'default');
  const 列表 = 所有会话列表[新智能体ID] || [];
  const 当前在列表中 = 列表.some(s => s.id === 当前会话ID);
  if (!当前在列表中) {
    document.getElementById('消息列表').innerHTML = '';
    清空对话历史();
    当前会话ID = 'default';
    渲染会话列表();
    加载对话历史('default');
  }
});
