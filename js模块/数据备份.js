// 数据备份.js - 完整备份系统
// 职责：每日自动备份 + 备份管理（查看/恢复/删除/导出分享）
// 备份内容：全量备忘录 + 智能体配置 + 记忆数据 + 设置

// ========== 常量 ==========
const 备份_存储根路径 = '自动备份';
const 备份_最大保留份数 = 7;
const 备份_文件名前缀 = '爱助手-完整备份';
const 备份_插件名 = '数据备份';

// ========== 并发锁 ==========
let 备份_索引锁 = false;

// ========== 工具函数 ==========

/**
 * 生成备份文件名（含时间戳）
 */
function 备份_文件名() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const 时间 = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${备份_文件名前缀}-${时间}.json`;
}

/**
 * 格式化时间戳为可读时间
 */
function 备份_格式化时间(时间戳) {
  const d = new Date(时间戳);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 读取备份索引
 */
async function 备份_读索引() {
  const 存储 = window.storage;
  try {
    const 索引路径 = 备份_存储根路径 + '/_index.json';
    if (await 存储.文件存在(索引路径)) {
      const 数据 = await 存储.读文件(索引路径);
      return JSON.parse(数据) || { 备份列表: [] };
    }
  } catch (e) {
    console.warn('[备份] 读取索引失败:', e);
  }
  return { 备份列表: [] };
}

/**
 * 写入备份索引
 */
async function 备份_写索引(索引) {
  if (备份_索引锁) {
    console.warn('[备份] 索引写入冲突，跳过（旧备份正在写入）');
    return;
  }
  备份_索引锁 = true;
  try {
    const 存储 = window.storage;
    const 索引路径 = 备份_存储根路径 + '/_index.json';
    await 存储.写文件(索引路径, JSON.stringify(索引, null, 2));
  } finally {
    备份_索引锁 = false;
  }
}

/**
 * 检查今天是否已经备份过
 */
function 备份_今日已备份() {
  const 今天 = new Date().toISOString().split('T')[0];
  return localStorage.getItem('备份_最后备份日期') === 今天;
}

/**
 * 标记今日已备份
 */
function 备份_标记今日已备份() {
  localStorage.setItem('备份_最后备份日期', new Date().toISOString().split('T')[0]);
}

/**
 * 获取今日备份日期（用于显示）
 */
function 备份_获取今日备份状态() {
  const 日期 = localStorage.getItem('备份_最后备份日期');
  if (!日期) return null;
  const 时间 = localStorage.getItem('备份_最后备份时间');
  return { 日期, 时间: 时间 || '' };
}

// ========== 核心备份函数 ==========

/**
 * 收集全量备份数据
 * @returns {Object} 备份包
 */
async function 备份_收集全量数据() {
  // 1. 备忘录全量（从管理器取）
  let 备忘录列表 = [];
  if (window.备忘录管理器 && window.备忘录管理器.getAllMemos) {
    备忘录列表 = window.备忘录管理器.getAllMemos();
  } else if (window._备忘录数据) {
    备忘录列表 = window._备忘录数据.filter(m => !m.已删除);
  }
  if (!Array.isArray(备忘录列表)) 备忘录列表 = [];

  // 2. 从 IndexedDB 存储读取智能体和对话历史
  let 智能体数据 = {};
  let 对话历史数据 = {};
  try {
    const 存储 = window.storage;
    if (存储 && 存储._获取所有记录) {
      const 所有记录 = await 存储._获取所有记录();
      for (const 记录 of 所有记录) {
        if (!记录 || !记录.路径) continue;
        if (记录.路径.startsWith('agents/')) {
          if (记录.路径.includes('/对话历史/')) {
            const 部分 = 记录.路径.replace('agents/', '').split('/');
            const 智能体ID = 部分[0];
            const 会话ID = (部分[2] || '').replace('.json', '');
            if (!对话历史数据[智能体ID]) 对话历史数据[智能体ID] = {};
            try {
              对话历史数据[智能体ID][会话ID] = JSON.parse(记录.内容);
            } catch (e) {
              console.warn('[备份] 解析对话历史失败:', e.message);
              对话历史数据[智能体ID][会话ID] = { 原始: 记录.内容 };
            }
          } else if (!记录.路径.includes('/memories/') && 
                     !记录.路径.includes('/short_term') &&
                     !记录.路径.includes('/mid_term') &&
                     !记录.路径.includes('/long_term')) {
            // 排除细分的记忆目录，只在智能体配置级别收集
            const 键 = 记录.路径.replace(/^agents\//, '');
            智能体数据[键] = 记录.内容;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[备份] 读取存储数据失败:', e);
  }

  // 3. 记忆数据（从 AI 记忆管理器）
  let 记忆数据 = [];
  try {
    if (window.AI记忆管理器) {
      // AI记忆管理器可能有内部数据
      const 所有记忆 = await window.AI记忆管理器.获取所有记忆();
      if (Array.isArray(所有记忆)) 记忆数据 = 所有记忆;
    }
  } catch (e) {
    console.warn('[备份] 读取记忆数据失败:', e);
  }

  // 4. 设置
  const 设置 = {};
  try {
    const 设置键 = ['当前智能体ID', '备份_最后备份日期', '备份_最后备份时间',
                  '当前主题', '启用流式输出'];  // 排除 API 密钥，避免备份泄露
    for (const 键 of 设置键) {
      const 值 = localStorage.getItem(键);
      if (值 !== null) 设置[键] = 值;
    }
  } catch (e) {
    console.warn('[备份] 读取设置失败:', e);
  }

  return {
    版本: '2.0',
    格式: 'ai-assistant-backup',
    备份时间: new Date().toISOString(),
    应用版本: 'V6.3',
    统计: {
      备忘录: 备忘录列表.length,
      智能体: Object.keys(智能体数据).length,
      记忆: 记忆数据.length
    },
    数据: {
      备忘录: 备忘录列表,
      智能体: 智能体数据,
      对话历史: 对话历史数据,
      记忆: 记忆数据,
      设置: 设置
    }
  };
}

/**
 * 执行一次完整备份
 * @param {boolean} 仅内部存储 - true=只存IndexedDB/不对用户弹窗
 * @returns {Object} { 成功, 文件名, 文件大小, 错误? }
 */
window.执行完整备份 = async function(仅内部存储 = false) {
  console.log('[备份] 开始执行完整备份...');
  try {
    const 存储 = window.storage;
    if (!存储) throw new Error('存储未初始化');

    // 确保备份目录存在
    await 存储.创建目录(备份_存储根路径);

    // 收集全量数据
    const 备份包 = await 备份_收集全量数据();

    // 生成文件名
    const 文件名 = 备份_文件名();
    const 内容 = JSON.stringify(备份包, null, 2);
    const 文件大小 = new Blob([内容]).size;

    // 写入 IndexedDB 备份目录
    const 路径 = `${备份_存储根路径}/${文件名}`;
    await 存储.写文件(路径, 内容);

    // 更新索引
    const 索引 = await 备份_读索引();
    索引.备份列表.unshift({
      文件名: 文件名,
      备份时间: 备份包.备份时间,
      大小: 文件大小,
      备忘录数: 备份包.统计.备忘录
    });

    // 裁剪旧备份（保留最近 N 份）
    const 待删文件 = [];
    while (索引.备份列表.length > 备份_最大保留份数) {
      const 旧 = 索引.备份列表.pop();
      待删文件.push(`${备份_存储根路径}/${旧.文件名}`);
    }
    for (const 旧路径 of 待删文件) {
      try {
        if (await 存储.文件存在(旧路径)) {
          await 存储.删除文件(旧路径);
          console.log('[备份] 删除旧备份:', 旧路径);
        }
      } catch (e) {
        console.warn('[备份] 删除旧备份失败:', 旧路径, e);
      }
    }
    await 备份_写索引(索引);

    // 标记今日已备份
    备份_标记今日已备份();
    localStorage.setItem('备份_最后备份时间', 备份_格式化时间(new Date().getTime()));

    console.log(`[备份] 备份完成: ${文件名} (${(文件大小 / 1024).toFixed(1)}KB)`);

    // 刷新备份列表 UI
    备份_刷新显示状态();

    // 如果不是纯内部存储，也尝试触发下载（给用户一份实体文件）
    if (!仅内部存储) {
      // 鸿蒙原生保存
      if (window.nativeBridge && window.nativeBridge.saveTextFile) {
        window.nativeBridge.saveTextFile(文件名, 内容).then(res => {
          try {
            const 结果 = JSON.parse(res);
            if (!结果.success) console.warn('[备份] 导出保存未完成:', 结果.error);
          } catch {}
        }).catch(e => console.warn('[备份] 导出原生保存异常:', e));
      } else if (window.nativeBridge && window.nativeBridge.saveFile) {
        const base64 = btoa(unescape(encodeURIComponent(内容)));
        window.nativeBridge.saveFile(文件名, base64).then(res => {
          try {
            const 结果 = JSON.parse(res);
            if (!结果.success) console.warn('[备份] 导出保存未完成:', 结果.error);
          } catch {}
        }).catch(e => console.warn('[备份] 导出原生保存异常:', e));
      } else {
        const blob = new Blob([内容], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 文件名;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    }

    return { 成功: true, 文件名, 文件大小 };
  } catch (e) {
    console.error('[备份] 备份失败:', e);
    return { 成功: false, 错误: e.message };
  }
};

// ========== 备份管理（查看/恢复/删除） ==========

/**
 * 获取备份列表
 * @returns {Array} 备份列表 [{文件名, 备份时间, 大小, 备忘录数}]
 */
window.备份_获取列表 = async function() {
  const 索引 = await 备份_读索引();
  return 索引.备份列表 || [];
};

/**
 * 从备份恢复
 * @param {string} 文件名 - 要恢复的备份文件名
 * @returns {Object} { 成功, 恢复数, 跳过数, 错误? }
 */
window.备份_执行恢复 = async function(文件名) {
  try {
    const 存储 = window.storage;
    if (!存储) throw new Error('存储未初始化');

    const 路径 = `${备份_存储根路径}/${文件名}`;
    const 内容 = await 存储.读文件(路径);
    if (!内容) throw new Error('备份文件不存在或为空');

    const 备份包 = JSON.parse(内容);
    if (!备份包 || 备份包.格式 !== 'ai-assistant-backup') {
      throw new Error('无效的备份文件格式');
    }

    const 备忘录 = 备份包.数据.备忘录 || 备份包.数据?.memos || [];
    const manager = window.备忘录管理器;
    let 恢复数 = 0;
    let 跳过数 = 0;

    if (manager && manager.createMemo && Array.isArray(备忘录)) {
      for (const m of 备忘录) {
        try {
          // 检查是否已存在（按 ID）
          const 已有 = manager.memos.some(ex => ex.id === m.id);
          if (已有) {
            跳过数++;
            continue;
          }
          await manager.createMemo({
            id: m.id,
            标题: m.标题 || '(恢复)',
            内容: m.内容 || '',
            文件夹: m.文件夹 || '未分类',
            标签: m.标签 || [],
            收藏: m.收藏 || false,
            已置顶: m.已置顶 || false,
            创建时间: m.创建时间 || new Date().toISOString(),
            更新时间: m.更新时间 || m.修改时间 || new Date().toISOString()
          });
          恢复数++;
        } catch (e) {
          console.warn('[备份恢复] 跳过一条:', e.message);
          跳过数++;
        }
      }
    }

    console.log(`[备份恢复] 完成: 恢复 ${恢复数} 条, 跳过 ${跳过数} 条`);
    return { 成功: true, 恢复数, 跳过数 };
  } catch (e) {
    console.error('[备份恢复] 失败:', e);
    return { 成功: false, 错误: e.message };
  }
};

/**
 * 删除指定备份
 */
window.备份_删除备份 = async function(文件名) {
  try {
    const 存储 = window.storage;
    if (!存储) throw new Error('存储未初始化');

    const 路径 = `${备份_存储根路径}/${文件名}`;
    if (await 存储.文件存在(路径)) {
      await 存储.删除文件(路径);
    }

    // 更新索引
    const 索引 = await 备份_读索引();
    索引.备份列表 = 索引.备份列表.filter(b => b.文件名 !== 文件名);
    await 备份_写索引(索引);

    备份_刷新显示状态();
    return { 成功: true };
  } catch (e) {
    console.error('[备份] 删除失败:', e);
    return { 成功: false, 错误: e.message };
  }
};

/**
 * 导出某份备份到文件（下载或分享）
 */
window.备份_导出到文件 = async function(文件名) {
  try {
    const 存储 = window.storage;
    if (!存储) throw new Error('存储未初始化');
    const 路径 = `${备份_存储根路径}/${文件名}`;
    const 内容 = await 存储.读文件(路径);
    if (!内容) throw new Error('备份不存在');

    const blob = new Blob([内容], { type: 'application/json;charset=utf-8' });

    // 鸿蒙原生保存（优先于 navigator.share，因为鸿蒙 share 不可靠）
    if (window.nativeBridge && window.nativeBridge.saveTextFile) {
      const res = await window.nativeBridge.saveTextFile(文件名, 内容);
      try {
        const 结果 = JSON.parse(res);
        if (结果.success) return { 成功: true };
        console.warn('[备份] 保存未完成:', 结果.error);
      } catch {}
    } else if (window.nativeBridge && window.nativeBridge.saveFile) {
      const base64 = btoa(unescape(encodeURIComponent(内容)));
      const res = await window.nativeBridge.saveFile(文件名, base64);
      try {
        const 结果 = JSON.parse(res);
        if (结果.success) return { 成功: true };
        console.warn('[备份] 保存未完成:', 结果.error);
      } catch {}
    }

    // 尝试分享（移动端）
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], 文件名, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '爱助手备份', text: `导出备份 ${文件名}` });
        return { 成功: true };
      }
    }

    // 降级下载
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 文件名;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return { 成功: true };
  } catch (e) {
    console.error('[备份] 导出到文件失败:', e);
    return { 成功: false, 错误: e.message };
  }
};

// ========== 自动备份 ==========

/**
 * 注册自动备份（页面加载时调用）
 * 每天最多备份一次，打开页面时自动检查
 */
window.注册自动备份 = function() {
  if (!备份_今日已备份()) {
    // 延迟执行，避免阻塞页面初始化
    setTimeout(async () => {
      console.log('[备份] 执行每日自动备份...');
      const 结果 = await window.执行完整备份(true);
      if (结果.成功) {
        console.log('[备份] 每日自动备份完成');
      } else {
        console.warn('[备份] 每日自动备份失败:', 结果.错误);
      }
    }, 15000); // 15秒后执行，等所有模块初始化完毕
  } else {
    console.log('[备份] 今日已备份，跳过自动备份');
  }
};

// ========== UI 辅助 ==========

/**
 * 刷新设置浮层中的备份状态显示
 * 由备份按钮绑定或备份操作完成后调用
 */
let 备份_状态已挂载 = false;

async function 备份_刷新显示状态() {
  const 状态容器 = document.getElementById('备份状态容器');
  if (!状态容器) return;

  const 今日 = 备份_获取今日备份状态();
  const 列表 = await 备份_获取列表();

  let html = '';
  if (今日) {
    html += `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">`;
    html += `<span style="color:#4CAF50;font-size:1rem;">✅</span>`;
    html += `<span style="font-size:0.85rem;">上次自动备份：${今日.日期} ${今日.时间 || ''}</span>`;
    html += `</div>`;
  } else {
    html += `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">`;
    html += `<span style="color:#FF9800;font-size:1rem;">⚠️</span>`;
    html += `<span style="font-size:0.85rem;">今天尚未自动备份</span>`;
    html += `</div>`;
  }

  if (列表.length > 0) {
    html += `<details style="margin-bottom:0.5rem;">`;
    html += `<summary style="font-size:0.8rem;cursor:pointer;color:var(--文字副色,#666);">`;
    html += `备份列表（${列表.length} 份）</summary>`;
    html += `<div style="margin-top:0.5rem;display:flex;flex-direction:column;gap:0.3rem;">`;
    for (const b of 列表) {
      const 大小 = b.大小 ? (b.大小 > 1024 * 1024 ? (b.大小 / 1024 / 1024).toFixed(1) + 'MB' : (b.大小 / 1024).toFixed(1) + 'KB') : '未知';
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.3rem 0.5rem;background:var(--背景色-浅,#f5f5f5);border-radius:0.4rem;font-size:0.8rem;">`;
      html += `<span>${备份_格式化时间(new Date(b.备份时间).getTime())}</span>`;
      html += `<span style="color:var(--文字副色,#888);">${大小}</span>`;
      html += `<span style="display:flex;gap:0.3rem;">`;
      html += `<button class="备份操作按钮" data-操作="恢复" data-文件名="${b.文件名}" style="padding:0.15rem 0.4rem;font-size:0.75rem;border:1px solid #4CAF50;border-radius:0.3rem;background:transparent;color:#4CAF50;cursor:pointer;">恢复</button>`;
      html += `<button class="备份操作按钮" data-操作="导出" data-文件名="${b.文件名}" style="padding:0.15rem 0.4rem;font-size:0.75rem;border:1px solid #2196F3;border-radius:0.3rem;background:transparent;color:#2196F3;cursor:pointer;">导出</button>`;
      html += `<button class="备份操作按钮" data-操作="删除" data-文件名="${b.文件名}" style="padding:0.15rem 0.4rem;font-size:0.75rem;border:1px solid #f44336;border-radius:0.3rem;background:transparent;color:#f44336;cursor:pointer;">删除</button>`;
      html += `</span>`;
      html += `</div>`;
    }
    html += `</div></details>`;
  } else {
    html += `<div style="font-size:0.8rem;color:var(--文字副色,#888);margin-bottom:0.5rem;">暂无备份，点击下方「立即备份」创建第一份备份</div>`;
  }

  状态容器.innerHTML = html;
}

