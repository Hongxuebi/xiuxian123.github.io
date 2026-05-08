// 备忘录渲染.js - 渲染备忘录列表和文件夹树

// 辅助函数：防XSS
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// 辅助函数：从 HTML 内容提取纯文本（用于卡片预览）
function 提取纯文本(html) {
  if (!html) return '';
  // 如果不含 HTML 标签，直接返回
  if (!/<[^>]+>/.test(html)) return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}
// 导出为全局函数，供其他模块使用
window.提取纯文本 = 提取纯文本;

// 文件夹展开状态（用内存 Set 管理，不依赖 DOM class）
const 已展开文件夹 = new Set();

// 切换文件夹展开/折叠状态
function 切换文件夹展开(文件夹名) {
  if (已展开文件夹.has(文件夹名)) {
    已展开文件夹.delete(文件夹名);
  } else {
    已展开文件夹.add(文件夹名);
  }
}

// 初始化时自动展开所有有子文件夹的父文件夹（首次打开可见完整层级）
function 自动展开有子文件夹的父级(树) {
  if (!树) return;
  树.forEach(节点 => {
    if (节点.子文件夹 && 节点.子文件夹.length > 0) {
      已展开文件夹.add(节点.名称);
      自动展开有子文件夹的父级(节点.子文件夹);
    }
  });
}

// 首次渲染标记（用于自动展开）
let 文件夹树已初始化 = false;

// 渲染抽屉中的文件夹树（支持层级展开）
function 渲染文件夹树() {
  const 容器 = document.getElementById('folderTreeContainer');
  if (!容器) return;

  const 树 = window._获取文件夹树 ? window._获取文件夹树() : [];
  const 当前选中 = window._当前文件夹 ? window._当前文件夹() : '全部';

  // 首次渲染时自动展开所有有子文件夹的节点
  if (!文件夹树已初始化 && 树.length > 0) {
    自动展开有子文件夹的父级(树);
    文件夹树已初始化 = true;
  }

  // 递归渲染文件夹树
  function 渲染树节点(节点列表, 层级) {
    return 节点列表.map(节点 => {
      const 有子文件夹 = 节点.子文件夹 && 节点.子文件夹.length > 0;
      const 是否展开 = 已展开文件夹.has(节点.名称);
      const 箭头方向 = 是否展开 ? 'fa-chevron-down' : 'fa-chevron-right';

      let html = `
        <div class="folder-tree-item ${节点.名称 === 当前选中 ? '选中' : ''}"
             data-folder="${节点.名称}"
             data-level="${层级}">
          <div class="folder-tree-content" style="padding-left: ${12 + 层级 * 20}px;">
            ${有子文件夹 ? `<i class="folder-toggle fa ${箭头方向} text-xs"></i>` : '<span class="folder-toggle-placeholder"></span>'}
            <i class="fa fa-folder text-yellow-400 mr-2"></i>
            <span class="folder-name">${escapeHtml(节点.名称)}</span>
            <span class="folder-count">(${节点.计数 || 0})</span>
          </div>
        </div>
      `;

      // 如果有子文件夹且已展开，递归渲染子文件夹
      if (有子文件夹 && 是否展开) {
        html += 渲染树节点(节点.子文件夹, 层级 + 1);
      }

      return html;
    }).join('');
  }

  容器.innerHTML = 渲染树节点(树, 0);

  // 绑定事件
  绑定文件夹树事件();
}

// 绑定文件夹树点击事件（支持展开/折叠）- 事件委托到容器，只绑定一次
function 绑定文件夹树事件() {
  const 容器 = document.getElementById('folderTreeContainer');
  if (!容器) return;

  // 移除旧监听器，防止重复绑定
  容器.removeEventListener('click', 文件夹树点击委托);
  容器.removeEventListener('contextmenu', 文件夹树右键委托);

  容器.addEventListener('click', 文件夹树点击委托);
  容器.addEventListener('contextmenu', 文件夹树右键委托);
}

// 文件夹树点击处理（供事件委托调用）
function 文件夹树点击委托(e) {
  const 项 = e.target.closest('.folder-tree-item');
  if (!项) return;
  e.stopPropagation();

  // 先关闭可能残留的右键菜单
  关闭文件夹右键菜单();

  const 文件夹名 = 项.dataset.folder;
  const 有子文件夹 = 项.querySelector('.folder-toggle');

  if (e.target.closest('.folder-toggle')) {
    // 点击箭头：只切换展开/折叠，不改选中状态
    切换文件夹展开(文件夹名);
    渲染文件夹树();
  } else {
    // 点击文件夹名称/图标：选中 + 如果有子文件夹则切换展开/折叠
    if (有子文件夹) {
      切换文件夹展开(文件夹名);
    }
    // 用户主动操作，清除AI筛选
    if (window._获取AI临时筛选 && window._获取AI临时筛选()) {
      window._设置AI临时筛选(null);
    }
    if (window._设置当前文件夹) {
      window._设置当前文件夹(文件夹名);
    }
    if (window._设置当前筛选) {
      window._设置当前筛选('all');
    }
    if (window._设置当前日期筛选) {
      window._设置当前日期筛选(null);
    }
    if (window._设置当前标签筛选) {
      window._设置当前标签筛选(null);
    }
    console.log('[文件夹树点击] 设置后 → folder=' + window._当前文件夹() + ' | 日期筛选=' + (window._当前日期筛选 ? window._当前日期筛选() : 'null'));
    渲染文件夹树();
    if (window.渲染备忘录列表) {
      window.渲染备忘录列表();
    }
  }
}

