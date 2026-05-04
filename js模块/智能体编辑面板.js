/**
 * 智能体编辑面板.js
 * 取代 记忆库面板.js — 双面板布局：左列智能体列表 + 右编辑/记忆区
 * 保留所有现有功能 API 不变（智能体管理.js、AI记忆管理器.js 等）
 */

let 当前激活标签 = 'memories'; // 'memories' | 'details'
let 当前标签筛选 = ''; // ''=全部, 标签名=筛选
let 上次展开折叠 = {
  basics: true,    // 基础信息 → 默认展开
  advanced: false, // 进阶设定 → 默认折叠
  meta: false      // 元数据 → 默认折叠
};

// ================================================================
// 入口：渲染完整面板
// ================================================================
window.渲染记忆库面板 = async function() {
  const 智能体ID = (window.当前智能体ID && window.当前智能体ID()) || 'default';
  const 配置 = window.获取当前智能体配置 && window.获取当前智能体配置();

  // 渲染左列：智能体列表
  await 渲染左列智能体列表(智能体ID);

  // 渲染右列：标题 + 标签页 + 内容
  await 渲染右列标题(智能体ID, 配置);
  if (当前激活标签 === 'memories') {
    await 渲染记忆列表();
  } else {
    await 渲染智能体详情(智能体ID, 配置);
  }
};

// ================================================================
// 左列：智能体列表
// ================================================================
async function 渲染左列智能体列表(当前选ID) {
  const 容器 = document.getElementById('智能体编辑-左列');
  if (!容器) return;

  let 列表 = [];
  try {
    列表 = await (window.获取智能体列表 && window.获取智能体列表());
  } catch (e) { /* ignore */ }
  if (!Array.isArray(列表)) 列表 = [];

  // 收集所有智能体的标签
  const 标签集合 = new Set();
  const 所有标签配置 = {}; // 智能体ID -> tags[]
  for (const 智能体 of 列表) {
    try {
      const 存储 = window.获取存储 && window.获取存储();
      if (存储) {
        const 路径 = `agents/${智能体.id}/agent.json`;
        if (await 存储.文件存在(路径)) {
          const 内容 = await 存储.读文件(路径);
          const 配置 = JSON.parse(内容);
          const tags = 配置.tags || [];
          所有标签配置[智能体.id] = tags;
          tags.forEach(t => 标签集合.add(t));
        }
      }
    } catch (e) { /* ignore */ }
  }
  const 全部标签 = [...标签集合].sort();

  let html = '<div class="智能体编辑-列表-头部">' +
    '<span class="智能体编辑-列表-标题">智能体</span>' +
    '<div class="智能体编辑-列表-操作">' +
      '<button class="智能体编辑-新建按钮" id="智能体编辑新建按钮" title="新建">+</button>' +
    '</div>' +
  '</div>';

  // 标签筛选栏
  if (全部标签.length > 0) {
    html += '<div class="智能体编辑-标签筛选栏">';
    html += `<span class="智能体编辑-标签筛选-项${当前标签筛选 === '' ? ' 激活' : ''}" data-tag="">全部</span>`;
    全部标签.forEach(t => {
      html += `<span class="智能体编辑-标签筛选-项${当前标签筛选 === t ? ' 激活' : ''}" data-tag="${escHtml(t)}">${escHtml(t)}</span>`;
    });
    html += '</div>';
  }

  // 筛选后列表
  const 筛选列表 = 当前标签筛选
    ? 列表.filter(智能体 => (所有标签配置[智能体.id] || []).includes(当前标签筛选))
    : 列表;

  html += '<div class="智能体编辑-列表区">';
  筛选列表.forEach(智能体 => {
    const 选中 = 智能体.id === 当前选ID;
    const 名称 = 智能体.name || 智能体.id;
    const 图标 = 智能体.avatar && (智能体.avatar.startsWith('data:') || 智能体.avatar.startsWith('http'))
      ? `<img class="智能体编辑-卡片-头像-img" src="${智能体.avatar}" alt="">`
      : `<span class="智能体编辑-卡片-头像-emoji">${智能体.icon || '🤖'}</span>`;
    html += `<div class="智能体编辑-卡片${选中 ? ' 激活' : ''}" data-id="${智能体.id}">
      <div class="智能体编辑-卡片-头像">${图标}</div>
      <div class="智能体编辑-卡片-名称">${escHtml(名称)}</div>
    </div>`;
  });
  html += '</div>';

  容器.innerHTML = html;

  // 绑定标签筛选点击
  容器.querySelectorAll('.智能体编辑-标签筛选-项').forEach(项 => {
    项.addEventListener('click', () => {
      const 标签 = 项.dataset.tag;
      当前标签筛选 = 标签;
      渲染左列智能体列表(当前选ID);
    });
  });

  // 绑定点击切换
  容器.querySelectorAll('.智能体编辑-卡片').forEach(card => {
    card.addEventListener('click', async () => {
      const id = card.dataset.id;
      if (id && window.切换智能体) {
        await window.切换智能体(id);
        if (window.渲染记忆库面板) await window.渲染记忆库面板();
      }
    });
    card.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      const id = card.dataset.id;
      显示智能体管理菜单(e.clientX, e.clientY, id);
    });
  });

  // 新建按钮
  const 新建按钮 = document.getElementById('智能体编辑新建按钮');
  if (新建按钮) {
    新建按钮.addEventListener('click', () => {
      if (window.打开添加智能体浮层) window.打开添加智能体浮层();
    });
  }
}

/**
 * 智能体管理右键菜单
 */