/**
 * 绑定备份按钮事件（由设置浮层加载时调用）
 */
window.绑定备份按钮 = function() {
  if (备份_状态已挂载) return;
  备份_状态已挂载 = true;

  // 代理点击事件处理函数
  const 处理点击 = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const 操作 = btn.dataset.操作;
    const 文件名 = btn.dataset.文件名;

    if (操作 === '立即备份') {
      btn.disabled = true;
      btn.textContent = '备份中…';
      const 结果 = await window.执行完整备份(false);
      btn.disabled = false;
      btn.textContent = '立即备份';
      if (结果.成功) {
        alert('\u2705 备份完成\n文件名：' + 结果.文件名 + '\n大小：' + (结果.文件大小 / 1024).toFixed(1) + 'KB');
      } else {
        alert('\u274c 备份失败：' + 结果.错误);
      }
    } else if (操作 === '恢复' && 文件名) {
      if (!await window._自定义确认('确定从该备份恢复？\n' + 文件名 + '\n\n注意：恢复操作会添加新备忘录，不会覆盖现有数据。')) return;
      btn.disabled = true;
      btn.textContent = '恢复中…';
      const 结果 = await window.备份_执行恢复(文件名);
      btn.disabled = false;
      btn.textContent = '恢复';
      if (结果.成功) {
        alert('\u2705 恢复完成\n新增：' + 结果.恢复数 + ' 条\n跳过（已存在）：' + 结果.跳过数 + ' 条');
        if (window.切换标签) window.切换标签('备忘录面板');
        if (window.渲染备忘录列表) window.渲染备忘录列表();
      } else {
        alert('\u274c 恢复失败：' + 结果.错误);
      }
    } else if (操作 === '导出' && 文件名) {
      btn.disabled = true;
      btn.textContent = '导出中…';
      await window.备份_导出到文件(文件名);
      btn.disabled = false;
      btn.textContent = '导出';
    } else if (操作 === '删除' && 文件名) {
      if (!await window._自定义确认('确定永久删除备份文件？\n' + 文件名)) return;
      const 结果 = await window.备份_删除备份(文件名);
      if (结果.成功) {
        alert('\u2705 备份已删除');
      } else {
        alert('\u274c 删除失败：' + 结果.错误);
      }
    }
  };

  // 同时监听两个容器：静态按钮容器 + 动态渲染的状态容器
  const 容器列表 = ['备份按钮容器', '备份状态容器'];
  for (const id of 容器列表) {
    const 容器 = document.getElementById(id);
    if (容器) 容器.addEventListener('click', 处理点击);
  }
};

// ========== 导出接口（供外部使用） ==========
window.备份_刷新显示状态 = 备份_刷新显示状态;

console.log('[备份] 数据备份模块加载完成');