// 文件夹树右键菜单处理
function 文件夹树右键委托(e) {
  const 项 = e.target.closest('.folder-tree-item');
  if (!项) return;
  e.preventDefault();

  const 文件夹名 = 项.dataset.folder;
  if (文件夹名 === '全部') return;

  // 关闭已有的菜单（防止多个菜单叠加）
  关闭文件夹右键菜单();
  显示文件夹右键菜单(e.clientX, e.clientY, 文件夹名);
}

// 关闭已存在的右键菜单
function 关闭文件夹右键菜单() {
  const 菜单 = document.getElementById('folder-context-menu');
  if (菜单) 菜单.remove();
}

// 显示文件夹右键菜单
function 显示文件夹右键菜单(x, y, 文件夹名) {
  // 先关闭已有的菜单
  关闭文件夹右键菜单();

  const 菜单 = document.createElement('div');
  菜单.id = 'folder-context-menu';
  菜单.className = 'folder-context-menu';
  菜单.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 4px 0;
    z-index: 10000;
    min-width: 160px;
  `;

  // 构建菜单项
  const 是顶层文件夹 = !window._获取子文件夹 || !window.获取文件夹的父文件夹 || window.获取文件夹的父文件夹(文件夹名) === null;

  菜单.innerHTML = `
    <div class="context-menu-item" data-action="create-subfolder">
      <i class="fa fa-folder-plus mr-2"></i> 新建子文件夹
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" data-action="move-folder">
      <i class="fa fa-folder-open mr-2"></i> 移动文件夹
    </div>
    <div class="context-menu-item" data-action="rename-folder">
      <i class="fa fa-edit mr-2"></i> 重命名
    </div>
    <div class="context-menu-item" data-action="export-folder">
      <i class="fa fa-download mr-2"></i> 导出此文件夹
    </div>
    <div class="context-menu-item 危险" data-action="delete-folder">
      <i class="fa fa-trash mr-2"></i> 删除文件夹
    </div>
  `;

  // 先挂载到 body（不可见），测量实际高度后再定位
  菜单.style.visibility = 'hidden';
  document.body.appendChild(菜单);

  // 触底检测：若菜单超出视口底部，则向上弹出
  const 菜单高度 = 菜单.offsetHeight;
  const 菜单宽度 = 菜单.offsetWidth;
  const 视口高度 = window.innerHeight;
  const 视口宽度 = window.innerWidth;

  const 最终Y = (y + 菜单高度 > 视口高度 - 8)
    ? Math.max(8, y - 菜单高度)
    : y;
  const 最终X = (x + 菜单宽度 > 视口宽度 - 8)
    ? Math.max(8, x - 菜单宽度)
    : x;

  菜单.style.top = `${最终Y}px`;
  菜单.style.left = `${最终X}px`;
  菜单.style.visibility = 'visible';

  // 点击菜单项处理
  菜单.querySelectorAll('.context-menu-item').forEach(菜单项 => {
    菜单项.addEventListener('click', async (e) => {
      const action = 菜单项.dataset.action;

      try {
        switch (action) {
          case 'create-subfolder':
            await 处理创建子文件夹(文件夹名);
            break;
          case 'move-folder':
            await 处理移动文件夹(文件夹名);
            break;
          case 'rename-folder':
            await 处理重命名文件夹(文件夹名);
            break;
          case 'delete-folder':
            await 处理删除文件夹(文件夹名);
            break;
          case 'export-folder':
            window.导出文件夹?.(文件夹名);
            break;
        }
      } finally {
        菜单.remove();
        document.removeEventListener('click', 关闭菜单);
      }
    });
  });

  // 点击其他地方关闭菜单
  const 关闭菜单 = (e) => {
    if (!菜单.contains(e.target)) {
      菜单.remove();
      document.removeEventListener('click', 关闭菜单);
    }
  };
  setTimeout(() => document.addEventListener('click', 关闭菜单), 0);
}

// 处理创建子文件夹
async function 处理创建子文件夹(父文件夹名) {
  const 子文件夹名 = await window._自定义输入(`在"${父文件夹名}"下创建子文件夹：`, '');
  if (子文件夹名 && window._创建文件夹) {
    const 成功 = window._创建文件夹(子文件夹名, 父文件夹名);
    if (成功) {
      已展开文件夹.add(父文件夹名);
      渲染文件夹树();
    } else {
      alert('文件夹已存在或创建失败');
    }
  }
}

// 处理移动文件夹
async function 处理移动文件夹(源文件夹名) {
  // 获取所有可选的目标文件夹（排除自己和自己的子文件夹）
  const 文件夹树 = window._获取文件夹树 ? window._获取文件夹树() : [];
  const 所有文件夹 = [];

  function 收集文件夹(节点列表, 排除列表) {
    节点列表.forEach(节点 => {
      if (!排除列表.includes(节点.名称)) {
        所有文件夹.push(节点.名称);
        if (节点.子文件夹) 收集文件夹(节点.子文件夹, 排除列表);
      }
    });
  }

  // 获取源文件夹的所有子文件夹（需要排除）
  const 子文件夹列表 = window._获取所有子文件夹名 ? window._获取所有子文件夹名(源文件夹名) : [];
  const 排除列表 = [源文件夹名, ...子文件夹列表];

  // 收集可选目标文件夹
  收集文件夹(文件夹树, 排除列表);

  // 添加"移动到顶层"选项
  所有文件夹.unshift('📁 顶层（无父文件夹）');

  if (所有文件夹.length === 0) {
    alert('没有可用的目标文件夹');
    return;
  }

  // 创建下拉菜单选择目标文件夹
  const 目标文件夹 = await 显示文件夹选择对话框(所有文件夹, `移动 "${源文件夹名}" 到:`);
  if (!目标文件夹) return;

  const 实际目标 = 目标文件夹 === '📁 顶层（无父文件夹）' ? null : 目标文件夹;

  // 执行移动
  const 成功 = window._移动文件夹 ? window._移动文件夹(源文件夹名, 实际目标) : false;
  if (成功) {
    alert(`已将 "${源文件夹名}" 移动到 "${实际目标 || '顶层'}"`);
    渲染文件夹树();
    if (window.渲染备忘录列表) window.渲染备忘录列表();
  } else {
    alert('移动失败');
  }
}

// 处理重命名文件夹
async function 处理重命名文件夹(原文件夹名) {
  const 新文件夹名 = await window._自定义输入(`将 "${原文件夹名}" 重命名为：`, 原文件夹名);
  if (!新文件夹名 || 新文件夹名.trim() === '' || 新文件夹名.trim() === 原文件夹名) return;

  const 成功 = window._重命名文件夹 ? window._重命名文件夹(原文件夹名, 新文件夹名.trim()) : false;
  if (成功) {
    alert(`已重命名为 "${新文件夹名.trim()}"`);
    渲染文件夹树();
    if (window.渲染备忘录列表) window.渲染备忘录列表();
  } else {
    alert('重命名失败，可能文件夹已存在');
  }
}

// 处理删除文件夹
async function 处理删除文件夹(文件夹名) {
  // 获取该文件夹及其子文件夹中的所有备忘录
  const 子文件夹列表 = window._获取所有子文件夹名 ? window._获取所有子文件夹名(文件夹名) : [];
  const 相关文件夹列表 = [文件夹名, ...子文件夹列表];

  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  const 受影响备忘录 = 数据源.filter(m => 相关文件夹列表.includes(m.文件夹));

  const 确认消息 = 受影响备忘录.length > 0
    ? `确定要删除文件夹 "${文件夹名}" 吗？\n\n该文件夹包含 ${子文件夹列表.length} 个子文件夹和 ${受影响备忘录.length} 条备忘录，这些备忘录将被移入回收站。`
    : `确定要删除文件夹 "${文件夹名}" 吗？`;

  if (!await window._自定义确认(确认消息)) return;

  const 成功 = window._删除文件夹 ? window._删除文件夹(文件夹名) : false;
  if (成功) {
    alert(`已删除文件夹 "${文件夹名}"，${受影响备忘录.length} 条备忘录已移入回收站`);
    渲染文件夹树();
    if (window.渲染备忘录列表) window.渲染备忘录列表();
  } else {
    alert('删除失败');
  }
}

// 显示文件夹选择对话框（返回Promise）
window._显示文件夹选择对话框 = function 显示文件夹选择对话框(文件夹列表, 标题) {
  return new Promise((resolve) => {
    // 创建遮罩和对话框
    const 遮罩 = document.createElement('div');
    遮罩.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 20000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const 对话框 = document.createElement('div');
    对话框.style.cssText = `
      background: white;
      border-radius: 12px;
      width: 320px;
      max-height: 400px;
      display: flex;
      flex-direction: column;
    `;

    对话框.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${标题}</div>
      <div style="overflow-y: auto; max-height: 280px; padding: 8px 0;">
        ${文件夹列表.map(名称 => `
          <div class="文件夹选择项" data-folder="${名称}" style="
            padding: 12px 16px;
            cursor: pointer;
            transition: background 0.2s;
          " onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
            ${名称}
          </div>
        `).join('')}
      </div>
      <div style="padding: 12px 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 8px;">
        <button id="取消选择" style="padding: 8px 16px; border: none; background: #f3f4f6; border-radius: 6px; cursor: pointer;">取消</button>
      </div>
    `;

    遮罩.appendChild(对话框);
    document.body.appendChild(遮罩);

    // 绑定选择事件
    对话框.querySelectorAll('.文件夹选择项').forEach(项 => {
      项.addEventListener('click', () => {
        resolve(项.dataset.folder);
        遮罩.remove();
      });
    });

    // 绑定取消事件
    对话框.querySelector('#取消选择').addEventListener('click', () => {
      resolve(null);
      遮罩.remove();
    });

    // 点击遮罩关闭
    遮罩.addEventListener('click', (e) => {
      if (e.target === 遮罩) {
        resolve(null);
        遮罩.remove();
      }
    });
  });
}