function 显示智能体管理菜单(x, y, 智能体ID) {
  // 移除旧菜单
  const 旧菜单 = document.querySelector('.智能体编辑-管理菜单');
  if (旧菜单) 旧菜单.remove();

  const 菜单 = document.createElement('div');
  菜单.className = '智能体编辑-管理菜单';
  菜单.style.left = Math.min(x, window.innerWidth - 180) + 'px';
  菜单.style.top = Math.min(y, window.innerHeight - 120) + 'px';

  const 配置 = window.获取当前智能体配置 && window.获取当前智能体配置();
  const 名称 = 配置?.name || 智能体ID;

  菜单.innerHTML = `
    <div class="智能体编辑-菜单-项" data-action="rename">✏️ 重命名</div>
    ${智能体ID !== 'default' ? '<div class="智能体编辑-菜单-项" data-action="delete">🗑️ 删除</div>' : ''}
  `;

  document.body.appendChild(菜单);

  菜单.querySelectorAll('.智能体编辑-菜单-项').forEach(项 => {
    项.addEventListener('click', async () => {
      const action = 项.dataset.action;
      if (action === 'rename') {
        const 新名称 = prompt('输入新名称：', 名称);
        if (新名称 && 新名称.trim() && 新名称 !== 名称) {
          try {
            const 存储 = window.获取存储 && window.获取存储();
            if (存储) {
              const 路径 = `agents/${智能体ID}/agent.json`;
              const 内容 = await 存储.读文件(路径);
              const 配置Obj = JSON.parse(内容);
              配置Obj.name = 新名称.trim();
              配置Obj.updated_at = new Date().toISOString();
              await 存储.写文件(路径, JSON.stringify(配置Obj, null, 2));
              if (window.刷新智能体UI) await window.刷新智能体UI();
              if (window.渲染记忆库面板) await window.渲染记忆库面板();
            }
          } catch (e) {
            alert('重命名失败：' + e.message);
          }
        }
      } else if (action === 'delete') {
        if (confirm('确认删除「' + 名称 + '」？此操作不可恢复！')) {
          if (confirm('再次确认：所有对话历史和记忆都将被清除。')) {
            if (window.删除智能体) {
              await window.删除智能体(智能体ID);
              if (window.刷新智能体UI) await window.刷新智能体UI();
              if (window.渲染记忆库面板) await window.渲染记忆库面板();
            }
          }
        }
      }
      菜单.remove();
    });
  });

  // 点击其他地方关闭
  setTimeout(() => {
    document.addEventListener('click', function 关闭菜单() {
      菜单.remove();
      document.removeEventListener('click', 关闭菜单);
    }, { once: true });
  }, 0);
}

// ================================================================
// 右列：标题 + 标签页
// ================================================================
async function 渲染右列标题(智能体ID, 配置) {
  const 容器 = document.getElementById('智能体编辑-右列');
  if (!容器) return;

  const 名称 = 配置?.name || 智能体ID;
  const 图标 = 配置?.avatar && (配置.avatar.startsWith('data:') || 配置.avatar.startsWith('http'))
    ? `<img class="智能体编辑-右-头像-img" src="${配置.avatar}" alt="">`
    : `<span class="智能体编辑-右-头像-emoji">${配置?.icon || '🤖'}</span>`;
  const 头像源 = 配置?.avatar || 配置?.icon || '🤖';
  const 有图片 = 头像源 && (头像源.startsWith('http') || 头像源.startsWith('data:'));

  // Token 计数（估算）
  const token数 = 估算Token数(配置);

  let html = `
    <div class="智能体编辑-右-头部">
      <div class="智能体编辑-右-头像区" id="智能体编辑右头像区">
        ${图标}
      </div>
      <div class="智能体编辑-右-标题区">
        <div class="智能体编辑-右-名称">${escHtml(名称)}</div>
        <div class="智能体编辑-右-token">Token: ${token数.toLocaleString()}</div>
      </div>
      <div class="智能体编辑-右-操作">
        <button class="智能体编辑-操作按钮" id="智能体编辑收藏按钮" title="收藏 / 取消收藏">收藏</button>
        <button class="智能体编辑-操作按钮" id="智能体编辑导出按钮" title="导出 JSON">导出</button>
        <button class="智能体编辑-操作按钮" id="智能体编辑复制按钮" title="复制到剪贴板">复制</button>
        <button class="智能体编辑-操作按钮" id="智能体编辑智能提取按钮" title="从近期对话提取记忆">萃取</button>
        ${智能体ID !== 'default' ? `<button class="智能体编辑-操作按钮 危险" id="智能体编辑删除按钮" title="删除">删除</button>` : ''}
      </div>
    </div>`;

  // 标签行（placeholder）
  const 标签列表 = 配置?.tags || [];
  html += `<div class="智能体编辑-标签行">
    <span class="智能体编辑-标签-标签">标签:</span>
    ${标签列表.map(t => `<span class="智能体编辑-标签-气泡">${escHtml(t)}</span>`).join('')}
    <button class="智能体编辑-添加标签" id="智能体编辑添加标签">+ 添加</button>
  </div>`;

  // 分隔线
  html += `<div class="智能体编辑-分隔线"></div>`;

  // 状态概览（SOUL + 记忆/技能/萃取摘要）
  html += await 渲染状态概览(智能体ID, 配置);

  // 标签页
  html += `<div class="智能体编辑-标签栏">
    <button class="智能体编辑-标签${当前激活标签 === 'memories' ? ' 激活' : ''}" data-tab="memories">记忆列表</button>
    <button class="智能体编辑-标签${当前激活标签 === 'details' ? ' 激活' : ''}" data-tab="details">智能体配置</button>
  </div>`;

  // 内容区（JS 动态填充）
  html += `<div class="智能体编辑-内容区" id="智能体编辑内容区"></div>`;

  容器.innerHTML = html;

  // ===== 绑定事件 =====

  // 头像点击 → 打开预览
  const 头像区 = document.getElementById('智能体编辑右头像区');
  if (头像区) {
    头像区.addEventListener('click', () => {
      打开头像预览(配置);
    });
  }

  // 收藏按钮
  const 收藏Btn = document.getElementById('智能体编辑收藏按钮');
  if (收藏Btn) {
    收藏Btn.addEventListener('click', async () => {
      await 切换收藏(智能体ID, !配置?.favorite);
    });
  }

  // 导出按钮
  const 导出Btn = document.getElementById('智能体编辑导出按钮');
  if (导出Btn) {
    导出Btn.addEventListener('click', () => {
      导出智能体JSON(智能体ID, 配置);
    });
  }

  // 复制按钮
  const 复制Btn = document.getElementById('智能体编辑复制按钮');
  if (复制Btn) {
    复制Btn.addEventListener('click', () => {
      复制智能体JSON(智能体ID, 配置);
    });
  }

  // ===== 智能提取按钮 =====
  const 智能提取Btn = document.getElementById('智能体编辑智能提取按钮');
  if (智能提取Btn) {
    智能提取Btn.addEventListener('click', async () => {
      智能提取Btn.textContent = '萃取中…';
      智能提取Btn.disabled = true;
      try {
        await window.智能提取记忆();
        智能提取Btn.textContent = '完成';
        setTimeout(() => { 智能提取Btn.textContent = '萃取'; 智能提取Btn.disabled = false; }, 1500);
      } catch (e) {
        console.error('[智能提取] 失败:', e);
        window.debugError?.('[智能提取]', e);
        智能提取Btn.textContent = '失败';
        setTimeout(() => { 智能提取Btn.textContent = '萃取'; 智能提取Btn.disabled = false; }, 2000);
      }
    });
  }
  
  // 删除按钮
  const 删除Btn = document.getElementById('智能体编辑删除按钮');
  if (删除Btn) {
    删除Btn.addEventListener('click', async () => {
      if (confirm('确认删除「' + 名称 + '」？所有对话历史和记忆都将被清除。')) {
        if (window.删除智能体) {
          await window.删除智能体(智能体ID);
          if (window.刷新智能体UI) await window.刷新智能体UI();
          if (window.渲染记忆库面板) await window.渲染记忆库面板();
        }
      }
    });
  }

  // 标签页切换
  容器.querySelectorAll('.智能体编辑-标签').forEach(tab => {
    tab.addEventListener('click', async () => {
      容器.querySelectorAll('.智能体编辑-标签').forEach(t => t.classList.remove('激活'));
      tab.classList.add('激活');
      当前激活标签 = tab.dataset.tab;

      // 重新渲染内容
      if (当前激活标签 === 'memories') {
        await 渲染记忆列表();
      } else {
        await 渲染智能体详情(智能体ID, 配置);
      }
    });
  });

  // 添加标签
  const 添加标签Btn = document.getElementById('智能体编辑添加标签');
  if (添加标签Btn) {
    添加标签Btn.addEventListener('click', async () => {
      const 新标签 = prompt('输入标签名称：');
      if (新标签 && 新标签.trim()) {
        const 标签 = 新标签.trim();
        if (!(配置?.tags || []).includes(标签)) {
          const 新配置 = { ...配置, tags: [...(配置?.tags || []), 标签] };
          await 保存配置(智能体ID, 新配置);
          if (window.渲染记忆库面板) await window.渲染记忆库面板();
        }
      }
    });
  }

  // 点击标签气泡删除
  容器.addEventListener('click', async (e) => {
    const 气泡 = e.target.closest('.智能体编辑-标签-气泡');
    if (气泡) {
      气泡.remove(); // 先视觉移除
      const 标签文本 = 气泡.textContent;
      const 新标签列表 = (配置?.tags || []).filter(t => t !== 标签文本);
      const 新配置 = { ...配置, tags: 新标签列表 };
      await 保存配置(智能体ID, 新配置);
      if (window.渲染记忆库面板) await window.渲染记忆库面板();
    }
  });
}

