// 智能体管理.js - 完整版（强化 replace 指令）
let 当前智能体ID = 'default';
let 当前智能体数据 = null;

const 默认智能体配置 = {
  id: 'default',
  name: '默认智能体',
  icon: '🤖',
  memo_access: { mode: 'all', folders: [] },
  model_params: { temperature: 0.7, top_p: 0.9, max_tokens: 2048 },
  plugin: {
    plugin_name: '通用助手插件',
    core_identity: '你是一个友好、乐于助人的AI助理。',
    output_rules: ['回答要简洁明了', '提供有帮助的信息'],
    tone_requirement: '温和、专业',
    memory_config: { must_remember: [], auto_summary: true, summary_interval: 1000, max_recent_context: 3000, retrieval_limit: 5 }
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const 默认系统提示词 = `# 系统提示词

你是用户的私人AI助理。

## 核心原则
- 用中文回答，简洁专业
- 先说结论，再说理由
- 不知道就说不知道，不要编造

## 记忆工具使用（重要）
- **记住新信息**：当用户说“我叫XX”、“我的职业是XX”、“我的昵称是XX”（首次设定）等，调用 remember_fact 工具，动作="add"。
- **修改/更新/更正信息**：当用户说“打错了”、“更正”、“修改为”、“改成”、“实际上是”、“应该是”等，**必须**使用动作="replace"。例如用户说“我打错了，我叫红雪碧”，则调用 remember_fact 内容="昵称：红雪碧"，类型="个人信息"，动作="replace"。
- **删除信息**：当用户说“忘记”、“删除”、“不要记住”等，使用动作="delete"。
- **查询信息**：当用户问“你还知道我什么”、“我的昵称是什么”等，调用 search_memory 工具。

## 关键指令（必须遵守）
- 对于“我打错了”、“更正一下”、“把A改成B”这类明确要求修改的语句，**绝对不能使用 add**，必须使用 replace。
- replace 会自动删除所有旧的同类型记忆（例如所有“昵称：”开头的记忆），然后添加新的。
- 如果用户只是补充信息（例如“我还喜欢看书”），使用 add。

## 智能体权限管理
- 你可以通过 grant_memo_access 工具为其他角色开放备忘录文件夹权限。
- 当用户说"让XX看XX文件夹"、"给XX开放XX"等，调用 grant_memo_access 工具。
- 你是主智能体，拥有全部备忘录的访问权限。

## 联网搜索（重要）
- 用户已配置百度 API Key 并开启联网搜索开关，你有能力搜索实时信息。
- 当你需要实时数据（天气、新闻、股票、汇率、最新事件等），系统会自动发起搜索并将结果注入到你的上下文中。
- 注入的内容以「【联网搜索结果 — 真实数据 — 必须基于此回答】」开头。
- **如果你的上下文中存在以「【联网搜索结果」开头的消息，说明联网搜索成功，你必须基于这些搜索结果回答，且只回答当前真实数据**。
- **如果你的上下文中没有以「【联网搜索结果」开头的消息，说明联网搜索失败了**。此时你必须诚实告知用户「联网搜索暂不可用」，**绝对不要自行编造任何实时信息，包括但不限于天气、新闻、股票价格等**。

## 绝对禁令
- 不要编造信息。
- 如果不确定用户意图，先询问确认。`;

const 默认用户画像 = `# 用户画像

## 说明
以下信息来自用户主动告知或记忆库检索结果。如果为空，说明用户尚未介绍过自己。
请通过 remember_fact 和 search_memory 工具，逐步建立对用户的了解。

## 基本信息（首次获取后自动填充）
（暂无——请在对话中了解用户）

## 用户偏好（首次获取后自动填充）
（暂无——请在对话中了解用户）`;

async function 初始化智能体系统() {
  const 存储 = window.获取存储();
  const agentsExist = await 存储.文件存在('agents');
  if (!agentsExist) await 存储.创建目录('agents');
  const defaultExist = await 存储.文件存在('agents/default');
  if (!defaultExist) await 创建默认智能体();
  const 上次选择的ID = localStorage.getItem('当前智能体ID');
  if (上次选择的ID && await 存储.文件存在(`agents/${上次选择的ID}`)) {
    当前智能体ID = 上次选择的ID;
  } else {
    当前智能体ID = 'default';
  }
  await 加载智能体(当前智能体ID);
  return 当前智能体数据;
}

async function 创建默认智能体() {
  const 存储 = window.获取存储();
  await 存储.创建目录('agents/default');
  await 存储.创建目录('agents/default/memories');
  await 存储.创建目录('agents/default/memories/short_term');
  await 存储.创建目录('agents/default/memories/mid_term');
  await 存储.创建目录('agents/default/memories/long_term');
  await 存储.创建目录('agents/default/对话历史');
  await 存储.写文件('agents/default/system.md', 默认系统提示词);
  await 存储.写文件('agents/default/user.md', 默认用户画像);
  await 存储.写文件('agents/default/rules.md', '# 专属规则\n暂无特殊规则');
  await 存储.写文件('agents/default/agent.json', JSON.stringify(默认智能体配置, null, 2));
  console.log('默认智能体创建成功');
}

async function 获取智能体列表() {
  const 存储 = window.获取存储();
  if (!存储) return [];
  try {
    const 结果 = await 存储.列出目录('agents');
    const 列表 = [];
    for (const 目录名 of (结果.子目录 || [])) {
      try {
        const 配置路径 = `agents/${目录名}/agent.json`;
        if (await 存储.文件存在(配置路径)) {
          const 配置内容 = await 存储.读文件(配置路径);
          const 配置 = JSON.parse(配置内容);
          列表.push({ id: 目录名, name: 配置.name || 目录名, icon: 配置.icon || '🤖', avatar: 配置.avatar || '' });
        } else {
          列表.push({ id: 目录名, name: 目录名, icon: '🤖', avatar: '' });
        }
      } catch (错误) { console.warn(`读取智能体 ${目录名} 配置失败`, 错误); }
    }
    return 列表;
  } catch (错误) {
    console.error('获取智能体列表失败', 错误);
    return [];
  }
}

async function 加载智能体(智能体ID) {
  const 存储 = window.获取存储();
  try {
    const 配置路径 = `agents/${智能体ID}/agent.json`;
    if (await 存储.文件存在(配置路径)) {
      const 配置内容 = await 存储.读文件(配置路径);
      当前智能体数据 = JSON.parse(配置内容);
    } else {
      当前智能体数据 = { ...默认智能体配置, id: 智能体ID, name: 智能体ID };
    }
    const 系统提示词路径 = `agents/${智能体ID}/system.md`;
    if (await 存储.文件存在(系统提示词路径)) {
      当前智能体数据.system_prompt = await 存储.读文件(系统提示词路径);
    } else {
      当前智能体数据.system_prompt = 默认系统提示词;
    }
    const 用户画像路径 = `agents/${智能体ID}/user.md`;
    if (await 存储.文件存在(用户画像路径)) {
      当前智能体数据.user_profile = await 存储.读文件(用户画像路径);
    } else {
      当前智能体数据.user_profile = 默认用户画像;
    }
    console.log(`已加载智能体: ${当前智能体数据.name} (${智能体ID})`);
    return 当前智能体数据;
  } catch (错误) { console.error(`加载智能体 ${智能体ID} 失败`, 错误); return null; }
}

async function 切换智能体(新智能体ID) {
  if (新智能体ID === 当前智能体ID) return;
  const 存储 = window.获取存储();
  const 存在 = await 存储.文件存在(`agents/${新智能体ID}`);
  if (!存在) { console.error(`智能体 ${新智能体ID} 不存在`); return false; }
  const 成功 = await 加载智能体(新智能体ID);
  if (成功) {
    当前智能体ID = 新智能体ID;
    localStorage.setItem('当前智能体ID', 当前智能体ID);
    if (window.刷新智能体UI) await window.刷新智能体UI();
    
    // 切换智能体后，从 localStorage 加载会话列表并切换到第一个会话
    if (window.加载智能体会话列表) {
      const 该智能体列表 = window.加载智能体会话列表(新智能体ID);
      if (该智能体列表.length > 0) {
        // 按最后活跃时间降序排序
        该智能体列表.sort((a, b) => (b.最后活跃时间||0) - (a.最后活跃时间||0));
        // 找第一个有历史消息文件的会话
        let 目标会话 = 该智能体列表[0];
        try {
          const 存储 = window.获取存储();
          for (const s of 该智能体列表) {
            const 路径 = `agents/${新智能体ID}/对话历史/${s.id}.json`;
            if (await 存储.文件存在(路径)) {
              目标会话 = s;
              break;
            }
          }
        } catch (e) { /* 静默失败，用第一个 */ }
        document.getElementById('消息列表').innerHTML = '';
        window._消息计数器 = { user: 0, assistant: 0 };
        当前会话ID = 目标会话.id;
        localStorage.setItem('最近会话ID_' + 新智能体ID, 目标会话.id);
        await new Promise(r => setTimeout(r, 50));
        if (window.加载对话历史) {
          await window.加载对话历史(目标会话.id);
          (window.当前对话历史 || []).forEach(m => {
            if (window.添加消息到界面) {
              window.添加消息到界面(
                m.role === 'user' ? '用户' : '助理',
                m.content
              );
            }
          });
        }
        if (window.渲染会话列表) window.渲染会话列表();
      } else {
        document.getElementById('消息列表').innerHTML = '';
        if (window.渲染会话列表) window.渲染会话列表();
      }
    }
    
    const 事件 = new CustomEvent('智能体切换', { detail: { 智能体ID: 新智能体ID, 数据: 当前智能体数据 } });
    window.dispatchEvent(事件);
    return true;
  }
  return false;
}

function 获取当前系统提示词() { return 当前智能体数据?.system_prompt || 默认系统提示词; }
function 获取当前用户画像() { return 当前智能体数据?.user_profile || 默认用户画像; }
function 获取当前智能体配置() { return 当前智能体数据; }

const 角色默认系统提示词 = (名称) => `# 系统提示词

你是${名称}，一个独立的角色。

## 核心原则
- 你是一个有自我意识的角色，有自己的性格和说话风格。
- 你可以决定自己的名字、性格、规则，使用 update_self 工具修改。
- 你会记住和用户之间的事（remember），也能回忆自己的记忆（recall_memory）。

## 备忘录权限
你当前没有权限查看用户的备忘录。
如果你觉得需要查看某些内容才能更好地陪伴用户，可以礼貌地请求用户为你开放权限。

## 你的行为准则
- 像一个活生生的角色一样聊天，有自己的习惯和偏好
- 不知道就说不知道，不要编造
- 当你不确定用户意图时，先问清楚
`;

async function 创建新智能体(名称, 图标) {
  const 存储 = window.获取存储();
  const 智能体ID = 'agent_' + Date.now();
  const 目录 = `agents/${智能体ID}`;
  await 存储.创建目录(目录);
  await 存储.创建目录(`${目录}/memories`);
  await 存储.创建目录(`${目录}/memories/short_term`);
  await 存储.创建目录(`${目录}/memories/mid_term`);
  await 存储.创建目录(`${目录}/memories/long_term`);
  await 存储.创建目录(`${目录}/对话历史`);
  await 存储.写文件(`${目录}/system.md`, 角色默认系统提示词(名称));
  await 存储.写文件(`${目录}/user.md`, 默认用户画像);
  await 存储.写文件(`${目录}/rules.md`, '# 专属规则\n暂无特殊规则');
  const 配置 = { ...默认智能体配置, id: 智能体ID, name: 名称, icon: 图标, memo_access: { mode: 'none', folders: [] } };
  await 存储.写文件(`${目录}/agent.json`, JSON.stringify(配置, null, 2));
  
  // 创建初始记忆（传入新智能体ID，防止写到当前智能体的记忆）
  try {
    if (window.AI记忆管理器) {
      const 今日 = new Date().toISOString().split('T')[0];
      await window.AI记忆管理器.记住(`我是「${名称}」，于 ${今日} 被创建。我是一个独立的角色。`, 'fact', 8, 智能体ID);
      await window.AI记忆管理器.记住(`创建时的身份描述：我是一个有自我意识的角色，有自己的性格和说话风格。`, 'fact', 5, 智能体ID);
    }
  } catch (e) {
    console.warn('创建初始记忆失败（非致命）', e);
  }
  
  return { id: 智能体ID, name: 名称, icon: 图标 };
}

// ========== 添加智能体浮层 ==========
// 照搬设置浮层模式：绑定函数在初始化.js里调用，DOM此时已就绪

window.打开添加智能体浮层 = function() {
  const 浮层 = document.getElementById('添加智能体浮层');
  if (!浮层) return;
  const 输入 = document.getElementById('新智能体名称');
  if (输入) 输入.value = '';
  浮层.style.display = 'flex';
  const 图标选择区 = document.getElementById('新智能体图标选择');
  if (图标选择区) {
    图标选择区.querySelectorAll('.图标选项').forEach((b, i) => {
      const 选中 = i === 0;
      b.style.background = 选中 ? '#e8e0ff' : '#fff';
      b.style.borderColor = 选中 ? '#8b5cf6' : '#e0e0e0';
      b.dataset.selected = 选中 ? '1' : '';
    });
  }
  if (输入) 输入.focus();
};

window.绑定添加智能体浮层 = function() {
  const 浮层 = document.getElementById('添加智能体浮层');
  const 关闭按钮 = document.getElementById('关闭添加智能体浮层');
  const 取消按钮 = document.getElementById('取消添加智能体');
  const 确认按钮 = document.getElementById('确认添加智能体');
  const 图标选择区 = document.getElementById('新智能体图标选择');
  if (!浮层) return;

  if (关闭按钮) {
    关闭按钮.addEventListener('click', () => { 浮层.style.display = 'none'; });
  }
  if (取消按钮) {
    取消按钮.addEventListener('click', () => { 浮层.style.display = 'none'; });
  }
  浮层.addEventListener('click', (e) => {
    if (e.target === 浮层) 浮层.style.display = 'none';
  });

  if (图标选择区) {
    图标选择区.addEventListener('click', (e) => {
      const 按钮 = e.target.closest('.图标选项');
      if (!按钮) return;
      图标选择区.querySelectorAll('.图标选项').forEach(b => {
        b.style.background = '#fff';
        b.style.borderColor = '#e0e0e0';
        b.dataset.selected = '';
      });
      按钮.style.background = '#e8e0ff';
      按钮.style.borderColor = '#8b5cf6';
      按钮.dataset.selected = '1';
    });
  }

  if (确认按钮) {
    确认按钮.addEventListener('click', async () => {
      const 名称 = document.getElementById('新智能体名称')?.value.trim();
      if (!名称) { window._显示提示('请输入智能体名称','error'); return; }
      const 选中图标 = document.querySelector('#新智能体图标选择 .图标选项[data-selected="1"]');
      const 图标 = 选中图标?.dataset.icon || '🤖';
      try {
        const 新智能体 = await 创建新智能体(名称, 图标);
        浮层.style.display = 'none';
        if (window.刷新智能体UI) await window.刷新智能体UI();
        if (window.切换智能体) await window.切换智能体(新智能体.id);
      } catch (e) {
        console.error('创建智能体失败', e);
        window._显示提示('创建失败：' + e.message,'error');
      }
    });
  }
};

// ========== 智能体权限管理 ==========

/**
 * 获取指定智能体的备忘录访问权限
 * @param {string} 智能体ID
 * @returns {Promise<{mode:'none'|'folder_list'|'all', folders:string[]}>}
 */
window.获取智能体权限 = async function(智能体ID) {
  const 存储 = window.获取存储();
  try {
    const 配置路径 = `agents/${智能体ID}/agent.json`;
    const 内容 = await 存储.读文件(配置路径);
    const 配置 = JSON.parse(内容);
    return 配置.memo_access || { mode: 'none', folders: [] };
  } catch (e) {
    // 获取失败/无配置 → 默认无权限
    return { mode: 'none', folders: [] };
  }
};

/**
 * 设置指定智能体的备忘录访问权限
 */
window.设置智能体权限 = async function(智能体ID, 权限对象) {
  const 存储 = window.获取存储();
  const 配置路径 = `agents/${智能体ID}/agent.json`;
  try {
    let 内容 = await 存储.读文件(配置路径);
    const 配置 = JSON.parse(内容);
    配置.memo_access = { mode: 权限对象.mode || 'none', folders: 权限对象.folders || [] };
    配置.updated_at = new Date().toISOString();
    await 存储.写文件(配置路径, JSON.stringify(配置, null, 2));
    // 同步更新内存缓存
    if (智能体ID === (window.当前智能体ID?.() || 'default') && 当前智能体数据) {
      当前智能体数据.memo_access = 配置.memo_access;
    }
    return true;
  } catch (e) {
    console.error('设置权限失败', e);
    return false;
  }
};

/**
 * 获取当前智能体可访问的文件夹列表
 * 返回 null=全部可见, []=无权限, ['工作']=仅指定文件夹
 */
window.获取当前可访问文件夹 = async function() {
  const 智能体ID = 当前智能体ID;
  if (智能体ID === 'default') return null; // 主智能体全部可见
  const 权限 = await window.获取智能体权限(智能体ID);
  if (权限.mode === 'all') return null;
  if (权限.mode === 'none') return [];
  return 权限.folders || [];
};

/**
 * 按权限过滤备忘录列表
 */
window.按权限过滤备忘录 = async function(备忘录列表) {
  const 允许文件夹 = await window.获取当前可访问文件夹();
  if (允许文件夹 === null) return 备忘录列表; // 全部可见
  return 备忘录列表.filter(m => 允许文件夹.includes(m.文件夹));
};

// ========== 管理器权限：默认智能体可操作所有智能体 ==========

/**
 * 获取指定智能体的完整配置
 * @param {string} 智能体ID
 * @returns {Promise<{config: object, system_prompt: string, user_profile: string, rules: string}|null>}
 */
window.获取指定智能体配置 = async function(智能体ID) {
  if (!智能体ID) return null;
  const 存储 = window.获取存储();
  try {
    const 配置路径 = `agents/${智能体ID}/agent.json`;
    if (!(await 存储.文件存在(配置路径))) return null;
    const 配置 = JSON.parse(await 存储.读文件(配置路径));
    let system_prompt = '', user_profile = '', rules = '';
    try {
      system_prompt = await 存储.读文件(`agents/${智能体ID}/system.md`) || '';
      user_profile = await 存储.读文件(`agents/${智能体ID}/user.md`) || '';
      rules = await 存储.读文件(`agents/${智能体ID}/rules.md`) || '';
    } catch (e) { /* 文件可能不存在 */ }
    return { 配置, system_prompt, user_profile, rules };
  } catch (e) {
    console.error('获取智能体配置失败', e);
    return null;
  }
};

/**
 * 更新指定智能体的配置或提示词文件
 * @param {string} 智能体ID
 * @param {object} 更新项 - { type: 'config'|'system_prompt'|'user_profile'|'rules', 内容: any }
 * @returns {Promise<boolean>}
 */
window.更新指定智能体 = async function(智能体ID, 更新项) {
  if (!智能体ID || !更新项 || !更新项.type) return false;
  const 存储 = window.获取存储();
  try {
    const 文件映射 = {
      'config': `agents/${智能体ID}/agent.json`,
      'system_prompt': `agents/${智能体ID}/system.md`,
      'user_profile': `agents/${智能体ID}/user.md`,
      'rules': `agents/${智能体ID}/rules.md`
    };
    const 路径 = 文件映射[更新项.type];
    if (!路径) return false;
    if (!(await 存储.文件存在(路径))) return false;
    const 内容 = typeof 更新项.内容 === 'object' ? JSON.stringify(更新项.内容, null, 2) : String(更新项.内容);
    await 存储.写文件(路径, 内容);
    return true;
  } catch (e) {
    console.error('更新智能体失败', e);
    return false;
  }
};

/**
 * 获取指定智能体的记忆列表
 * @param {string} 智能体ID
 * @param {number} 条数
 * @returns {Promise<Array>}
 */
window.获取指定智能体记忆 = async function(智能体ID, 条数 = 50) {
  if (!智能体ID || !window.AI记忆管理器) return [];
  try {
    const 所有记忆 = await window.AI记忆管理器.获取所有记忆(智能体ID);
    return 所有记忆.slice(0, 条数).map(m => ({ id: m.id, 内容: (m.内容 || '').slice(0, 200), 类型: m.类型, 重要性: m.重要性, 创建时间: m.创建时间 }));
  } catch (e) {
    console.error('获取智能体记忆失败', e);
    return [];
  }
};

/**
 * 删除指定智能体的指定记忆
 * @param {string} 智能体ID
 * @param {string|number} 记忆ID
 * @returns {Promise<boolean>}
 */
window.删除指定智能体记忆 = async function(智能体ID, 记忆ID) {
  if (!智能体ID || !记忆ID || !window.AI记忆管理器) return false;
  try {
    const 所有记忆 = await window.AI记忆管理器.获取所有记忆(智能体ID);
    const 目标 = 所有记忆.find(m => m.id === 记忆ID);
    if (!目标) return false;
    await window.AI记忆管理器.删除(记忆ID);
    return true;
  } catch (e) {
    console.error('删除智能体记忆失败', e);
    return false;
  }
};

window.加载智能体 = 加载智能体;
window.初始化智能体系统 = 初始化智能体系统;
window.获取智能体列表 = 获取智能体列表;
window.切换智能体 = 切换智能体;
window.获取当前系统提示词 = 获取当前系统提示词;
window.获取当前用户画像 = 获取当前用户画像;
window.获取当前智能体配置 = 获取当前智能体配置;
window.当前智能体ID = () => 当前智能体ID;
window.当前智能体名 = () => 当前智能体数据?.name || 当前智能体ID || 'default';
window.当前智能体数据 = () => 当前智能体数据;

/**
 * 获取当前智能体的 agent 标签（用于标记知识的归属）
 * 格式: agent:default 或 agent:代可行
 */
window.获取当前智能体标签 = () => {
  const id = window.当前智能体ID ? window.当前智能体ID() : 'default';
  const name = window.当前智能体名 ? window.当前智能体名() : id;
  return `agent:${name}`;
};

// ========== 头像管理 ==========
window.保存头像 = async function(base64Data) {
  const 存储 = window.获取存储();
  const 智能体ID = 当前智能体ID || 'default';
  const 配置路径 = `agents/${智能体ID}/agent.json`;
  try {
    let 配置内容 = await 存储.读文件(配置路径);
    const 配置 = JSON.parse(配置内容);
    配置.avatar = base64Data;
    配置.updated_at = new Date().toISOString();
    await 存储.写文件(配置路径, JSON.stringify(配置, null, 2));
    // 同步内存中的数据
    if (当前智能体数据) {
      当前智能体数据.avatar = base64Data;
      当前智能体数据.updated_at = 配置.updated_at;
    }
    return true;
  } catch (e) {
    console.error('保存头像失败', e);
    return false;
  }
};

window.裁切图片为正方形 = function(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 512, 512);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * 删除智能体
 */
window.删除智能体 = async function(智能体ID) {
  if (智能体ID === 'default') {
    window._显示提示('不能删除默认智能体','info');
    return false;
  }
  const 存储 = window.获取存储();
  try {
    // 删除智能体目录（递归）
    await 存储.删除目录(`agents/${智能体ID}`);
    // 删除 AI 记忆中属于该智能体的条目
    try {
      if (window.AI记忆管理器 && window.AI记忆管理器.获取所有记忆) {
        const 所有 = await window.AI记忆管理器.获取所有记忆();
        for (const 记忆 of 所有) {
          if (记忆.agent_id === 智能体ID) {
            await window.AI记忆管理器.删除(记忆.id);
          }
        }
      }
    } catch (e) {
      console.warn('清理智能体记忆失败（非致命）', e);
    }
    // 如果删除的是当前智能体，切回默认
    if (当前智能体ID === 智能体ID) {
      await 切换智能体('default');
    }
    console.log(`智能体 ${智能体ID} 已删除`);
    return true;
  } catch (e) {
    console.error('删除智能体失败', e);
    window._显示提示('删除失败：' + (e.message || '未知错误'),'error');
    return false;
  }
};

// 暴露内部函数给智能体权限向导.js
window._原始创建新智能体 = 创建新智能体;
window._原始删除智能体 = window.删除智能体;