// 渲染筛选按钮（全部备忘 / 收藏 / 最近删除）并显示计数
function 渲染筛选按钮() {
  const 容器 = document.getElementById('筛选内容');
  if (!容器) return;

  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  const 当前筛选 = window._当前筛选 ? window._当前筛选() : 'all';
  const 当前文件夹 = window._当前文件夹 ? window._当前文件夹() : '全部';

  // 计算各分类数量（排除已删除的）
  const 全部数量 = 数据源.filter(m => !m.已删除).length;
  const 收藏数量 = 数据源.filter(m => !!m.收藏 && !m.已删除).length;
  const 已删除数量 = 数据源.filter(m => m.已删除 === true).length;

  // 判断激活状态
  const 全部激活 = (当前筛选 === 'all' && 当前文件夹 === '全部') ? ' 激活' : '';
  const 收藏激活 = 当前筛选 === 'favorite' ? ' 激活' : '';
  const 删除激活 = 当前筛选 === 'deleted' ? ' 激活' : '';

  容器.innerHTML = `
    <button class="筛选按钮${全部激活}" data-filter="all">全部备忘<span class="filter-count">${全部数量}</span></button>
    <button class="筛选按钮${收藏激活}" data-filter="favorite">收藏<span class="filter-count">${收藏数量}</span></button>
    <button class="筛选按钮${删除激活}" data-filter="deleted">最近删除<span class="filter-count">${已删除数量}</span></button>
  `;
}