// ================================================================
// 右列-内容：记忆列表
// ================================================================
async function 渲染记忆列表() {
  const 容器 = document.getElementById('智能体编辑内容区');
  if (!容器) return;

  const 管理器 = window.AI记忆管理器;
  if (!管理器) {
    容器.innerHTML = '<div class="智能体编辑-空状态"><p>记忆系统未初始化</p></div>';
    return;
  }

  try {
    const 所有记忆 = await 管理器.获取所有记忆();
    if (!所有记忆 || 所有记忆.length === 0) {
      容器.innerHTML = '<div class="智能体编辑-空状态"><p>暂无记忆，开始对话后 AI 会自动记录</p></div>';
      return;
    }

    let html = '<div class="智能体编辑-记忆列表">';
    for (const 记忆 of 所有记忆) {
      const 内容 = escHtml(记忆.内容 || '');
      const 类型 = 记忆.类型 || 'fact';
      const 重要性 = 记忆.重要性 || 5;
      const 时间 = 记忆.时间戳 ? 格式化时间(记忆.时间戳) : '';

      const 类型颜色 = {
        'fact': '智能体编辑-类型-事实',
        'event': '智能体编辑-类型-事件',
        'preference': '智能体编辑-类型-偏好',
        'reminder': '智能体编辑-类型-提醒'
      }[类型] || '';

      let 星级 = '';
      for (let i = 0; i < 重要性 && i < 10; i++) 星级 += '★';
      for (let i = 重要性; i < 10; i++) 星级 += '☆';

      html += `<div class="智能体编辑-记忆项" data-id="${记忆.id}">
        <div class="智能体编辑-记忆-头部">
          <span class="智能体编辑-记忆-类型 ${类型颜色}">${类型标签文本(类型)}</span>
          <span class="智能体编辑-记忆-重要性">${星级}</span>
          <span class="智能体编辑-记忆-时间">${时间}</span>
        </div>
        <div class="智能体编辑-记忆-内容">${内容}</div>
        <button class="智能体编辑-记忆-删除" data-id="${记忆.id}" title="删除记忆">🗑️</button>
      </div>`;
    }
    html += '</div>';
    容器.innerHTML = html;

    // 绑定删除
    容器.querySelectorAll('.智能体编辑-记忆-删除').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(e.target.dataset.id);
        if (isNaN(id)) return;
        if (confirm('确定要删除这条记忆吗？')) {
          await 管理器.删除(id);
          await 渲染记忆列表();
        }
      });
    });

  } catch (错误) {
    console.error('渲染记忆列表失败', 错误);
    容器.innerHTML = '<div class="智能体编辑-空状态"><p>加载记忆失败</p></div>';
  }
}

