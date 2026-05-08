// 智能体权限向导.js - 创建/删除智能体时的权限和文件夹管理弹窗
// 依赖：智能体管理.js, 备忘录数据.js（含文件夹操作）, 智能体编辑面板.js（含打开权限选择器）

// 本地 escHtml（不依赖外部模块，避免 ReferenceError）
function 权限escHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ================================================================
// 1. 创建智能体后弹出权限设置卡片
// ================================================================

/**
 * 打开创建智能体后的权限设置浮层
 * @param {string} 智能体ID - 刚创建的智能体ID
 * @param {string} 名称 - 智能体名称
 * @param {string} 图标 - 智能体图标
 */
async function 打开创建后权限设置(智能体ID, 名称, 图标) {
  // 收集已有文件夹
  const 所有文件夹 = window._获取文件夹树 ? window._获取文件夹树() : [];
  const 展开文件夹列表 = [];
  function 展开(节点列表, 前缀 = '') {
    for (const 节点 of (节点列表 || [])) {
      const 全名 = 前缀 ? `${前缀} / ${节点.名称}` : 节点.名称;
      展开文件夹列表.push({ 名称: 节点.名称, 全名 });
      if (节点.子文件夹?.length) 展开(节点.子文件夹, 全名);
    }
  }
  展开(所有文件夹);

  // 移除旧浮层
  const 旧浮层 = document.querySelector('.智能体权限向导-遮罩');
  if (旧浮层) 旧浮层.remove();

  const 遮罩 = document.createElement('div');
  遮罩.className = '智能体权限向导-遮罩';
  遮罩.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:20000;display:flex;align-items:center;justify-content:center;';

  let 选择模式 = 'none'; // 'create' | 'select' | 'none'

  遮罩.innerHTML = `
    <div class="智能体权限向导-卡片" style="background:var(--内容底色,#fff);border-radius:14px;width:88%;max-width:480px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.3);overflow:hidden;">
      <!-- 头部 -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--暖灰色,#eee);">
        <span style="font-size:1rem;font-weight:600;">${图标} ${权限escHtml(名称)} — 备忘录权限</span>
        <button class="智能体权限向导-关闭" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--文字辅色,#999);padding:4px 8px;">✕</button>
      </div>
      <!-- 说明 -->
      <div style="padding:14px 20px;font-size:0.85rem;color:var(--文字辅色,#666);line-height:1.5;border-bottom:1px solid var(--暖灰色,#eee);">
        新智能体默认无权查看备忘录。你可以现在设置它的访问权限：
      </div>
      <!-- 选项列表 -->
      <div style="flex:1;overflow-y:auto;padding:12px 20px;display:flex;flex-direction:column;gap:8px;">
        <label class="智能体权限向导-选项" data-value="none" style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:10px;border:2px solid #e0e0e0;cursor:pointer;transition:all 0.15s;">
          <input type="radio" name="权限向导-模式" value="none" checked style="margin-top:2px;accent-color:#8b5cf6;">
          <div>
            <div style="font-weight:600;font-size:0.9rem;">🔒 暂不开放</div>
            <div style="font-size:0.78rem;color:var(--文字辅色,#666);margin-top:2px;">保留默认权限，只允许创建备忘录</div>
          </div>
        </label>
        <label class="智能体权限向导-选项" data-value="select" style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:10px;border:2px solid #e0e0e0;cursor:pointer;transition:all 0.15s;">
          <input type="radio" name="权限向导-模式" value="select" style="margin-top:2px;accent-color:#8b5cf6;">
          <div>
            <div style="font-weight:600;font-size:0.9rem;">📂 选择已有文件夹</div>
            <div style="font-size:0.78rem;color:var(--文字辅色,#666);margin-top:2px;">从现有文件夹中选择该智能体能访问哪些</div>
            <div id="智能体权限向导-文件夹选择区" style="display:none;margin-top:8px;max-height:200px;overflow-y:auto;background:var(--内容底色2,#f5f5f5);border-radius:8px;padding:8px;"></div>
          </div>
        </label>
        <label class="智能体权限向导-选项" data-value="create" style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:10px;border:2px solid #e0e0e0;cursor:pointer;transition:all 0.15s;">
          <input type="radio" name="权限向导-模式" value="create" style="margin-top:2px;accent-color:#8b5cf6;">
          <div>
            <div style="font-weight:600;font-size:0.9rem;">📁 创建专属文件夹</div>
            <div style="font-size:0.78rem;color:var(--文字辅色,#666);margin-top:2px;">创建一个以智能体名称命名的文件夹，并开放访问</div>
          </div>
        </label>
      </div>
      <!-- 底部按钮 -->
      <div style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--暖灰色,#eee);">
        <button class="智能体权限向导-跳过" style="background:#f0f0f0;border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-size:0.85rem;color:#666;font-weight:500;">跳过</button>
        <button class="智能体权限向导-确认" style="background:#8b5cf6;border:none;padding:9px 24px;border-radius:8px;cursor:pointer;font-size:0.85rem;color:#fff;font-weight:600;">确认</button>
      </div>
    </div>
  `;

  document.body.appendChild(遮罩);
  if (window._锁定滚动) window._锁定滚动();

  // ===== 选项切换逻辑 =====
  const 选项列表 = 遮罩.querySelectorAll('.智能体权限向导-选项');
  const 文件夹选择区 = 遮罩.querySelector('#智能体权限向导-文件夹选择区');

  function 渲染文件夹选择() {
    if (展开文件夹列表.length === 0) {
      文件夹选择区.innerHTML = '<div style="padding:12px 8px;text-align:center;color:#999;font-size:0.8rem;">暂无文件夹，可直接选择「创建专属文件夹」</div>';
      return;
    }
    文件夹选择区.innerHTML = 展开文件夹列表.map(f => `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;hover:background:#e0e0e0;">
        <input type="checkbox" value="${权限escHtml(f.名称)}" style="accent-color:#8b5cf6;">
        <span style="font-size:0.82rem;">📂 ${权限escHtml(f.全名)}</span>
      </label>
    `).join('');
  }

  选项列表.forEach(opt => {
    const 无线电 = opt.querySelector('input');
    无线电.addEventListener('change', () => {
      选项列表.forEach(o => o.style.borderColor = '#e0e0e0');
      opt.style.borderColor = '#8b5cf6';
      选择模式 = 无线电.value;
      if (选择模式 === 'select') {
        文件夹选择区.style.display = 'block';
        渲染文件夹选择();
      } else {
        文件夹选择区.style.display = 'none';
      }
    });
  });

  // 默认选中第一个
  选项列表[0].style.borderColor = '#8b5cf6';

  // ===== 按钮事件 =====
  function 关闭() {
    document.body.removeChild(遮罩);
    if (window._解锁滚动) window._解锁滚动();
  }

  遮罩.querySelector('.智能体权限向导-关闭').onclick = 关闭;
  遮罩.querySelector('.智能体权限向导-跳过').onclick = 关闭;
  遮罩.querySelector('.智能体权限向导-确认').onclick = async () => {
    const 存储 = window.获取存储();
    const 路径 = `agents/${智能体ID}/agent.json`;
    let 配置 = {};
    try {
      if (await 存储.文件存在(路径)) {
        配置 = JSON.parse(await 存储.读文件(路径));
      }
    } catch (e) { /* ignore */ }

    if (选择模式 === 'none') {
      关闭();
      return;
    }

    if (选择模式 === 'create') {
      // 创建专属文件夹
      const 文件夹名 = 名称.replace(/[<>:"/\\|?*]/g, '').trim() || `${图标} ${名称}`;
      let 创建成功 = false;
      if (window._创建文件夹) {
        创建成功 = window._创建文件夹(文件夹名, null);
      }
      if (创建成功) {
        配置.memo_access = { mode: 'folder_list', folders: [文件夹名] };
        if (window.渲染文件夹树) window.渲染文件夹树();
      } else {
        // 文件夹可能已存在 → 直接赋权
        配置.memo_access = { mode: 'folder_list', folders: [文件夹名] };
      }
    } else if (选择模式 === 'select') {
      const 选中项 = 文件夹选择区.querySelectorAll('input[type="checkbox"]:checked');
      const 选中文件夹 = Array.from(选中项).map(cb => cb.value);
      if (选中文件夹.length === 0) {
        window._显示提示('请至少选择一个文件夹','info');
        return;
      }
      配置.memo_access = { mode: 'folder_list', folders: 选中文件夹 };
    }

    try {
      await 存储.写文件(路径, JSON.stringify(配置, null, 2));
      // 同步内存缓存
      if (智能体ID === (window.当前智能体ID?.() || 'default')) {
        const dataFn = window.获取当前智能体配置;
        if (dataFn) {
          const cur = dataFn();
          if (cur) cur.memo_access = 配置.memo_access;
        }
      }
    } catch (e) {
      console.error('保存权限设置失败', e);
    }
    关闭();
  };

  遮罩.addEventListener('click', (e) => {
    if (e.target === 遮罩) 关闭();
  });
}

// ================================================================
// 2. 删除智能体时弹出文件夹处理卡片
// ================================================================

/**
 * 打开删除智能体时的文件夹处理弹窗
 * @param {string} 智能体ID
 * @param {string} 名称
 * @param {string} 图标
 * @returns {Promise<{deleteFolders: boolean, confirmed: boolean}>}
 */
function 打开删除智能体向导(智能体ID, 名称, 图标) {
  return new Promise((resolve) => {
    // 获取智能体权限信息，看有哪些关联文件夹
    const 旧浮层 = document.querySelector('.智能体权限向导-遮罩');
    if (旧浮层) 旧浮层.remove();

    const 遮罩 = document.createElement('div');
    遮罩.className = '智能体权限向导-遮罩';
    遮罩.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:20000;display:flex;align-items:center;justify-content:center;';

    遮罩.innerHTML = `
      <div class="智能体权限向导-卡片" style="background:var(--内容底色,#fff);border-radius:14px;width:88%;max-width:460px;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.3);overflow:hidden;">
        <!-- 头部 -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--暖灰色,#eee);">
          <span style="font-size:1rem;font-weight:600;">⚠️ 删除智能体</span>
          <button class="智能体权限向导-关闭" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--文字辅色,#999);padding:4px 8px;">✕</button>
        </div>
        <!-- 说明 -->
        <div style="padding:14px 20px;font-size:0.85rem;color:var(--文字辅色,#666);line-height:1.5;">
          即将删除智能体 <strong>${图标} ${权限escHtml(名称)}</strong>，关联数据将不可恢复。
        </div>
        <!-- 文件夹处理选项 -->
        <div style="padding:0 20px 12px;display:flex;flex-direction:column;gap:8px;">
          <label class="智能体权限向导-选项" data-value="keep" style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:10px;border:2px solid #8b5cf6;cursor:pointer;transition:all 0.15s;">
            <input type="radio" name="向导-删除文件夹" value="keep" checked style="margin-top:2px;accent-color:#8b5cf6;">
            <div>
              <div style="font-weight:600;font-size:0.9rem;">📂 保留文件夹</div>
              <div style="font-size:0.78rem;color:var(--文字辅色,#666);margin-top:2px;">该智能体访问过的文件夹及里面的备忘录不受影响</div>
            </div>
          </label>
          <label class="智能体权限向导-选项" data-value="delete" style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:10px;border:2px solid #e0e0e0;cursor:pointer;transition:all 0.15s;">
            <input type="radio" name="向导-删除文件夹" value="delete" style="margin-top:2px;accent-color:#8b5cf6;">
            <div>
              <div style="font-weight:600;font-size:0.9rem;">🗑️ 删除关联文件夹</div>
              <div style="font-size:0.78rem;color:var(--文字辅色,#666);margin-top:2px;">删除该智能体有权限访问的文件夹及其所有备忘</div>
            </div>
          </label>
        </div>
        <!-- 底部 -->
        <div style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--暖灰色,#eee);">
          <button class="智能体权限向导-取消删除" style="background:#f0f0f0;border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-size:0.85rem;color:#666;font-weight:500;">取消</button>
          <button class="智能体权限向导-确认删除" style="background:#e74c3c;border:none;padding:9px 24px;border-radius:8px;cursor:pointer;font-size:0.85rem;color:#fff;font-weight:600;">确认删除</button>
        </div>
      </div>
    `;

    document.body.appendChild(遮罩);
    if (window._锁定滚动) window._锁定滚动();

    const 选项列表 = 遮罩.querySelectorAll('.智能体权限向导-选项');
    let 删除文件夹 = false;

    选项列表.forEach(opt => {
      const 无线电 = opt.querySelector('input');
      无线电.addEventListener('change', () => {
        选项列表.forEach(o => o.style.borderColor = '#e0e0e0');
        opt.style.borderColor = '#8b5cf6';
        删除文件夹 = 无线电.value === 'delete';
      });
    });

    function 关闭() {
      document.body.removeChild(遮罩);
      if (window._解锁滚动) window._解锁滚动();
    }

    遮罩.querySelector('.智能体权限向导-关闭').onclick = 关闭;
    遮罩.querySelector('.智能体权限向导-取消删除').onclick = () => {
      关闭();
      resolve({ deleteFolders: false, confirmed: false });
    };
    遮罩.querySelector('.智能体权限向导-确认删除').onclick = () => {
      关闭();
      resolve({ deleteFolders: 删除文件夹, confirmed: true });
    };

    遮罩.addEventListener('click', (e) => {
      if (e.target === 遮罩) {
        关闭();
        resolve({ deleteFolders: false, confirmed: false });
      }
    });
  });
}

// ================================================================
// 3. 钩子注入：修改智能体管理.js 中的创建/删除流程
// ================================================================

// 保存原始函数引用
const __原始绑定添加智能体浮层 = window.绑定添加智能体浮层;

/**
 * 重写绑定添加智能体浮层，创建成功后弹出权限设置
 */
window.绑定添加智能体浮层 = function() {
  // 保留原有绑定：关闭按钮、取消按钮、遮罩点击、图标选择等
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
        const 新智能体 = await window._原始创建新智能体(名称, 图标);
        浮层.style.display = 'none';
        if (window.刷新智能体UI) await window.刷新智能体UI();
        // 弹出权限设置向导
        await 打开创建后权限设置(新智能体.id, 名称, 图标);
        if (window.切换智能体) await window.切换智能体(新智能体.id);
      } catch (e) {
        console.error('创建智能体失败', e);
        window._显示提示('创建失败：' + e.message,'error');
      }
    });
  }
};