// 更新备忘录头部标题：显示当前筛选/文件夹状态及数量
function 更新备忘录标题() {
  const 标题区 = document.querySelector('.备忘录头部 h2');
  const 顶部标题 = document.getElementById('备忘录标题');
  const 顶部计数 = document.getElementById('备忘录计数');
  if (!标题区 && !顶部标题) return;
  // 只在备忘录面板激活时显示顶部标题，避免刷新后在对话界面出现
  const 当前面板 = window.当前激活面板 || '对话面板';
  if (顶部标题) {
    // 用CSS类控制显隐，避免inline style被意外覆盖
    if (当前面板 === '备忘录面板') {
      顶部标题.classList.add('面板可见');
    } else {
      顶部标题.classList.remove('面板可见');
    }
  }
  const 当前筛选 = window._当前筛选 ? window._当前筛选() : 'all';
  const 当前文件夹 = window._当前文件夹 ? window._当前文件夹() : '全部';
  const 当前日期筛选 = window._当前日期筛选 ? window._当前日期筛选() : null;
  const 搜索关键词 = window._当前搜索关键词 ? window._当前搜索关键词() : '';
  const 当前标签筛选 = window._当前标签筛选 ? window._当前标签筛选() : null;
  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  const AI临时筛选 = window._获取AI临时筛选 ? window._获取AI临时筛选() : null;

  // ========== AI 筛选模式：最高优先级显示 AI 标题（忽略其他所有筛选）==========
  if (AI临时筛选) {
    // 使用实际过滤后的数量（而非 memoIds.length），并剥离标题里的数量标记
    const 实际数量 = (window._备忘录数据源 || window._备忘录数据 || []).filter(m => 
      AI临时筛选.memoIds.includes(String(m.id))
    ).length;
    const 纯净标题 = AI临时筛选.title.replace(/\s*\(\d+条\)\s*$/, '');
    const 完整标题 = `🤖 ${纯净标题} (${实际数量}条)`;
    if (标题区) 标题区.textContent = 完整标题;
    if (顶部标题) { 顶部标题.style.display = 'inline'; 顶部标题.textContent = 完整标题; }
    return;
  }

  // 计算当前视图对应的备忘录数量（逻辑与渲染列表保持完全一致）
  let 当前数量;
  if (当前筛选 === 'deleted') {
    当前数量 = 数据源.filter(m => m.已删除 === true).length;
  } else if (当前筛选 === 'favorite') {
    当前数量 = 数据源.filter(m => !!m.收藏 && !m.已删除).length;
  } else if (当前日期筛选) {
    const { year, month } = 当前日期筛选;
    当前数量 = 数据源.filter(m => {
      const d = new Date(m.日期 || m.更新时间);
      return String(d.getFullYear()) === year &&
             String(d.getMonth() + 1).padStart(2, '0') === month &&
             !m.已删除;
    }).length;
  } else if (当前标签筛选) {
    当前数量 = 数据源.filter(m => {
      const 标签列表 = Array.isArray(m.标签) ? m.标签 : [];
      return 标签列表.includes(当前标签筛选) && !m.已删除;
    }).length;
  } else if (当前文件夹 !== '全部') {
    const 文件夹列表 = [当前文件夹];
    if (window._获取所有子文件夹名) {
      文件夹列表.push(...window._获取所有子文件夹名(当前文件夹));
    }
    当前数量 = 数据源.filter(m => 文件夹列表.includes(m.文件夹) && !m.已删除).length;
  } else {
    当前数量 = 数据源.filter(m => !m.已删除).length;
  }

  // 构建标题（与数量计算共用同一套条件判断，顺序完全对齐）
  let 标题;
  if (搜索关键词) {
    标题 = `📝 搜索："${搜索关键词}"`;
  } else if (当前筛选 === 'favorite') {
    标题 = `⭐ 收藏 (${当前数量})`;
  } else if (当前筛选 === 'deleted') {
    标题 = `🗑️ 最近删除 (${当前数量})`;
  } else if (当前日期筛选) {
    const { year, month } = 当前日期筛选;
    const 月名称 = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'][parseInt(month) - 1];
    标题 = `📅 ${year}年 ${月名称} (${当前数量})`;
  } else if (当前标签筛选) {
    标题 = `🏷️ ${当前标签筛选} (${当前数量})`;
  } else if (当前文件夹 !== '全部') {
    标题 = `📁 ${当前文件夹} (${当前数量})`;
  } else {
    标题 = `📝 我的备忘录 (${当前数量})`;
  }
  if (标题区) 标题区.textContent = 标题;
  if (顶部标题) {
    const 去Emoji = t => t.replace(/[🌀-🧿]/gu, '').replace(/^\s+|\s+$/g, '');
    const 简洁标题 = 去Emoji(标题).replace(/\s*\(\d+\)\s*$/, '').trim();
    顶部标题.style.display = 'inline';
    顶部标题.textContent = 简洁标题 + ' (' + 当前数量 + ')';
  }
}