function 类型标签文本(类型) {
  const 映射 = { 'fact': '事实', 'event': '事件', 'preference': '偏好', 'reminder': '提醒' };
  return 映射[类型] || '其他';
}

// ================================================================
// 右列-内容：智能体配置（折叠面板 + 原地编辑）
// ================================================================
async function 渲染智能体详情(智能体ID, 配置) {
  const 容器 = document.getElementById('智能体编辑内容区');
  if (!容器) return;

  if (!配置) {
    容器.innerHTML = '<div class="智能体编辑-空状态"><p>未加载智能体配置</p></div>';
    return;
  }

  const 插件 = 配置.plugin || {};
  const 权限 = 配置.memo_access || { mode: 'all', folders: [] };

  let html = '<div class="智能体编辑-配置区">';

  // ---- 基础信息（默认展开） ----
  html += 渲染折叠面板('basics', '基础信息', true, `
    <div class="智能体编辑-字段">
      <label>名称</label>
      <div class="智能体编辑-字段值 可编辑" data-field="name">${escHtml(配置.name || '')}</div>
    </div>
    <div class="智能体编辑-字段">
      <label>头像</label>
      <div class="智能体编辑-字段值 可编辑" data-field="icon">${escHtml(配置.icon || '🤖')}</div>
    </div>
    <div class="智能体编辑-字段 字段-多行">
      <label>核心身份</label>
      <div class="智能体编辑-字段值 可编辑" data-field="core_identity">${escHtml(插件.core_identity || '无')}</div>
    </div>
    <div class="智能体编辑-字段 字段-多行">
      <label>语气要求</label>
      <div class="智能体编辑-字段值 可编辑" data-field="tone">${escHtml(插件.tone_requirement || '无')}</div>
    </div>
    <div class="智能体编辑-字段 字段-多行">
      <label>输出规则</label>
      <div class="智能体编辑-字段值 可编辑" data-field="output_rules">${escHtml((插件.output_rules || []).join('\n') || '无')}</div>
    </div>
    <div class="智能体编辑-字段 字段-多行">
      <label>禁忌规则</label>
      <div class="智能体编辑-字段值 可编辑" data-field="taboo_rules">${escHtml((插件.taboo_rules || []).join('\n') || '无')}</div>
    </div>
  `);

  // ---- 进阶设定（默认折叠） ----
  html += 渲染折叠面板('advanced', '进阶设定', false, `
    <div class="智能体编辑-字段 字段-多行">
      <label>系统提示词</label>
      <div class="智能体编辑-字段值 可编辑" data-field="system_prompt" style="white-space:pre-wrap;font-family:var(--字体等宽,monospace);font-size:0.78rem;background:var(--卡片背景);padding:10px;border-radius:8px;max-height:200px;overflow-y:auto;">${escHtml(配置.system_prompt || '无')}</div>
      <div style="font-size:0.7rem;color:var(--文字辅色);margin-top:4px;">双击编辑完整提示词</div>
    </div>
    <div class="智能体编辑-字段">
      <label>备忘录权限</label>
      <div class="智能体编辑-字段值 智能体编辑-权限选择器" data-memo-access-selector>
        <span class="智能体编辑-权限文本">${权限模式文本(权限)}</span>
        <span class="智能体编辑-权限编辑提示">✏️</span>
      </div>
    </div>
  `);

  // ---- 元数据（默认折叠） ----
  const 创建 = 配置.created_at ? new Date(配置.created_at) : new Date();
  const 更新 = 配置.updated_at ? new Date(配置.updated_at) : 创建;
  html += 渲染折叠面板('meta', '元数据', false, `
    <div class="智能体编辑-字段">
      <label>ID</label>
      <div class="智能体编辑-字段值" style="font-family:monospace;font-size:0.78rem;">${escHtml(智能体ID)}</div>
    </div>
    <div class="智能体编辑-字段">
      <label>创建时间</label>
      <div class="智能体编辑-字段值">${创建.toLocaleString('zh-CN')}</div>
    </div>
    <div class="智能体编辑-字段">
      <label>更新时间</label>
      <div class="智能体编辑-字段值">${更新.toLocaleString('zh-CN')}</div>
    </div>
  `);

  html += '</div>';
  容器.innerHTML = html;

  // ===== 绑定折叠面板切换 =====
  容器.querySelectorAll('.智能体编辑-折叠面板-头部').forEach(头部 => {
    头部.addEventListener('click', () => {
      const key = 头部.dataset.key;
      const 内容 = 头部.nextElementSibling;
      const 状态标识 = 头部.querySelector('.智能体编辑-折叠面板-状态');
      if (内容.classList.contains('展开')) {
        内容.classList.remove('展开');
        内容.style.display = 'none';
        状态标识.textContent = '▶';
        上次展开折叠[key] = false;
      } else {
        内容.classList.add('展开');
        内容.style.display = 'block';
        状态标识.textContent = '▼';
        上次展开折叠[key] = true;
      }
    });
  });

  // ===== 绑定备忘录权限选择器点击 =====
  const 权限选择器 = 容器.querySelector('[data-memo-access-selector]');
  if (权限选择器) {
    权限选择器.addEventListener('click', (e) => {
      e.stopPropagation();
      打开权限选择器(权限选择器, 智能体ID, 配置, 权限);
    });
  }

  // ===== 绑定可编辑字段双击编辑 =====
  容器.querySelectorAll('.可编辑').forEach(el => {
    el.addEventListener('dblclick', async () => {
      const 字段 = el.dataset.field;
      const 旧值 = (function() {
        if (字段 === 'output_rules') return (配置?.plugin?.output_rules || []).join('\n');
        if (字段 === 'taboo_rules') return (配置?.plugin?.taboo_rules || []).join('\n');
        if (字段 === 'system_prompt') return 配置?.system_prompt || '';
        return el.textContent;
      })();

      const 新值 = await 弹出编辑框(字段, 旧值);
      if (新值 === null || 新值 === 旧值) return;

      try {
        let 当前配置;
        if (字段 === 'name') {
          当前配置 = { ...配置, name: 新值 };
        } else if (字段 === 'icon') {
          当前配置 = { ...配置, icon: 新值 };
        } else if (字段 === 'core_identity') {
          当前配置 = { ...配置, plugin: { ...配置.plugin, core_identity: 新值 } };
        } else if (字段 === 'tone') {
          当前配置 = { ...配置, plugin: { ...配置.plugin, tone_requirement: 新值 } };
        } else if (字段 === 'output_rules' || 字段 === 'taboo_rules') {
          const 规则列表 = 新值.split('\n').map(s => s.trim()).filter(Boolean);
          const 键 = 字段 === 'taboo_rules' ? 'taboo_rules' : 'output_rules';
          当前配置 = { ...配置, plugin: { ...配置.plugin, [键]: 规则列表 } };
        } else if (字段 === 'system_prompt') {
          const 存储 = window.获取存储 && window.获取存储();
          if (存储) {
            await 存储.写文件(`agents/${智能体ID}/system.md`, 新值);
            if (window.加载智能体) await window.加载智能体(智能体ID);
          }
          // 刷新面板但不等待
          window.渲染记忆库面板();
          return;
        }

        if (当前配置) {
          await 保存配置(智能体ID, 当前配置);
          if (window.渲染记忆库面板) await window.渲染记忆库面板();
        }
      } catch (错误) {
        alert('保存失败: ' + 错误.message);
      }
    });
  });
}