// 保存原始删除 + 创建函数
const __原始删除智能体 = window.删除智能体;
const __原始创建新智能体 = window.创建新智能体;
if (typeof __原始创建新智能体 === 'undefined') {
  // 智能体管理.js 里是局部函数，不会暴露到 window
  // 需要从智能体管理.js 导出
}

// 包装删除智能体，插入文件夹处理向导
const __原始删除智能体Global = window._原始删除智能体;
if (__原始删除智能体Global) {
  window.删除智能体 = async function(智能体ID) {
    if (智能体ID === 'default') {
      window._显示提示('不能删除默认智能体','info');
      return false;
    }
    // 获取名称和图标
    const 配置 = window.获取当前智能体配置 ? window.获取当前智能体配置() : {};
    const 名称 = 配置.name || 智能体ID;
    const 图标 = 配置.icon || '🤖';

    // 弹出向导
    const { deleteFolders, confirmed } = await 打开删除智能体向导(智能体ID, 名称, 图标);
    if (!confirmed) return false;

    // 先处理文件夹
    if (deleteFolders) {
      try {
        // 获取智能体可访问的文件夹
        const 权限 = await window.获取智能体权限(智能体ID);
        if (权限?.mode === 'folder_list' && 权限.folders?.length > 0) {
          for (const 文件夹 of 权限.folders) {
            if (window._删除文件夹) {
              // 递归删除文件夹下的所有备忘录
              if (window.备忘录管理器) {
                const 所有备忘 = window.备忘录管理器.getAllMemos();
                const 待删 = 所有备忘.filter(m => m.文件夹 === 文件夹);
                for (const m of 待删) {
                  await window.备忘录管理器.deleteMemo(m.id);
                }
              }
              window._删除文件夹(文件夹);
            }
          }
        }
        // 如果权限是 all，提示用户
        if (权限?.mode === 'all') {
          console.warn('智能体权限为 all，无法自动删除全部文件夹');
        }
      } catch (e) {
        console.warn('删除关联文件夹失败', e);
      }
    }

    // 执行原删除逻辑
    return await __原始删除智能体Global(智能体ID);
  };
}