// 渲染单个备忘录卡片（根据视图类型显示不同操作栏）
function 渲染备忘录卡片(备忘录) {
  const 当前筛选 = window._当前筛选 ? window._当前筛选() : 'all';
  const 是回收站视图 = 当前筛选 === 'deleted';
  const 多选启用 = window.多选状态?.是否启用 || false;
  const 是否选中 = window.多选状态?.是否选中(备忘录.id) || false;

  // 多选复选框
  const 复选框HTML = 多选启用 ? `
    <div class="多选复选框 ${是否选中 ? '选中' : ''}" data-id="${备忘录.id}">
      ${是否选中 ? '✓' : ''}
    </div>
  ` : '';

  // 回收站视图：显示恢复/永久删除按钮
  const 操作栏 = 是回收站视图 ? `
    <div class="卡片操作栏 回收站操作栏">
      <button class="操作栏按钮" data-action="restore" title="恢复">↩️</button>
      <button class="操作栏按钮" data-action="permanent-delete" title="永久删除">🗑️</button>
    </div>
  ` : `
    <div class="卡片操作栏">
      <button class="操作栏按钮" data-action="favorite" title="收藏">
        ${备忘录.收藏 ? '★' : '☆'}
      </button>
      <button class="操作栏按钮" data-action="pin" title="置顶">📌</button>
      <button class="操作栏按钮" data-action="move" title="移动到文件夹">📁</button>
      <button class="操作栏按钮" data-action="delete" title="删除">🗑️</button>
    </div>
  `;

  // 回收站视图显示删除时间
  const 删除标记 = 是回收站视图 && 备忘录.删除时间 ? `
    <span class="删除时间">删除于 ${new Date(备忘录.删除时间).toLocaleString('zh-CN')}</span>
  ` : '';

  // 提取内容中的第一张图片
  function 提取第一张图片(内容) {
    if (!内容) return null;
    const imgMatch = 内容.match(/<img[^>]+src="([^"]+)"/);
    return imgMatch ? imgMatch[1] : null;
  }

  // 置顶标记
  const 置顶标记 = 备忘录.已置顶 ? ' 已置顶' : '';

  return `
    <div class="备忘录卡片滑动容器 ${是回收站视图 ? '回收站卡片' : ''} ${多选启用 ? '多选模式' : ''} ${置顶标记}" data-id="${备忘录.id}">
      ${复选框HTML}
      ${操作栏}
      <div class="备忘录卡片${置顶标记 ? ' 置顶卡片' : ''}">
        <div class="卡片内容">
          <div class="卡片头部">
            <h3 class="卡片标题">${escapeHtml(备忘录.标题)}</h3>
          </div>
          <div class="卡片日期内容">
            <span class="卡片日期">${备忘录.日期}</span>
            <span class="卡片内容预览">${escapeHtml(提取纯文本(备忘录.内容).slice(0, 100))}</span>
          </div>
          ${删除标记 ? `<div class="卡片删除信息">${删除标记}</div>` : ''}
          ${(function() {
            const deadlines = 备忘录.todoDeadlines || [];
            if (deadlines.length > 0) {
              const now = new Date();
              const valid = deadlines.filter(d => d).map(d => ({ raw: d, date: new Date(d) })).filter(d => !isNaN(d.date.getTime()));
              if (valid.length > 0) {
                const earliest = valid.sort((a,b) => a.date - b.date)[0];
                const isOverdue = earliest.date < now;
                const dateOnly = earliest.raw.slice(0, 10);
                const timeOnly = earliest.raw.length > 10 ? earliest.raw.slice(11, 16) : '';
                return `<div class="卡片截止提示 ${isOverdue ? '过期' : ''}">⏰ ${dateOnly}${timeOnly ? ' ' + timeOnly : ''}</div>`;
              }
            }
            return '';
          })()}
          <div class="卡片标签区">
            ${备忘录.标签.map(标签 => `
              <span class="卡片标签" onclick="window.按标签筛选('${escapeHtml(标签)}')">${escapeHtml(标签)}</span>
            `).join('')}
          </div>
        </div>
        ${(function() {
          const 第一张图片 = 提取第一张图片(备忘录.内容);
          return 第一张图片 ? `
            <div class="卡片图片容器">
              <img src="${第一张图片}" class="卡片缩略图" alt="图片">
            </div>
          ` : '';
        })()}
      </div>
    </div>
  `;
}