// ================================================================
// 折叠面板 HTML 生成
// ================================================================
function 渲染折叠面板(key, 标题, 默认展开, 内容html) {
  const 展开 = 上次展开折叠[key] !== undefined ? 上次展开折叠[key] : 默认展开;
  return `<div class="智能体编辑-折叠面板">
    <div class="智能体编辑-折叠面板-头部" data-key="${key}">
      <span class="智能体编辑-折叠面板-标题">${标题}</span>
      <span class="智能体编辑-折叠面板-状态">${展开 ? '▼' : '▶'}</span>
    </div>
    <div class="智能体编辑-折叠面板-内容${展开 ? ' 展开' : ''}" style="display:${展开 ? 'block' : 'none'}">
      ${内容html}
    </div>
  </div>`;
}

// ================================================================
// 编辑弹窗（复用原版风格）
// ================================================================
function 弹出编辑框(字段, 旧值) {
  return new Promise((resolve) => {
    // 旧版弹窗优先（已在 DOM 中）
    const 遮罩 = document.createElement('div');
    遮罩.className = '智能体编辑-编辑遮罩';
    遮罩.innerHTML = `
      <div class="智能体编辑-编辑弹窗">
        <div class="智能体编辑-编辑弹窗-头部">
          <span>编辑${字段}</span>
          <button class="智能体编辑-编辑弹窗-关闭">✕</button>
        </div>
        <textarea class="智能体编辑-编辑弹窗-文本域" spellcheck="false">${escHtml(旧值)}</textarea>
        <div class="智能体编辑-编辑弹窗-底部">
          <button class="智能体编辑-编辑弹窗-取消">取消</button>
          <button class="智能体编辑-编辑弹窗-确认">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(遮罩);

    const 文本域 = 遮罩.querySelector('textarea');
    const 关闭按钮 = 遮罩.querySelector('.智能体编辑-编辑弹窗-关闭');
    const 取消按钮 = 遮罩.querySelector('.智能体编辑-编辑弹窗-取消');
    const 确认按钮 = 遮罩.querySelector('.智能体编辑-编辑弹窗-确认');

    文本域.focus();
    文本域.setSelectionRange(文本域.value.length, 文本域.value.length);

    function 关闭(结果) {
      document.body.removeChild(遮罩);
      resolve(结果);
    }

    关闭按钮.onclick = () => 关闭(null);
    取消按钮.onclick = () => 关闭(null);
    确认按钮.onclick = () => 关闭(文本域.value);
    遮罩.addEventListener('click', (e) => { if (e.target === 遮罩) 关闭(null); });
    文本域.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') 关闭(null);
      if (e.key === 'Enter' && e.ctrlKey) 关闭(文本域.value);
    });
  });
}

// ================================================================
// 保存配置 + 收藏切换
// ================================================================
async function 保存配置(智能体ID, 新配置) {
  const 存储 = window.获取存储 && window.获取存储();
  if (!存储) throw new Error('存储未初始化');

  const 路径 = `agents/${智能体ID}/agent.json`;
  let 现有 = {};
  try {
    if (await 存储.文件存在(路径)) {
      现有 = JSON.parse(await 存储.读文件(路径));
    }
  } catch (e) { /* ignore */ }

  const 最终 = { ...现有, ...新配置, updated_at: new Date().toISOString() };
  await 存储.写文件(路径, JSON.stringify(最终, null, 2));

  // 同步更新 AI记忆管理器 的 ai_identity 名称（保持三套身份一致）
  if (新配置.name && window.AI记忆管理器 && window.AI记忆管理器.ai身份) {
    try {
      window.AI记忆管理器.ai身份.名称 = 新配置.name;
      await window.AI记忆管理器._saveConfig('ai_identity', window.AI记忆管理器.ai身份);
    } catch(e) { console.warn('同步AI身份名称失败', e); }
  }

  if (window.加载智能体) await window.加载智能体(智能体ID);
}

async function 切换收藏(智能体ID, 收藏) {
  const 存储 = window.获取存储 && window.获取存储();
  if (!存储) return;

  const 路径 = `agents/${智能体ID}/agent.json`;
  try {
    let 配置 = JSON.parse(await 存储.读文件(路径));
    配置.favorite = 收藏;
    配置.updated_at = new Date().toISOString();
    await 存储.写文件(路径, JSON.stringify(配置, null, 2));
    if (window.渲染记忆库面板) await window.渲染记忆库面板();
  } catch (e) {
    console.error('收藏切换失败', e);
  }
}

// ================================================================
// 导出/复制 智能体 JSON
// ================================================================
async function 导出智能体JSON(智能体ID, 配置) {
  const 配置数据 = await 构建导出JSON(智能体ID, 配置);
  const blob = new Blob([JSON.stringify(配置数据, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(配置?.name || 智能体ID).replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')}_智能体.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function 复制智能体JSON(智能体ID, 配置) {
  const 配置数据 = await 构建导出JSON(智能体ID, 配置);
  try {
    await navigator.clipboard.writeText(JSON.stringify(配置数据, null, 2));
    alert('已复制到剪贴板');
  } catch (e) {
    alert('复制失败，请手动复制');
  }
}

async function 构建导出JSON(智能体ID, 配置) {
  const 存储 = window.获取存储 && window.获取存储();
  let 系统提示词 = '';
  if (存储) {
    try {
      const 路径 = `agents/${智能体ID}/system.md`;
      if (await 存储.文件存在(路径)) {
        系统提示词 = await 存储.读文件(路径);
      }
    } catch (e) { /* ignore */ }
  }
  return {
    version: '1.0',
    type: 'ai-assistant-agent',
    id: 智能体ID,
    name: 配置?.name || 智能体ID,
    icon: 配置?.icon || '🤖',
    avatar: 配置?.avatar || '',
    favorite: !!配置?.favorite,
    tags: 配置?.tags || [],
    system_prompt: 系统提示词 || 配置?.system_prompt || '',
    plugin: 配置?.plugin || {},
    memo_access: 配置?.memo_access || { mode: 'none', folders: [] },
    model_params: 配置?.model_params || {},
    created_at: 配置?.created_at,
    updated_at: 配置?.updated_at
  };
}

// ================================================================
// 头像预览
// ================================================================
function 打开头像预览(配置) {
  const 预览浮层 = document.getElementById('头像预览浮层');
  const 预览图片 = document.getElementById('头像预览图片');
  const 预览名字 = document.getElementById('头像预览名字');
  if (!预览浮层) return;

  const 头像源 = 配置?.avatar || 配置?.icon || '🤖';
  const 名称 = 配置?.name || '智能体';

  if (头像源.startsWith('http') || 头像源.startsWith('/') || 头像源.startsWith('data:')) {
    预览图片.src = 头像源;
    预览图片.style.display = 'block';
  } else {
    预览图片.style.display = 'none';
  }
  预览名字.textContent = 名称;
  预览浮层.style.display = 'flex';
}

// ================================================================
// 工具函数
// ================================================================
function 格式化时间(iso时间) {
  if (!iso时间) return '';
  const d = new Date(iso时间);
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function 权限模式文本(权限) {
  if (!权限) return '无权限设置';
  if (权限.mode === 'all') return '✅ 全部备忘录';
  if (权限.mode === 'none') return '❌ 无权查看';
  if (权限.mode === 'folder_list' && 权限.folders?.length > 0) {
    return `📁 ${权限.folders.join(', ')}`;
  }
  return '❌ 无权查看';
}

/**
 * 打开备忘录权限选择器（弹出浮层）
 * 支持三种模式：全部备忘录 / 多选文件夹 / 单一文件夹
 */
async function 打开权限选择器(触发器元素, 智能体ID, 配置, 当前权限) {
  // 移除旧浮层
  const 旧浮层 = document.querySelector('.智能体编辑-权限浮层');
  if (旧浮层) 旧浮层.remove();

  const 当前模式 = 当前权限?.mode || 'all';
  const 已选文件夹 = 当前权限?.folders || [];
  let 临时模式 = 当前模式;
  let 临时文件夹 = [...已选文件夹];

  // 获取文件夹树
  let 文件夹树 = [];
  try {
    if (window._获取文件夹树) 文件夹树 = window._获取文件夹树();
  } catch (e) { /* ignore */ }

  // 扁平化所有文件夹路径
  function 扁平化文件夹(节点列表, 前置 = '') {
    let 结果 = [];
    for (const 节点 of 节点列表) {
      const 全路径 = 前置 ? 前置 + '/' + 节点.名称 : 节点.名称;
      结果.push({ 名称: 节点.名称, 全路径, 子文件夹: 节点.子文件夹?.length > 0 });
      结果 = 结果.concat(扁平化文件夹(节点.子文件夹 || [], 全路径));
    }
    return 结果;
  }

  const 所有文件夹 = 扁平化文件夹(文件夹树);

  // 构建浮层
  const 遮罩 = document.createElement('div');
  遮罩.className = '智能体编辑-权限浮层-遮罩';

  const 浮层 = document.createElement('div');
  浮层.className = '智能体编辑-权限浮层';

  function 渲染选项() {
    const 模式单选 = (值, 标签, 描述) => `
      <label class="智能体编辑-权限-模式选项${临时模式 === 值 ? ' 选中' : ''}" data-mode="${值}">
        <span class="智能体编辑-权限-radio${临时模式 === 值 ? ' 选中' : ''}"></span>
        <div class="智能体编辑-权限-模式内容">
          <span class="智能体编辑-权限-模式标签">${标签}</span>
          <span class="智能体编辑-权限-模式描述">${描述}</span>
        </div>
      </label>`;

    let 文件夹区 = '';
    if (临时模式 === 'folder_single' || 临时模式 === 'folder_list') {
      const 多选 = 临时模式 === 'folder_list';
      文件夹区 = `<div class="智能体编辑-权限-文件夹区">
        <div class="智能体编辑-权限-文件夹提示">${多选 ? '勾选要允许的文件夹' : '选择一个文件夹'}</div>
        <div class="智能体编辑-权限-文件夹列表">
          ${所有文件夹.map(f => {
            const 选中 = 临时文件夹.includes(f.全路径);
            return `<label class="智能体编辑-权限-文件夹项${选中 ? ' 选中' : ''}" data-path="${escHtml(f.全路径)}">
              <span class="智能体编辑-权限-文件夹-checkbox${选中 ? ' 选中' : ''}">${选中 ? '✓' : ''}</span>
              <span class="智能体编辑-权限-文件夹图标">${f.子文件夹 ? '📁' : '📄'}</span>
              <span class="智能体编辑-权限-文件夹名">${escHtml(f.全路径)}</span>
            </label>`;
          }).join('')}
        </div>
      </div>`;
    }

    浮层.innerHTML = `
      <div class="智能体编辑-权限浮层-头部">
        <span>选择备忘录访问权限</span>
        <button class="智能体编辑-权限浮层-关闭">✕</button>
      </div>
      <div class="智能体编辑-权限浮层-主体">
        <div class="智能体编辑-权限-模式组">
          ${模式单选('all', '全部备忘录', '允许访问所有备忘录')}
          ${模式单选('folder_list', '多选文件夹', '仅允许访问所选文件夹的备忘录')}
          ${模式单选('folder_single', '单一文件夹', '仅允许访问单个文件夹及其子文件夹')}
          ${模式单选('none', '无权查看', '禁止访问任何备忘录')}
        </div>
        ${文件夹区}
      </div>
      <div class="智能体编辑-权限浮层-底部">
        <button class="智能体编辑-权限浮层-取消">取消</button>
        <button class="智能体编辑-权限浮层-确认">确认选择</button>
      </div>
    `;

    // 绑定模式切换
    浮层.querySelectorAll('.智能体编辑-权限-模式选项').forEach(el => {
      el.addEventListener('click', () => {
        const 新模式 = el.dataset.mode;
        if (临时模式 !== 新模式) {
          临时模式 = 新模式;
          if (新模式 === 'folder_single') {
            // 单文件夹 → 只保留第一个选中
            临时文件夹 = 临时文件夹.slice(0, 1);
          } else if (新模式 === 'folder_list') {
            // 保持已有选中不变
          } else {
            临时文件夹 = [];
          }
          // 确保模式兼容：folder_single → folder_list 切换时保留选中
          if (新模式 === 'folder_list' && 临时文件夹.length === 0) {
            // 如果单文件夹模式之前选了，保留它
          }
          // 重新渲染浮层
          渲染选项();
          绑定浮层事件();
          绑定文件夹事件();
        }
      });
    });

    // 绑定底部按钮
    浮层.querySelector('.智能体编辑-权限浮层-取消').onclick = () => 遮罩.remove();
    浮层.querySelector('.智能体编辑-权限浮层-确认').onclick = async () => {
      await 保存权限(智能体ID, 配置, 临时模式, 临时文件夹);
      遮罩.remove();
    };
    浮层.querySelector('.智能体编辑-权限浮层-关闭').onclick = () => 遮罩.remove();
  }

  function 绑定文件夹事件() {
    const 多选 = 临时模式 === 'folder_list';
    浮层.querySelectorAll('.智能体编辑-权限-文件夹项').forEach(el => {
      el.addEventListener('click', () => {
        const 路径 = el.dataset.path;
        if (多选) {
          // 多选：toggle
          const idx = 临时文件夹.indexOf(路径);
          if (idx >= 0) {
            临时文件夹.splice(idx, 1);
          } else {
            临时文件夹.push(路径);
          }
        } else {
          // 单文件夹：单选
          临时文件夹 = [路径];
        }
        // 刷新文件夹选中态
        浮层.querySelectorAll('.智能体编辑-权限-文件夹项').forEach(f => {
          const 选中 = 临时文件夹.includes(f.dataset.path);
          f.classList.toggle('选中', 选中);
          const cb = f.querySelector('.智能体编辑-权限-文件夹-checkbox');
          if (cb) {
            cb.classList.toggle('选中', 选中);
            cb.textContent = 选中 ? '✓' : '';
          }
        });
      });
    });
  }

  function 绑定浮层事件() {
    浮层.addEventListener('click', (e) => e.stopPropagation());
  }

  渲染选项();
  绑定浮层事件();
  绑定文件夹事件();

  遮罩.appendChild(浮层);
  遮罩.addEventListener('click', () => 遮罩.remove());
  document.body.appendChild(遮罩);
}

async function 保存权限(智能体ID, 配置, 新模式, 文件夹) {
  const 新权限 = { mode: 新模式, folders: 新模式 === 'folder_single' || 新模式 === 'folder_list' ? 文件夹 : [] };
  const 新配置 = { ...配置, memo_access: 新权限 };
  await 保存配置(智能体ID, 新配置);
  if (window.渲染记忆库面板) await window.渲染记忆库面板();
}

function 估算Token数(配置) {
  let 总长 = 0;
  if (配置?.name) 总长 += 配置.name.length;
  if (配置?.system_prompt) 总长 += 配置.system_prompt.length;
  if (配置?.plugin?.core_identity) 总长 += 配置.plugin.core_identity.length;
  if (配置?.plugin?.tone_requirement) 总长 += 配置.plugin.tone_requirement.length;
  if (配置?.plugin?.output_rules?.length) 总长 += 配置.plugin.output_rules.join('').length;
  if (配置?.plugin?.taboo_rules?.length) 总长 += 配置.plugin.taboo_rules.join('').length;
  return Math.ceil(总长 / 1.5) + 50;
}

// ================================================================
// 绑定事件：在 DOM 加载后调用
// ================================================================

window.绑定记忆库面板 = function() {
  // 监听智能体切换事件，自动刷新
  window.addEventListener('智能体切换', async () => {
    await window.渲染记忆库面板();
  });
  // 监听萃取完成事件，刷新记忆列表和状态概览
  window.addEventListener('记忆萃取完成', async () => {
    const 智能体ID = window.当前智能体ID && window.当前智能体ID();
    const 配置 = window.获取当前智能体配置 && window.获取当前智能体配置();
    if (智能体ID && 配置) {
      // 刷新状态概览（直接找到状态概览元素替换）
      const 概览区 = document.querySelector('#智能体编辑-右列 .智能体编辑-状态概览');
      if (概览区) {
        const 新概览 = await 渲染状态概览(智能体ID, 配置);
        if (新概览) 概览区.outerHTML = 新概览;
      }
      // 刷新记忆列表
      await 渲染记忆列表();
    }
  });
};

// 自动初始化（延迟到 DOM 加载就绪后）
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (window.绑定记忆库面板) {
      window.绑定记忆库面板();
    }
  }, 500);
});

// ================================================================
// 状态概览：SOUL + 记忆/技能/萃取 摘要
// ================================================================

/**
 * 渲染智能体当前状态概览卡片
 * 位置：标签行下方、标签栏上方
 * 内容：SOUL（核心身份）、记忆统计、技能数量、最近萃取时间
 */
async function 渲染状态概览(智能体ID, 配置) {
  try {
    const 插件 = 配置?.plugin || {};

    // 收集记忆统计
    let 记忆总数 = 0, 记忆按类型 = { fact: 0, event: 0, preference: 0, reminder: 0 };
    try {
      const 管理器 = window.AI记忆管理器;
      if (管理器) {
        const 所有记忆 = await 管理器.获取所有记忆();
        记忆总数 = 所有记忆.length;
        for (const m of 所有记忆) {
          const t = m.类型 || 'fact';
          记忆按类型[t] = (记忆按类型[t] || 0) + 1;
        }
      }
    } catch (e) { /* 记忆统计失败则跳过 */ }

    // 收集技能数量
    let 技能数量 = 0;
    let 知识库条数 = 0;
    try {
      const manager = window.备忘录管理器;
      if (manager && typeof manager.getAllMemos === 'function') {
        const allMemos = await manager.getAllMemos();
        技能数量 = allMemos.filter(m =>
          (m.标题 || '').startsWith('[技能]') &&
          (m.标签 || []).includes('技能')
        ).length;
        // 统计当前智能体agent标签的备忘录条数
        const agent标签 = window.获取当前智能体标签 ? window.获取当前智能体标签() : null;
        if (agent标签) {
          知识库条数 = allMemos.filter(m => (m.标签 || []).includes(agent标签)).length;
        }
      }
    } catch (e) { /* 统计失败则跳过 */ }

    // SOUL 摘要
    let soulText = escHtml(插件.core_identity || '无设定');
    if (soulText.length > 40) soulText = soulText.slice(0, 40) + '…';

    // 记忆类型标签
    const 类型标签Html = Object.entries(记忆按类型)
      .filter(([, n]) => n > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([t, n]) => {
        const 标签 = { fact: '事实', event: '事件', preference: '偏好', reminder: '提醒' }[t] || t;
        return `<span class="智能体编辑-状态-类型">${标签}<i>${n}</i></span>`;
      }).join('');

    // 萃取时间
    let 萃取信息 = '';
    try {
      const lastExtract = localStorage.getItem('_last_extract_time');
      if (lastExtract) {
        const diff = Math.floor((Date.now() - parseInt(lastExtract)) / 60000);
        if (diff < 1) 萃取信息 = '刚刚';
        else if (diff < 60) 萃取信息 = `${diff}分钟前`;
        else if (diff < 1440) 萃取信息 = `${Math.floor(diff / 60)}小时前`;
        else 萃取信息 = `${Math.floor(diff / 1440)}天前`;
      }
    } catch (e) { /* */ }

    // 用户画像摘要
    let 用户画像摘要 = '';
    try {
      const 管理器 = window.AI记忆管理器;
      if (管理器 && 管理器.用户画像) {
        const 画像 = 管理器.用户画像;
        const 片 = [];
        if (画像.用户昵称) 片.push(画像.用户昵称);
        if (画像.常用功能?.length) 片.push(`常用: ${画像.常用功能.slice(0, 3).join('/')}`);
        if (画像.交互历史?.对话次数) 片.push(`${画像.交互历史.对话次数}次对话`);
        if (片.length > 0) 用户画像摘要 = 片.join(' · ');
        if (用户画像摘要.length > 50) 用户画像摘要 = 用户画像摘要.slice(0, 50) + '…';
      }
    } catch (e) { /* */ }

    // 构建 HTML
    return `<div class="智能体编辑-状态概览">
      <div class="智能体编辑-状态-行">
        <span class="智能体编辑-状态-标签">SOUL</span>
        <span class="智能体编辑-状态-值" title="${escHtml(插件.core_identity || '')}">${soulText}</span>
      </div>
      <div class="智能体编辑-状态-行">
        <span class="智能体编辑-状态-标签">记忆</span>
        <span class="智能体编辑-状态-数值">${记忆总数}条</span>
        <span class="智能体编辑-状态-类型组">${类型标签Html || '<span class="智能体编辑-状态-空">无</span>'}</span>
      </div>
      <div class="智能体编辑-状态-行">
        <span class="智能体编辑-状态-标签">技能</span>
        <span class="智能体编辑-状态-数值">${技能数量}个</span>
        <span class="智能体编辑-状态-萃取">${萃取信息 ? '最近萃取: ' + 萃取信息 : '尚未萃取'}</span>
      </div>
      <div class="智能体编辑-状态-行">
        <span class="智能体编辑-状态-标签">知识</span>
        <span class="智能体编辑-状态-数值">${知识库条数}条</span>
        <span class="智能体编辑-状态-萃取">${知识库条数 > 0 ? '含 agent:' + (window.当前智能体名 ? window.当前智能体名() : '') + ' 标签' : '开始对话后自动积累'}</span>
      </div>
      ${用户画像摘要 ? `<div class="智能体编辑-状态-行 智能体编辑-状态-行-画像">
        <span class="智能体编辑-状态-标签">用户</span>
        <span class="智能体编辑-状态-值">${用户画像摘要}</span>
      </div>` : ''}
    </div>`;

  } catch (e) {
    console.warn('[状态概览] 渲染失败:', e);
    return '';
  }
}
