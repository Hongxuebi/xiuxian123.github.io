// 导出功能.js - 备忘录导出核心逻辑
// 职责：收集数据 → 格式转换 → 触发下载
// 四个入口共用此文件，不写任何 UI 逻辑

// ========== 附件解析 ==========

/**
 * 从 HTML 内容中解析附件（从 data-attachment-id / data-file-name / data-file-data 属性）
 * @param {string} 内容 - 备忘录的 HTML 内容
 * @returns {Array} - 附件列表 [{elementId, name, mimeType, base64数据}]
 */
function _解析附件(内容) {
  if (!内容) return [];
  
  const 附件列表 = [];
  const 临时容器 = document.createElement('div');
  临时容器.innerHTML = 内容;
  const 已有ID = new Set();
  
  // 从 data URL 中提取 MIME 类型和纯 base64
  const 解析Base64 = (data) => {
    const mimeMatch = data.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const base64数据 = data.replace(/^data:[^;]+;base64,/, '');
    return { mimeType, base64数据 };
  };
  
  // 查找所有带 data-attachment-id 的元素（附件）
  const 元素列表 = 临时容器.querySelectorAll('[data-attachment-id]');
  元素列表.forEach(el => {
    const elementId = el.dataset.attachmentId;
    if (已有ID.has(elementId)) return;
    const name = el.dataset.fileName || '未知文件';
    const data = el.dataset.fileData;
    if (!data) return;
    已有ID.add(elementId);
    const { mimeType, base64数据 } = 解析Base64(data);
    附件列表.push({ elementId, name, mimeType, base64数据 });
  });
  
  // 查找所有带 base64 src 的 img 标签（直接插入的图片）
  const 图片列表 = 临时容器.querySelectorAll('img[src]');
  图片列表.forEach(img => {
    const src = img.src || '';
    if (!src.startsWith('data:')) return;
    if (已有ID.has(src)) return;
    已有ID.add(src);
    const mimeMatch = src.match(/^data:(image\/[^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const ext = mimeType.split('/')[1] || 'png';
    const 图片ID = img.dataset.imgId || ('图片_' + src.substring(11, 27));
    const 文件名 = 图片ID.replace(/[^\w\u4e00-\u9fa5]/g, '_') + '.' + ext;
    const { base64数据 } = 解析Base64(src);
    附件列表.push({ elementId: src, name: 文件名, mimeType, base64数据 });
  });
  
  return 附件列表;
}

// ========== 辅助工具 ==========

/**
 * 过滤文件名非法字符（用于生成文件名，不影响 JSON 内容）
 */
function _过滤文件名(名称) {
  return (名称 || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名';
}

/**
 * 生成时间戳字符串（用于文件名）
 */
function _文件时间戳() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * 构造 JSON 导出包
 */
function _构建导出包(memos, { 标签 = '全部' } = {}) {
  return {
    version: '1.0',
    format: 'ai-assistant-memo',
    exportedAt: new Date().toISOString(),
    count: memos.length,
    source: 标签,
    memos: memos.map(m => ({
      id: String(m.id),
      标题: m.标题 || '',
      内容: m.内容 || '',
      纯文本内容: m.纯文本内容 || (m.内容 ? m.内容.replace(/<[^>]+>/g, '') : ''),
      文件夹: m.文件夹 || '未分类',
      标签: Array.isArray(m.标签) ? m.标签 : [],
      收藏: !!m.收藏,
      已置顶: !!m.已置顶,
      创建时间: m.创建时间 || '',
      修改时间: m.更新时间 || m.修改时间 || '',
      删除时间: m.删除时间 || null,
      附件: (m.附件列表 || []).map(a => ({
        name: a.name || 'unknown',
        mimeType: a.mimeType || 'application/octet-stream',
        // base64 数据，如果存在
        data: a.blob || a.data || null
      })),
      // 额外解析 HTML 中的附件（从 data-attachment-id 等属性）
      解析附件: _解析附件(m.内容 || '').map(a => ({
        elementId: a.elementId,
        name: a.name,
        mimeType: a.mimeType
        // base64 数据量大，JSON 中不重复保存
      }))
    }))
  };
}

/**
 * 触发文件下载
 */
let _触发下载_保存锁 = false;

/** 过滤文件名中不安全字符 */
function _安全文件名(name) {
  return name.replace(/[/\\:*?"<>|]/g, '_');
}

function _触发下载(内容, 文件名, MIME = 'application/json;charset=utf-8') {
  if (_触发下载_保存锁) {
    console.warn('[下载] 正在保存中，跳过');
    return;
  }
  _触发下载_保存锁 = true;
  const 安全文件名 = _安全文件名(文件名);
  const 输出内容 = typeof 内容 === 'string' ? 内容 : JSON.stringify(内容, null, 2);
  const 完成 = () => { _触发下载_保存锁 = false; };
  // 鸿蒙原生：文本文件走 saveTextFile（避免 JS 侧自己编 base64）
  if (window.nativeBridge && window.nativeBridge.saveTextFile) {
    window.nativeBridge.saveTextFile(安全文件名, 输出内容).then(res => {
      完成();
      try {
        const 结果 = JSON.parse(res);
        if (!结果.success) {
          console.warn('[下载] 保存未完成:', 结果.error);
          _触发下载降级(输出内容, 安全文件名, MIME);
        }
      } catch {
        console.warn('[下载] 解析返回结果失败');
        _触发下载降级(输出内容, 安全文件名, MIME);
      }
    }).catch(e => {
      完成();
      console.warn('[下载] 原生保存异常:', e);
      _触发下载降级(输出内容, 安全文件名, MIME);
    });
    return;
  }
  // 降级到 saveFile（base64 方式，兼容旧版本）
  if (window.nativeBridge && window.nativeBridge.saveFile) {
    const base64 = btoa(unescape(encodeURIComponent(输出内容)));
    window.nativeBridge.saveFile(安全文件名, base64).then(res => {
      完成();
      try {
        const 结果 = JSON.parse(res);
        if (!结果.success) {
          console.warn('[下载] 保存未完成:', 结果.error);
          _触发下载降级(输出内容, 安全文件名, MIME);
        }
      } catch {
        _触发下载降级(输出内容, 安全文件名, MIME);
      }
    }).catch(() => {
      完成();
      _触发下载降级(输出内容, 安全文件名, MIME);
    });
    return;
  }
  完成();
  // 桌面降级：Blob + a 标签下载
  _触发下载降级(输出内容, 安全文件名, MIME);
}

/**
 * 桌面端降级下载方案
 */
function _触发下载降级(内容, 文件名, MIME) {
  const blob = new Blob([内容], { type: MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 文件名;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 导出为ZIP压缩包
 * @param {Array} memos - 备忘录列表
 * @param {string} 文件名 - ZIP文件名（不含扩展名）
 */
async function _导出为ZIP(memos, 文件名) {
  if (typeof JSZip === 'undefined') {
    alert('ZIP功能不可用，请检查网络连接');
    return;
  }
  
  const zip = new JSZip();
  const 文件夹 = zip.folder('备忘录导出');
  
  // 添加JSON清单文件
  const 包 = _构建导出包(memos);
  文件夹.file('清单.json', JSON.stringify(包, null, 2));
  
  // 为每条备忘录创建单独的文件夹
  memos.forEach((m, index) => {
    const 序号 = String(index + 1).padStart(3, '0');
    const 标题 = _过滤文件名(m.标题 || '未命名').substring(0, 30);
    const 备忘录文件夹 = 文件夹.folder(`${序号}-${标题}`);
    
    // 解析附件
    const 附件列表 = _解析附件(m.内容 || '');
    
    // 写内容文本文件
    let 内容 = `标题：${m.标题 || '无标题'}\n`;
    内容 += `文件夹：${m.文件夹 || '未分类'}\n`;
    内容 += `标签：${(m.标签 || []).join(', ') || '无'}\n`;
    内容 += `创建时间：${m.创建时间 || '未知'}\n`;
    内容 += `修改时间：${m.更新时间 || m.修改时间 || '未知'}\n`;
    内容 += `收藏：${m.收藏 ? '是' : '否'}\n`;
    内容 += `置顶：${m.已置顶 ? '是' : '否'}\n`;
    内容 += `附件数量：${附件列表.length}\n`;
    内容 += `\n========== 内容 ==========\n\n`;
    内容 += m.纯文本内容 || (m.内容 ? m.内容.replace(/<[^>]+>/g, '') : '');
    备忘录文件夹.file('内容.txt', 内容);
    
    // 添加附件文件（图片/PDF/Word/Excel 等任意类型）
    附件列表.forEach((附件, 附件索引) => {
      const 附件编号 = String(附件索引 + 1).padStart(2, '0');
      const 附件保存名 = `${序号}-${标题}-附件${附件编号}-${_过滤文件名(附件.name)}`;
      
      try {
        // 将 base64 数据转换为二进制
        const 二进制数据 = atob(附件.base64数据);
        const 字节数组 = new Uint8Array(二进制数据.length);
        for (let i = 0; i < 二进制数据.length; i++) {
          字节数组[i] = 二进制数据.charCodeAt(i);
        }
        备忘录文件夹.file(附件保存名, 字节数组);
      } catch (e) {
        console.warn(`[导出] 附件解析失败: ${附件.name}`, e);
      }
    });
  });
  
  // 生成ZIP并下载
  const blob = await zip.generateAsync({ type: 'blob' });
  // 鸿蒙原生：通过 NativeBridge 保存文件
  if (window.nativeBridge && window.nativeBridge.saveFile) {
    // blob → base64
    const reader = new FileReader();
    const base64 = await new Promise((resolve) => {
      reader.onload = () => {
        const result = reader.result;
        const parts = result.split(',');
        resolve(parts[1] || parts[0]);
      };
      reader.readAsDataURL(blob);
    });
    const 结果 = await window.nativeBridge.saveFile(`${文件名}.zip`, base64);
    const 响应 = JSON.parse(结果);
    if (!响应.success) {
      console.warn('[导出] 保存未完成:', 响应.error);
      _触发下载降级('', `${文件名}.zip`, 'application/zip');
    }
    return;
  }
  // 桌面降级
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${文件名}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从文件名获取扩展名
 */
function _获取扩展名(文件名) {
  const 匹配 = 文件名.match(/\.([^.]+)$/);
  return 匹配 ? 匹配[1].toLowerCase() : '';
}

/**
 * 显示导出选项对话框
 * @param {string} 标题 - 对话框标题
 * @param {number} 数量 - 备忘录数量
 * @returns {Promise<'json'|'zip'|null>} 用户选择
 */
async function _显示导出选项(标题, 数量) {
  const 消息 = `${标题}\n\n共 ${数量} 条备忘录\n\n请选择导出格式：`;
  
  // 使用自定义对话框（如果可用）或confirm
  if (window._显示导出选择对话框) {
    return await window._显示导出选择对话框(标题, 数量);
  }
  
  // 简化版：先用confirm选择是否ZIP
  const 使用ZIP = await window._自定义确认(`${消息}\n\n点击「确定」→ 打包为ZIP（含单独文本文件）\n点击「取消」→ 导出为JSON文件`);
  return 使用ZIP ? 'zip' : 'json';
}

/**
 * 显示单篇导出选项对话框
 * @param {object} memo - 备忘录对象
 * @returns {Promise<'zip'|'json'|null>} 用户选择
 */
window._显示导出选择对话框 = function(标题, 数量) {
  return new Promise((resolve) => {
    // 如果已有对话框，先移除
    const existing = document.getElementById('__导出选择对话框__');
    if (existing) existing.remove();
    
    // 创建遮罩层
    const 遮罩 = document.createElement('div');
    遮罩.id = '__导出选择对话框__';
    遮罩.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // 创建选项卡片
    const 卡片 = document.createElement('div');
    卡片.style.cssText = `
      background: var(--背景色, #fff);
      border-radius: 16px;
      padding: 16px;
      width: 280px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    `;
    
    // 标题
    const 标题栏 = document.createElement('div');
    标题栏.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      text-align: center;
      padding: 8px 0 16px;
      color: var(--文字主色, #333);
    `;
    标题栏.textContent = '导出格式';
    
    // 选项容器
    const 选项容器 = document.createElement('div');
    选项容器.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    
    // ZIP 选项
    const zip选项 = document.createElement('button');
    zip选项.style.cssText = `
      background: var(--背景主色, #f5f5f5);
      border: none;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 15px;
      color: var(--文字主色, #333);
      cursor: pointer;
      text-align: left;
    `;
    zip选项.innerHTML = '导出为 ZIP<br><span style="font-size:12px;color:var(--文字副色,#888)">含附件</span>';
    
    // JSON 选项
    const json选项 = document.createElement('button');
    json选项.style.cssText = `
      background: var(--背景主色, #f5f5f5);
      border: none;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 15px;
      color: var(--文字主色, #333);
      cursor: pointer;
      text-align: left;
    `;
    json选项.innerHTML = '导出为 JSON<br><span style="font-size:12px;color:var(--文字副色,#888)">完整备份</span>';
    
    // 取消按钮
    const 取消按钮 = document.createElement('button');
    取消按钮.style.cssText = `
      background: var(--背景主色, #f5f5f5);
      border: none;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 14px;
      color: var(--文字副色, #888);
      cursor: pointer;
      margin-top: 4px;
    `;
    取消按钮.textContent = '取消';
    
    // 点击处理
    const 关闭 = (结果) => {
      遮罩.remove();
      resolve(结果);
    };
    
    zip选项.onclick = () => 关闭('zip');
    json选项.onclick = () => 关闭('json');
    取消按钮.onclick = () => 关闭(null);
    遮罩.onclick = (e) => {
      if (e.target === 遮罩) 关闭(null);
    };
    
    // 组装
    选项容器.appendChild(zip选项);
    选项容器.appendChild(json选项);
    选项容器.appendChild(取消按钮);
    卡片.appendChild(标题栏);
    卡片.appendChild(选项容器);
    遮罩.appendChild(卡片);
    document.body.appendChild(遮罩);
  });
};

/**
 * 移动端分享（可选）
 */
function _尝试分享(blob, 文件名) {
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], 文件名, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({
        files: [file],
        title: '备忘录导出',
        text: `导出 ${文件名}`
      }).catch(() => {}); // 用户取消不报错
      return true;
    }
  }
  return false;
}

/**
 * 获取当前筛选范围内的备忘录（通用）
 * 复用渲染层的筛选逻辑，保证"所见即所得"
 */
/**
 * 获取当前筛选范围内的备忘录（所见即所得）
 * 复刻备忘录渲染.js的筛选逻辑，保证导出范围和显示一致
 */
function _获取当前筛选列表() {
  const 数据 = window._备忘录数据源 || window._备忘录数据 || [];
  const 当前筛选 = window._当前筛选 ? window._当前筛选() : 'all';
  const 搜索文本 = (window._备忘录搜索文本 || '').trim();

  // AI 临时筛选优先
  if (window._AI临时筛选?.ids) {
    const aiIds = new Set(window._AI临时筛选.ids);
    return 数据.filter(m => aiIds.has(m.id) && !m.已删除);
  }

  let 结果 = 数据.filter(m => {
    if (m.已删除) return false;
    if (当前筛选 === 'favorite') { if (!m.收藏) return false; }
    if (当前筛选 && 当前筛选 !== 'all' && 当前筛选 !== 'favorite') {
      if (m.文件夹 !== 当前筛选) return false;
    }
    return true;
  });

  if (搜索文本) {
    const q = 搜索文本.toLowerCase();
    结果 = 结果.filter(m =>
      (m.标题 || '').toLowerCase().includes(q) ||
      (m.内容 || '').toLowerCase().includes(q)
    );
  }

  return 结果;
}

// ========== 核心导出函数 ==========

/**
 * 导出入口1：全局导出（右上角更多菜单）
 * 导出当前筛选范围内所有备忘录
 */
window.导出当前列表 = async function() {
  try {
    const memos = _获取当前筛选列表();
    if (!memos || memos.length === 0) {
      alert('当前没有可导出的备忘录');
      return;
    }
    
    // 显示导出选项
    const 选择 = await window._显示导出选择对话框('导出当前列表', memos.length);
    if (!选择) return;
    
    const 时间戳 = _文件时间戳();
    if (选择 === 'zip') {
      await _导出为ZIP(memos, `备忘录备份-${时间戳}`);
      alert(`ZIP导出成功，共 ${memos.length} 条`);
    } else {
      const 名称 = `备忘录备份-${时间戳}.json`;
      const 包 = _构建导出包(memos);
      _触发下载(JSON.stringify(包, null, 2), 名称);
      alert(`JSON导出成功，共 ${memos.length} 条`);
    }
  } catch (e) {
    console.error('[导出] 失败:', e);
    alert('导出失败：' + e.message);
  }
};

/**
 * 导出入口2：多选导出（多选操作栏）
 * 导出已勾选的备忘录
 */
window.导出选中 = async function() {
  try {
    const ids = window.多选状态?.获取选中列表() || [];
    if (ids.length === 0) {
      alert('请先选择要导出的备忘录');
      return;
    }
    const 数据 = window._备忘录数据源 || window._备忘录数据 || [];
    const memos = 数据.filter(m => ids.includes(m.id));
    
    // 显示导出选项
    const 选择 = await window._显示导出选择对话框('导出选中备忘录', memos.length);
    if (!选择) return;
    
    const 时间戳 = _文件时间戳();
    if (选择 === 'zip') {
      await _导出为ZIP(memos, `选中-${时间戳}-${ids.length}条`);
      alert(`ZIP导出成功，共 ${memos.length} 条`);
    } else {
      const 包 = _构建导出包(memos, { 标签: `已选${ids.length}条` });
      const 名称 = `选中-${时间戳}-${ids.length}条.json`;
      _触发下载(JSON.stringify(包, null, 2), 名称);
      alert(`JSON导出成功，共 ${memos.length} 条`);
    }
  } catch (e) {
    console.error('[导出] 多选导出失败:', e);
    alert('导出失败：' + e.message);
  }
};

/**
 * 导出入口3：单篇导出（编辑页面）
 * 导出正在编辑的那一篇
 */
window.导出当前篇 = async function() {
  try {
    const id = window.当前编辑备忘录ID;
    if (!id) {
      alert('当前没有正在编辑的备忘录');
      return;
    }
    const 数据 = window._备忘录数据源 || window._备忘录数据 || [];
    const memo = 数据.find(m => m.id === id);
    if (!memo) {
      alert('找不到当前备忘录');
      return;
    }
    
    // 显示导出选项
    const 选择 = await window._显示导出选择对话框('导出当前篇', 1);
    if (!选择) return;
    
    const 安全标题 = _过滤文件名(memo.标题 || '备忘录');
    const 时间戳 = _文件时间戳();
    
    if (选择 === 'zip') {
      // 导出为ZIP（含附件）
      const 附件列表 = _解析附件(memo.内容 || '');
      await _导出为ZIP([memo], `${安全标题}-${时间戳}`);
      alert(附件列表.length > 0
        ? `ZIP导出成功，含 ${附件列表.length} 个附件`
        : 'ZIP导出成功');
    } else {
      // 导出为JSON
      const 包 = _构建导出包([memo], { 标签: memo.文件夹 });
      const 名称 = `${安全标题}-${时间戳}.json`;
      _触发下载(JSON.stringify(包, null, 2), 名称);
      alert('JSON导出成功');
    }
  } catch (e) {
    console.error('[导出] 单篇导出失败:', e);
    alert('导出失败：' + e.message);
  }
};

/**
 * 导出入口4：文件夹导出（文件夹树右键）
 * 导出指定文件夹及其所有子文件夹下的备忘录
 * @param {string} 文件夹名
 */
window.导出文件夹 = async function(文件夹名) {
  try {
    if (!文件夹名) {
      alert('未指定文件夹名');
      return;
    }
    const 数据 = window._备忘录数据源 || window._备忘录数据 || [];
    // 递归获取子文件夹名列表
    let 目标文件夹列表 = [文件夹名];
    if (window._获取所有子文件夹名) {
      目标文件夹列表.push(...(window._获取所有子文件夹名(文件夹名) || []));
    }
    // 收集所有符合条件的备忘录
    const memos = 数据.filter(m =>
      !m.已删除 && 目标文件夹列表.includes(m.文件夹)
    );
    if (memos.length === 0) {
      alert(`"${文件夹名}" 文件夹下没有备忘录`);
      return;
    }
    
    // 显示导出选项
    const 选择 = await window._显示导出选择对话框(`导出文件夹「${文件夹名}」`, memos.length);
    if (!选择) return;
    
    const 时间戳 = _文件时间戳();
    const 安全文件名 = _过滤文件名(文件夹名);
    if (选择 === 'zip') {
      await _导出为ZIP(memos, `文件夹-${安全文件名}-${时间戳}`);
      alert(`ZIP导出成功，共 ${memos.length} 条`);
    } else {
      const 包 = _构建导出包(memos, { 标签: 文件夹名 });
      const 名称 = `文件夹-${安全文件名}-${时间戳}.json`;
      _触发下载(JSON.stringify(包, null, 2), 名称);
      alert(`JSON导出成功，共 ${memos.length} 条`);
    }
  } catch (e) {
    console.error('[导出] 文件夹导出失败:', e);
    alert('导出失败：' + e.message);
  }
};

// ========== 导入功能 ==========

/**
 * 生成内容指纹（标题+纯文本内容 → 简易hash）
 */
function _内容指纹(标题, 内容) {
  const 纯文本 = (内容 || '').replace(/<[^>]+>/g, '').trim();
  let hash = 0;
  const str = (标题 || '') + '\x00' + 纯文本;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * 导入备份文件（支持 JSON 和 ZIP）
 * - JSON：解析 memos 数组，智能去重
 * - ZIP：扫描所有 .txt 文件，文件名作标题、内容作正文，放"未分类"
 * 入口：设置浮层里的"从备份恢复"
 */
window.导入备份文件 = async function() {
  return new Promise(async (resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip';
    input.style.display = 'none';

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) { resolve(null); return; }

      try {
        if (file.name.endsWith('.zip')) {
          await _导入ZIP(file, resolve);
        } else {
          await _导入JSON(file, resolve);
        }
      } catch (e) {
        console.error('[导入] 异常:', e);
        alert('导入失败：' + (e.message || '未知错误'));
        resolve(null);
      }
    });

    document.body.appendChild(input);
    input.click();
    setTimeout(() => { if (input.parentNode) input.parentNode.removeChild(input); }, 100);
  });
};

/**
 * 导入 JSON 备份文件（智能去重）
 */
async function _导入JSON(file, resolve) {
  let 数据;
  try {
    数据 = JSON.parse(await file.text());
  } catch (e) {
    alert('文件格式错误，不是有效的 JSON 文件');
    resolve(null); return;
  }

  if (!数据.memos || !Array.isArray(数据.memos)) {
    alert('文件格式错误：缺少 memos 数组');
    resolve(null); return;
  }

  const memos = 数据.memos;
  if (memos.length === 0) {
    alert('备份文件为空');
    resolve(null); return;
  }

  // 去重：对比已有备忘录指纹
  const 已有指纹集 = _构建已有指纹集();
  const 新增 = [];
  const 重复 = [];
  memos.forEach(m => {
    const fp = _内容指纹(m.标题, m.内容 || m.纯文本内容);
    if (已有指纹集.has(fp)) {
      重复.push(m);
    } else {
      新增.push(m);
    }
  });

  // 预览
  const 重复提示 = 重复.length > 0 ? `\n检测到 ${重复.length} 条重复，已自动跳过` : '';
  const 确认 = await window._自定义确认(
    `即将导入 ${新增.length} 条新备忘录${重复提示}\n\n点击确定继续`
  );
  if (!确认) { resolve(null); return; }
  if (新增.length === 0) {
    alert('全部备忘录已存在，无需导入');
    resolve({ 成功: 0, 跳过: 重复.length }); return;
  }

  // 逐条导入
  const 结果 = await _批量导入(新增);
  结果.跳过 = 重复.length;
  _导入完成提示(结果);
  resolve(结果);
}

/**
 * 导入 ZIP 文件（扫描所有 .txt，文件名作标题）
 */
async function _导入ZIP(file, resolve) {
  if (typeof JSZip === 'undefined') {
    alert('ZIP导入需要 JSZip 库，请检查网络连接');
    resolve(null); return;
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (e) {
    alert('无法读取 ZIP 文件：' + (e.message || ''));
    resolve(null); return;
  }

  // 先检测是否为「自家导出包」（含清单.json）
  const 清单文件 = zip.file('清单.json') || zip.file('备忘录导出/清单.json');
  console.log('[ZIP导入] 检测清单文件:', 清单文件 ? 清单文件.name : '未找到');
  if (清单文件) {
    console.log('[ZIP导入] 识别为自家导出包，走完整还原模式');
    await _导入结构化ZIP(zip, 清单文件, resolve);
  } else {
    console.log('[ZIP导入] 非自家导出包，走纯文本扫描模式');
    await _导入纯文本ZIP(zip, resolve);
  }
}

/**
 * 导入自家导出的结构化 ZIP（含清单.json，完美还原所有字段）
 */
async function _导入结构化ZIP(zip, 清单文件, resolve) {
  let 清单内容;
  try {
    const 文本 = await 清单文件.async('string');
    console.log('[结构化ZIP导入] 清单.json 读取成功，长度:', 文本.length);
    清单内容 = JSON.parse(文本);
    console.log('[结构化ZIP导入] 解析到 memos:', 清单内容.memos?.length, '条');
  } catch (e) {
    console.error('[结构化ZIP导入] 清单解析失败:', e);
    alert('清单.json 解析失败，尝试按纯文本 ZIP 导入');
    await _导入纯文本ZIP(zip, resolve);
    return;
  }

  if (!清单内容.memos || !Array.isArray(清单内容.memos)) {
    alert('清单.json 格式不正确，尝试按纯文本 ZIP 导入');
    await _导入纯文本ZIP(zip, resolve);
    return;
  }

  const memos = 清单内容.memos;
  if (memos.length === 0) {
    alert('备份文件为空');
    resolve(null); return;
  }

  // 尝试从 ZIP 中还原附件到 HTML 内容
  // 附件在 ZIP 中的命名格式：序号_附件序号-原文件名（如 001_附件01-截图.png）
  // 清单.json 中的备忘录按序号排列，对应 ZIP 中的序号前缀
  for (let i = 0; i < memos.length; i++) {
    const m = memos[i];
    const 序号 = String(i + 1).padStart(3, '0');
    const 附件前缀 = 序号 + '_附件';
    // 扫描 ZIP 中以此前缀开头的附件文件
    zip.forEach((path, entry) => {
      if (entry.dir) return;
      const 文件名 = path.split('/').pop();
      if (文件名.startsWith(附件前缀)) {
        // 找到对应附件，标记路径以便后续异步读取
        if (!m._待还原附件) m._待还原附件 = [];
        m._待还原附件.push({ zipPath: path, 文件名 });
      }
    });
  }

  // 异步读取附件并嵌入 HTML 内容
  for (const m of memos) {
    if (!m._待还原附件 || m._待还原附件.length === 0) continue;
    for (const 附件 of m._待还原附件) {
      try {
        const blob = await zip.file(附件.zipPath).async('blob');
        // 将附件转为 base64 data URL
        const dataUrl = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(blob);
        });
        // 在 HTML 内容中查找对应的附件占位符并还原
        // 导出时附件以 <img src="data:..."> 或 <span data-file-name="xxx" data-file-data="data:...">
        // 这里的策略：如果内容中已有附件标记（data-file-name 匹配），替换 data-file-data
        const 文件名转义 = 附件.文件名.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const 正则 = new RegExp(`data-file-name="${文件名转义}"`, 'g');
        if (正则.test(m.内容 || '')) {
          // 替换空 data-file-data 或补充
          m.内容 = (m.内容 || '').replace(
            new RegExp(`(<[^>]*data-file-name="${文件名转义}"[^>]*?)(data-file-data="[^"]*")?([^>]*>)`, 'g'),
            (match, before, _old, after) => {
              // 移除旧的 data-file-data
              const clean = (before + after).replace(/\s*data-file-data="[^"]*"\s*/g, ' ');
              return clean.replace(/>\s*$/, ` data-file-data="${dataUrl}">`);
            }
          );
        }
        // 如果内容中没有匹配的附件标记，追加到内容末尾
        else {
          const 附件HTML = `<img src="${dataUrl}" data-file-name="${附件.文件名}" style="max-width:100%">`;
          m.内容 = (m.内容 || '') + 附件HTML;
        }
      } catch (e) {
        console.warn('[结构化ZIP导入] 附件还原失败:', 附件.文件名, e);
      }
    }
    delete m._待还原附件;
  }

  // 去重
  console.log('[结构化ZIP导入] 开始去重...');
  const 已有指纹集 = _构建已有指纹集();
  console.log('[结构化ZIP导入] 已有备忘录指纹数:', 已有指纹集.size);
  const 新增 = [];
  const 重复 = [];
  memos.forEach(m => {
    const fp = _内容指纹(m.标题, m.内容);
    if (已有指纹集.has(fp)) {
      重复.push(m);
    } else {
      新增.push(m);
    }
  });
  console.log('[结构化ZIP导入] 去重结果: 新增', 新增.length, '重复', 重复.length);

  const 重复提示 = 重复.length > 0 ? `\n检测到 ${重复.length} 条重复，已自动跳过` : '';
  const 确认 = await window._自定义确认(
    `✅ 识别为爱助手导出包，将完美还原所有数据\n` +
    `即将导入 ${新增.length} 条备忘录（含标签/文件夹/收藏/附件）${重复提示}\n\n` +
    `点击确定继续`
  );
  if (!确认) { resolve(null); return; }
  if (新增.length === 0) {
    alert('全部备忘录已存在，无需导入');
    resolve({ 成功: 0, 跳过: 重复.length }); return;
  }

  // 完美导入：保留所有字段
  const 结果 = await _批量导入完整(新增);
  结果.跳过 = 重复.length;
  _导入完成提示(结果);
  resolve(结果);
}

/**
 * 批量导入备忘录（完整字段，用于自家导出包还原）
 */
async function _批量导入完整(memos) {
  let 成功 = 0;
  let 失败 = 0;
  for (const m of memos) {
    try {
      await window.备忘录管理器?.createMemo({
        标题: m.标题 || '无标题',
        内容: m.内容 || '',
        标签: Array.isArray(m.标签) ? m.标签 : [],
        文件夹: m.文件夹 || '未分类',
        收藏: !!m.收藏,
        已置顶: !!m.已置顶,
        置顶时间: m.置顶时间 || null,
        创建时间: m.创建时间 || null,
        更新时间: m.更新时间 || null
      });
      成功++;
    } catch (e) {
      console.warn('[完整导入] 失败:', m.标题, e);
      失败++;
    }
  }

  // 刷新 UI
  if (window.渲染备忘录列表) window.渲染备忘录列表();
  if (window.渲染文件夹树) window.渲染文件夹树();

  return { 成功, 失败 };
}

/**
 * 导入纯文本 ZIP（扫描所有 .txt，文件名作标题，放未分类）
 */
async function _导入纯文本ZIP(zip, resolve) {
  // 扫描所有 .txt 文件
  const txt文件列表 = [];
  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.txt')) {
      txt文件列表.push({ path: relativePath, entry: zipEntry });
    }
  });

  if (txt文件列表.length === 0) {
    alert('ZIP包中没有找到 .txt 文件');
    resolve(null); return;
  }

  // 逐个读取 txt 内容
  const 待导入 = [];
  for (const { path, entry } of txt文件列表) {
    try {
      const 内容 = await entry.async('string');
      const 文件名 = path.split('/').pop();
      const 标题 = 文件名.replace(/\.txt$/i, '').trim() || '未命名';
      待导入.push({ 标题, 内容: 内容.trim(), 文件夹: '未分类', 标签: [] });
    } catch (e) {
      console.warn('[ZIP导入] 读取失败:', path, e);
    }
  }

  if (待导入.length === 0) {
    alert('ZIP包中的 .txt 文件均无法读取');
    resolve(null); return;
  }

  // 去重
  const 已有指纹集 = _构建已有指纹集();
  const 新增 = [];
  const 重复 = [];
  待导入.forEach(m => {
    const fp = _内容指纹(m.标题, m.内容);
    if (已有指纹集.has(fp)) {
      重复.push(m);
    } else {
      新增.push(m);
    }
  });

  const 重复提示 = 重复.length > 0 ? `\n检测到 ${重复.length} 条重复，已自动跳过` : '';
  const 确认 = await window._自定义确认(
    `ZIP 中找到 ${txt文件列表.length} 个 .txt 文件\n` +
    `即将导入 ${新增.length} 条新备忘录${重复提示}\n\n` +
    `点击确定继续`
  );
  if (!确认) { resolve(null); return; }
  if (新增.length === 0) {
    alert('全部备忘录已存在，无需导入');
    resolve({ 成功: 0, 跳过: 重复.length }); return;
  }

  const 结果 = await _批量导入(新增);
  结果.跳过 = 重复.length;
  _导入完成提示(结果);
  resolve(结果);
}

/**
 * 构建已有备忘录的指纹集合（用于去重）
 */
function _构建已有指纹集() {
  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  const 指纹集 = new Set();
  数据源.forEach(m => {
    if (m.已删除) return;
    指纹集.add(_内容指纹(m.标题, m.内容));
  });
  return 指纹集;
}

/**
 * 批量导入备忘录
 */
async function _批量导入(memos) {
  let 成功 = 0;
  let 失败 = 0;
  for (const m of memos) {
    try {
      await window.备忘录管理器?.createMemo({
        标题: m.标题 || '无标题',
        内容: m.内容 || '',
        标签: Array.isArray(m.标签) ? m.标签 : [],
        文件夹: m.文件夹 || '未分类'
      });
      成功++;
    } catch (e) {
      console.warn('[导入] 失败:', m.标题, e);
      失败++;
    }
  }

  // 刷新 UI
  if (window.渲染备忘录列表) window.渲染备忘录列表();
  if (window.渲染文件夹树) window.渲染文件夹树();

  return { 成功, 失败 };
}

/**
 * 导入完成提示
 */
function _导入完成提示(结果) {
  const 跳过提示 = 结果.跳过 ? `，跳过重复 ${结果.跳过} 条` : '';
  if (结果.失败 > 0) {
    alert(`导入完成：成功 ${结果.成功} 条，失败 ${结果.失败} 条${跳过提示}`);
  } else {
    alert(`导入成功，共 ${结果.成功} 条${跳过提示}`);
  }
}

/**
 * 在设置浮层添加"从备份恢复"按钮（被动调用）
 * 由设置浮层.js 在渲染时调用
 */
window.挂载导入入口到设置浮层 = function(容器元素) {
  if (!容器元素) return;
  const btn = document.createElement('button');
  btn.className = '次要按钮 简洁按钮';
  btn.textContent = '从备份恢复';
  btn.title = '导入 JSON 或 ZIP 格式的备忘录备份文件';
  btn.addEventListener('click', () => {
    window.导入备份文件?.();
  });
  容器元素.appendChild(btn);
};

// ========== 按年份/月份导出 ==========

/**
 * 导出指定年份的备忘录
 */
window.导出指定年份 = async function(年份) {
  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  const 筛选结果 = 数据源.filter(m => {
    if (m.已删除) return false;
    const d = new Date(m.日期 || m.更新时间);
    return d.getFullYear().toString() === String(年份);
  });
  
  if (筛选结果.length === 0) {
    alert(`${年份}年没有备忘录`);
    return;
  }
  
  const 包 = _构建导出包(筛选结果, { 标签: `${年份}年` });
  const 文件名 = `备忘录_${年份}年_${_文件时间戳()}.json`;
  _触发下载(包, 文件名);
};

/**
 * 导出指定月份的备忘录
 */
window.导出指定年月 = async function(年份, 月份) {
  console.log('[导出指定年月] 开始导出', 年份, 月份);
  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  console.log('[导出指定年月] 数据源长度=', 数据源.length);
  const 筛选结果 = 数据源.filter(m => {
    if (m.已删除) return false;
    const d = new Date(m.日期 || m.更新时间);
    const 月份Str = String(d.getMonth() + 1).padStart(2, '0');
    return d.getFullYear().toString() === String(年份) && 月份Str === String(月份).padStart(2, '0');
  });
  console.log('[导出指定年月] 筛选结果=', 筛选结果.length);
  
  if (筛选结果.length === 0) {
    alert(`${年份}年${月份}月没有备忘录`);
    return;
  }
  
  const 月名称 = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'][parseInt(月份) - 1];
  const 包 = _构建导出包(筛选结果, { 标签: `${年份}年${月名称}` });
  console.log('[导出指定年月] 包内容=', 包);
  const 文件名 = `备忘录_${年份}年${月份}月_${_文件时间戳()}.json`;
  _触发下载(包, 文件名);
};


/**
 * ZIP导出指定年份的备忘录
 */
window._导出指定年份为ZIP = async function(年份) {
  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  const memos = 数据源.filter(m => {
    if (m.已删除) return false;
    return new Date(m.日期 || m.更新时间).getFullYear().toString() === String(年份);
  });
  if (memos.length === 0) {
    alert(年份 + '年没有备忘录');
    return;
  }
  await _导出为ZIP(memos, '备忘录_' + 年份 + '年_' + _文件时间戳());
  alert('ZIP导出成功，共 ' + memos.length + ' 条');
};

/**
 * ZIP导出指定月份的备忘录
 */
window._导出指定年月为ZIP = async function(年份, 月份) {
  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  const memos = 数据源.filter(m => {
    if (m.已删除) return false;
    const d = new Date(m.日期 || m.更新时间);
    const 月份Str = String(d.getMonth() + 1).padStart(2, '0');
    return d.getFullYear().toString() === String(年份) && 月份Str === String(月份).padStart(2, '0');
  });
  if (memos.length === 0) {
    alert(年份 + '年' + 月份 + '月没有备忘录');
    return;
  }
  const 月名称 = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'][parseInt(月份) - 1];
  await _导出为ZIP(memos, '备忘录_' + 年份 + '年' + 月名称 + '_' + _文件时间戳());
  alert('ZIP导出成功，共 ' + memos.length + ' 条');
};

// 暴露关键函数给 AI 工具调用
window._触发下载 = _触发下载;
window._导出为ZIP = _导出为ZIP;
window._构建导出包 = _构建导出包;