// 渲染备忘录列表
function 渲染备忘录列表() {
  渲染筛选按钮(); // 同步刷新筛选按钮计数
  更新备忘录标题(); // 同步更新头部标题
  const 列表容器 = document.getElementById('备忘录卡片列表');
  const 空状态 = document.getElementById('备忘录空状态');
  if (!列表容器 || !空状态) return;

  // 统一从备忘录管理器读取数据
  let 筛选后的备忘录 = window._备忘录数据源 || window._备忘录数据 || [];
  const 当前文件夹 = window._当前文件夹();
  const 当前搜索关键词 = window._当前搜索关键词();
  const 当前筛选 = window._当前筛选();
  const 当前日期筛选 = window._当前日期筛选 ? window._当前日期筛选() : null;
  const 当前标签筛选 = window._当前标签筛选 ? window._当前标签筛选() : null;

  // ========== AI 临时筛选（最高优先级）：只记录ID，结果在所有筛选完成后更新模式条 ==========
  const AI临时筛选 = window._获取AI临时筛选 ? window._获取AI临时筛选() : null;
  console.log('[🔍调试] AI临时筛选=', AI临时筛选, '| 当前筛选=', 当前筛选, '| 当前文件夹=', 当前文件夹, '| 当前日期筛选=', 当前日期筛选);
  let AI模式备忘录 = null;
  if (AI临时筛选) {
    AI模式备忘录 = 筛选后的备忘录.filter(m => AI临时筛选.memoIds.includes(String(m.id)));
    console.log('[🔍调试] AI模式：原始数据', 筛选后的备忘录.length, '条 → AI过滤后', AI模式备忘录.length, '条 | memoIds=', AI临时筛选.memoIds);
    筛选后的备忘录 = AI模式备忘录;
  }

  // 回收站视图隐藏整理和新建按钮
  const 回收站模式 = 当前筛选 === 'deleted';

  // 基础筛选：AI模式下跳过（AI结果就是最终结果）；正常/回收站视图各自过滤
  if (!AI临时筛选) {
    const 筛选前数量 = 筛选后的备忘录.length;
    if (当前筛选 === 'deleted') {
      筛选后的备忘录 = 筛选后的备忘录.filter(备忘录 => 备忘录.已删除 === true);
    } else {
      筛选后的备忘录 = 筛选后的备忘录.filter(备忘录 => !备忘录.已删除);
    }
    console.log('[🔍调试] 基础筛选：', 筛选前数量, '→', 筛选后的备忘录.length, '条 (已删除过滤)');
  } else {
    console.log('[🔍调试] 基础筛选：AI模式跳过');
  }
  
  // 按文件夹筛选：AI模式下跳过，其他模式正常运行
  if (!AI临时筛选 && 当前文件夹 !== '全部' && 当前筛选 !== 'deleted' && !当前日期筛选 && !当前标签筛选) {
    const 筛选前数量 = 筛选后的备忘录.length;
    const 文件夹列表 = [当前文件夹];
    if (window._获取所有子文件夹名) {
      文件夹列表.push(...window._获取所有子文件夹名(当前文件夹));
    }
    筛选后的备忘录 = 筛选后的备忘录.filter(备忘录 => 文件夹列表.includes(备忘录.文件夹));
    console.log('[🔍调试] 文件夹筛选：', 筛选前数量, '→', 筛选后的备忘录.length, '条');
  } else if (AI临时筛选) {
    console.log('[🔍调试] 文件夹筛选：AI模式跳过');
  }
  // 按收藏筛选：AI模式下跳过
  if (!AI临时筛选 && 当前筛选 === 'favorite') {
    const 筛选前数量 = 筛选后的备忘录.length;
    筛选后的备忘录 = 筛选后的备忘录.filter(备忘录 => !!备忘录.收藏);
    console.log('[🔍调试] 收藏筛选：', 筛选前数量, '→', 筛选后的备忘录.length, '条');
  }
  // 按搜索关键词筛选：AI模式下跳过
  if (!AI临时筛选 && 当前搜索关键词) {
    const 筛选前数量 = 筛选后的备忘录.length;
    const 关键词 = 当前搜索关键词.toLowerCase();
    筛选后的备忘录 = 筛选后的备忘录.filter(备忘录 => 
      备忘录.标题.toLowerCase().includes(关键词) || 
      提取纯文本(备忘录.内容).toLowerCase().includes(关键词)
    );
    console.log('[🔍调试] 搜索筛选：', 筛选前数量, '→', 筛选后的备忘录.length, '条');
  }
  
  // 按日期筛选（从更多菜单的日期树进入，当前日期筛选已在上方声明）：AI模式下跳过
  if (当前日期筛选 && 当前筛选 !== 'deleted') {
    const { year, month } = 当前日期筛选;
    筛选后的备忘录 = 筛选后的备忘录.filter(备忘录 => {
      const d = new Date(备忘录.日期 || 备忘录.更新时间);
      return String(d.getFullYear()) === year &&
             String(d.getMonth() + 1).padStart(2, '0') === month;
    });
  }

  // 按标签筛选（从标签选择页的“查看相关备忘录”进入）
  console.log('[渲染] 当前标签筛选=', 当前标签筛选);
  if (当前标签筛选 && 当前筛选 !== 'deleted') {
    筛选后的备忘录 = 筛选后的备忘录.filter(备忘录 => {
      const 标签列表 = Array.isArray(备忘录.标签) ? 备忘录.标签 : [];
      return 标签列表.includes(当前标签筛选);
    });
  }

  // ========== 排序 ==========
  const 排序方式原始 = localStorage.getItem('备忘录排序方式') || '编辑时间';
  const 旧值映射 = { '最近修改': '编辑时间', '最早创建': '创建时间', '标题 A→Z': '编辑时间' };
  const 排序方式 = 旧值映射[排序方式原始] || 排序方式原始;

  // 日期筛选模式下强制按创建时间从新到旧排序
  if (当前日期筛选) {
    筛选后的备忘录.sort((a, b) => new Date(b.日期 || b.更新时间) - new Date(a.日期 || a.更新时间));
  } else {
    // 置顶优先：已置顶的排在上方，越早置顶越靠上
    筛选后的备忘录.sort((a, b) => {
      // 有置顶 vs 无置顶：置顶优先
      if (a.已置顶 && !b.已置顶) return -1;
      if (!a.已置顶 && b.已置顶) return 1;
      // 都有置顶：按置顶时间升序（早置顶在前）
      if (a.已置顶 && b.已置顶) {
        return new Date(a.置顶时间) - new Date(b.置顶时间);
      }
      // 都没置顶：按所选排序方式
      switch (排序方式) {
        case '编辑时间':
          return new Date(b.更新时间 || b.日期) - new Date(a.更新时间 || a.日期);
        case '创建时间':
          return new Date(b.日期 || b.更新时间) - new Date(a.日期 || a.更新时间);
        default:
          return new Date(b.更新时间 || b.日期) - new Date(a.更新时间 || a.日期);
      }
    });
  }

  // ========== AI 模式条：所有筛选完成后更新，确保计数与列表一致 ==========
  const 整理按钮 = document.getElementById('AI整理按钮');
  const 悬浮按钮 = document.getElementById('悬浮新建按钮');
  const AI模式条 = document.getElementById('AI筛选模式条');
  console.log('[🔍调试] 最终列表数量：', 筛选后的备忘录.length, '| AI模式条元素存在：', !!AI模式条);
  if (AI临时筛选 && AI模式条) {
    AI模式条.style.display = 'flex';
    // 剥离标题里可能存在的数量标记如 "(4条)"，避免和动态数量重复显示
    const 纯净标题 = AI临时筛选.title.replace(/\s*\(\d+条\)\s*$/, '');
    AI模式条.querySelector('.AI筛选标题').textContent = 纯净标题;
    AI模式条.querySelector('.AI筛选数量').textContent = '(' + 筛选后的备忘录.length + '条)';
    console.log('[🔍调试] AI模式条显示：原标题=', AI临时筛选.title, '| 净化后=', 纯净标题, '| 实际数量=', 筛选后的备忘录.length);
    // 每次渲染时重新绑定清除按钮，确保在任何环境下都能响应
    const 清除按钮 = AI模式条.querySelector('#清除AI筛选');
    if (清除按钮 && !清除按钮._hasHandler) {
      清除按钮._hasHandler = true;
      清除按钮.onclick = function(e) {
        console.log('[🔍调试] 清除AI筛选按钮 onclick 触发');
        e.preventDefault();
        e.stopPropagation();
        this.style.transform = 'scale(0.85)';
        setTimeout(() => this.style.transform = '', 120);
        if (window._设置AI临时筛选) {
          window._设置AI临时筛选(null);
          // 恢复默认状态
          if (window._设置当前文件夹) window._设置当前文件夹('全部');
          if (window._设置当前筛选) window._设置当前筛选('all');
          if (window._设置当前日期筛选) window._设置当前日期筛选(null);
          if (window._设置当前搜索关键词) window._设置当前搜索关键词('');
          if (window._设置当前标签筛选) window._设置当前标签筛选(null);
        }
      };
      console.log('[🔍调试] 清除按钮 onclick 已绑定');
    }
    if (整理按钮) 整理按钮.style.display = 'none';
    // 保留悬浮新建按钮，让用户能在筛选结果中补充新备忘录
    // 新备忘录创建时自动清除 AI 筛选（在备忘录UI.js中处理）
  } else if (AI模式条) {
    AI模式条.style.display = 'none';
    if (整理按钮) 整理按钮.style.display = 当前筛选 === 'deleted' ? 'none' : '';
    if (悬浮按钮) {
      悬浮按钮.style.display = (当前筛选 === 'deleted' || 回收站模式) ? 'none' : '';
    }
    console.log('[🔍调试] AI模式条隐藏');
  }

  // ========== 按日期分组渲染 ==========
  const 是否分组 = localStorage.getItem('备忘录是否分组') === 'true';

  if (筛选后的备忘录.length > 0 && 是否分组 && 当前筛选 !== 'deleted' && !AI临时筛选) {
    const 今天 = new Date().toDateString();
    const 昨天 = new Date(Date.now() - 86400000).toDateString();

    // 按日期分组
    const 分组 = { '今天': [], '昨天': [], '更早': [] };
    筛选后的备忘录.forEach(备忘录 => {
      const 日期 = new Date(备忘录.更新时间 || 备忘录.日期).toDateString();
      if (日期 === 今天) 分组['今天'].push(备忘录);
      else if (日期 === 昨天) 分组['昨天'].push(备忘录);
      else 分组['更早'].push(备忘录);
    });

    let html = '';
    for (const [分组名, 列表] of Object.entries(分组)) {
      if (列表.length === 0) continue;
      html += `<div class="备忘录日期分组标题">${分组名} (${列表.length})</div>`;
      html += 列表.map(备忘录 => 渲染备忘录卡片(备忘录)).join('');
    }
    列表容器.innerHTML = html;
    // 绑定卡片点击事件（进入编辑）
    const 分组卡片 = 列表容器.querySelectorAll('.备忘录卡片');
    分组卡片.forEach(卡片 => {
      卡片.addEventListener('click', (e) => {
        if (window._是否发生了滑动 && window._是否发生了滑动()) return;
        if (e.target.closest('.操作栏按钮')) return;
        const 容器 = 卡片.closest('.备忘录卡片滑动容器');
        if (!容器) return;
        if (window._刚收起卡片 && window._刚收起卡片()) return;
        if (window._当前展开的卡片 && window._当前展开的卡片()) { window._收起所有卡片(); return; }
        const id = parseInt(容器.dataset.id);
        if (当前筛选 === 'deleted') return;
        window.打开编辑页面(id);
      });
    });
    if (window.初始化卡片滑动) setTimeout(() => window.初始化卡片滑动(), 10);
    列表容器.style.display = 'flex';
    空状态.style.display = 'none';
  } else if (筛选后的备忘录.length > 0) {
    列表容器.innerHTML = 筛选后的备忘录.map(备忘录 => 渲染备忘录卡片(备忘录)).join('');

    // 绑定卡片点击事件（进入编辑）
    const 所有卡片 = 列表容器.querySelectorAll('.备忘录卡片');
    所有卡片.forEach(卡片 => {
      卡片.addEventListener('click', (e) => {
        const 容器 = 卡片.closest('.备忘录卡片滑动容器');
        if (容器 && 容器.classList.contains('展开')) return;
        if (window._是否发生了滑动 && window._是否发生了滑动()) return;
        if (e.target.closest('.操作栏按钮')) return;
        if (window._刚收起卡片 && window._刚收起卡片()) return;
        const id = parseInt(容器.dataset.id);
        if (当前筛选 === 'deleted') { return; }
        if (window._当前展开的卡片 && window._当前展开的卡片()) { window._收起所有卡片(); return; }
        window.打开编辑页面(id);
      });
    });

    // 初始化滑动功能
    if (window.初始化卡片滑动) setTimeout(() => window.初始化卡片滑动(), 10);

    列表容器.style.display = 'flex';
    空状态.style.display = 'none';
  } else {
    列表容器.style.display = 'none';
    // ========== 空状态多态显示 ==========
    const 空状态图标 = 空状态.querySelector('.空状态图标');
    const 空状态文本 = 空状态.querySelector('.空状态文本');
    let 副文本El = 空状态.querySelector('.空状态副文本');
    if (!副文本El) {
      副文本El = document.createElement('p');
      副文本El.className = '空状态副文本';
      空状态.insertBefore(副文本El, 空状态.querySelector('#空状态新建按钮'));
    }
    let 空状态按钮 = 空状态.querySelector('#空状态新建按钮');
    
    if (当前筛选 === 'deleted') {
      空状态图标.innerHTML = '🗑️';
      空状态文本.textContent = '回收站是空的';
      副文本El.textContent = '删除的备忘录会出现在这里';
      if (空状态按钮) 空状态按钮.style.display = 'none';
    } else if (当前筛选 === 'favorite') {
      空状态图标.innerHTML = '⭐';
      空状态文本.textContent = '还没有收藏的备忘录';
      副文本El.textContent = '收藏你喜欢的备忘录，方便快速找到';
      if (空状态按钮) 空状态按钮.style.display = 'none';
    } else if (AI临时筛选) {
      空状态图标.innerHTML = '🔍';
      空状态文本.textContent = '没有找到匹配的备忘录';
      副文本El.textContent = '试试调整筛选条件';
      if (空状态按钮) 空状态按钮.style.display = 'none';
    } else if (当前搜索关键词) {
      空状态图标.innerHTML = '🔍';
      空状态文本.textContent = '没有找到「' + 当前搜索关键词 + '」相关的内容';
      副文本El.textContent = '试试换个关键词';
      if (空状态按钮) 空状态按钮.style.display = 'none';
    } else if (当前标签筛选) {
      空状态图标.innerHTML = '🏷️';
      空状态文本.textContent = '没有「' + 当前标签筛选 + '」标签的备忘录';
      副文本El.textContent = '给备忘录添加标签，方便分类管理';
      if (空状态按钮) 空状态按钮.style.display = 'none';
    } else if (当前日期筛选) {
      空状态图标.innerHTML = '📅';
      空状态文本.textContent = '这个月还没有备忘录';
      副文本El.textContent = '点击右下角 + 创建一条';
      if (空状态按钮) 空状态按钮.style.display = 'none';
    } else {
      空状态图标.innerHTML = '📝';
      空状态文本.textContent = '还没有备忘录';
      副文本El.textContent = '点击下方按钮创建第一条备忘录';
      if (空状态按钮) 空状态按钮.style.display = '';
    }
    
    // 回收站、筛选等模式隐藏 FAB
    if (悬浮按钮) {
      const 应隐藏 = 当前筛选 === 'deleted' || 回收站模式;
      悬浮按钮.style.display = 应隐藏 ? 'none' : '';
    }
    空状态.style.display = 'flex';
  }

  // ========== FAB 滚动显隐 ==========
  if (!列表容器._fab滚动已绑定) {
    列表容器._fab滚动已绑定 = true;
    let fab定时器 = null;
    const 悬浮按钮 = document.getElementById('悬浮新建按钮');
    if (悬浮按钮) {
      列表容器.addEventListener('scroll', () => {
        悬浮按钮.style.opacity = '0.4';
        悬浮按钮.style.transform = 'scale(0.8)';
        clearTimeout(fab定时器);
        fab定时器 = setTimeout(() => {
          悬浮按钮.style.opacity = '';
          悬浮按钮.style.transform = '';
        }, 500);
      });
    }
  }
}

// 打开编辑页面
function 打开编辑页面(id) {
  // 优先从 MemoManager 读取（IndexedDB 持久化）
  let 备忘录 = null;
  if (window.备忘录管理器) {
    备忘录 = window.备忘录管理器.getMemo(id);
  }
  // 降级：旧内存数据
  if (!备忘录) {
    const 数据源 = window._备忘录数据 || [];
    备忘录 = 数据源.find(m => m.id === id);
  }
  if (!备忘录) {
    console.error('[打开编辑页面] 找不到备忘录:', id);
    return;
  }
  // 备忘录打开计数
  const 备忘录计数 = parseInt(localStorage.getItem('_备忘录打开计数') || '0');
  localStorage.setItem('_备忘录打开计数', 备忘录计数 + 1);
  
  document.getElementById('编辑标题').value = 备忘录.标题;
  document.getElementById('编辑内容').innerHTML = 备忘录.内容 || '';

  // 加载后刷新待办截止时间显示
  setTimeout(() => {
    const 编辑区 = document.getElementById('编辑内容');
    if (编辑区) {
      编辑区.querySelectorAll('.todo-item').forEach(todo => {
        if (todo.dataset.deadline) {
          if (typeof 更新待办截止显示 === 'function') {
            更新待办截止显示(todo);
          }
        }
      });
    }
  }, 0);
  const 当前文件夹名称Span = document.getElementById('当前文件夹名称');
  if (当前文件夹名称Span) 当前文件夹名称Span.textContent = 备忘录.文件夹 || '默认';

  // 设置时间戳
  const 时间戳元素 = document.getElementById('编辑时间戳');
  if (时间戳元素) {
    const 时间字符串 = 备忘录.日期 || 备忘录.更新时间 || new Date().toISOString().slice(0, 10);
    时间戳元素.textContent = 时间字符串;
  }

  window.当前编辑备忘录ID = id;
  // 更新标签角标（直接内联，不依赖 window.更新已选标签数 是否已挂载）
  const 角标 = document.getElementById('已选标签数');
  if (角标) {
    const 标签数 = (备忘录.标签 || []).length;
    if (标签数 > 0) {
      角标.textContent = 标签数;
      角标.style.display = 'inline-flex';
    } else {
      角标.style.display = 'none';
    }
  }
  if (window.切换标签) window.切换标签('编辑页面');
}

// 暴露给全局
window.渲染文件夹树 = 渲染文件夹树;
window.渲染筛选按钮 = 渲染筛选按钮;
window.渲染备忘录列表 = 渲染备忘录列表;
window.打开编辑页面 = 打开编辑页面;
window.更新备忘录标题 = 更新备忘录标题;