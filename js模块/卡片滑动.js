// 卡片滑动.js - 左滑菜单逻辑
// 2026-05-07 v5: 修复展开回弹 + 已展开卡片触摸拦截
// 浏览器原生处理竖滚（零延迟），JS 只负责横滑视觉反馈

let 当前滑动卡片 = null;
let 滑动起始X = 0;
let 滑动起始Y = 0;
let 当前滑动X = 0;
let 卡片宽度 = 0;
const 操作栏宽度 = 300;
const 滑动阈值 = 30;
const 方向判定阈值 = 8;
let 是否发生了滑动 = false;
let 当前展开的卡片容器 = null;
let 忽略下次点击 = false;
let 已判定为竖滚 = false;
let 滑动保护中 = false;
let 刚收起卡片 = false;

function 初始化卡片滑动() {
  const 卡片列表 = document.querySelectorAll('.备忘录卡片滑动容器');
  卡片列表.forEach(容器 => {
    const 卡片 = 容器.querySelector('.备忘录卡片');
    if (!卡片) return;
    
    卡片.removeEventListener('mousedown', 开始滑动);
    卡片.removeEventListener('touchstart', 开始滑动);
    卡片.removeEventListener('touchmove', 触摸移动);
    卡片.removeEventListener('touchend', 触摸结束);
    
    卡片.addEventListener('mousedown', 开始滑动);
    卡片.addEventListener('touchstart', 开始滑动, { passive: true });
    卡片.addEventListener('touchmove', 触摸移动, { passive: true });
    卡片.addEventListener('touchend', 触摸结束, { passive: true });
    
    const 操作栏按钮 = 容器.querySelectorAll('.操作栏按钮');
    操作栏按钮.forEach(按钮 => {
      按钮.removeEventListener('touchend', 操作栏触控处理);
      按钮.removeEventListener('click', 操作栏点击处理);
      按钮.addEventListener('touchend', 操作栏触控处理);
      按钮.addEventListener('click', 操作栏点击处理);
    });
    
    const 复选框 = 容器.querySelector('.多选复选框');
    if (复选框) {
      复选框.removeEventListener('click', 复选框点击处理);
      复选框.addEventListener('click', 复选框点击处理);
    }
  });
  
  document.removeEventListener('click', 全局点击收起);
  document.addEventListener('click', 全局点击收起);
  document.removeEventListener('mousemove', 桌面鼠标移动);
  document.removeEventListener('mouseup', 桌面鼠标结束);
  document.addEventListener('mousemove', 桌面鼠标移动);
  document.addEventListener('mouseup', 桌面鼠标结束);
}

function 复选框点击处理(e) {
  e.stopPropagation();
  const 复选框 = e.currentTarget;
  const 容器 = 复选框.closest('.备忘录卡片滑动容器');
  if (!容器) return;
  const id = parseInt(容器.dataset.id);
  window.多选状态?.切换选中(id);
}

// touchend 处理：在触控屏上直接响应，绕过 click 合成延迟
function 操作栏触控处理(e) {
  // 防止与 click 重复触发：touch 设备的 touchend 后浏览器会合成 click
  e.preventDefault();
  e.stopPropagation();
  // 展开状态下，确认没有被卡片 touch 监听收起
  // touchend 直接在按钮上触发，不会冒泡到卡片的 touchstart
  实际处理操作栏操作(e.currentTarget);
}

function 操作栏点击处理(e) {
  e.stopPropagation();
  // touch 设备上由 touchend 处理，跳过 click 避免重复
  if ('ontouchstart' in window) return;
  实际处理操作栏操作(e.currentTarget);
}

function 实际处理操作栏操作(按钮) {
  const action = 按钮.dataset.action;
  const 容器 = 按钮.closest('.备忘录卡片滑动容器');
  if (!容器) return;
  const id = parseInt(容器.dataset.id);
  switch (action) {
    case 'favorite': window._切换收藏(id); break;
    case 'pin': {
      const 当前备忘录 = window.备忘录管理器?.memos?.find(m => m.id === id) || (window._备忘录数据 || []).find(m => m.id === id);
      当前备忘录?.已置顶 ? window._取消置顶(id) : window._置顶备忘录(id);
      break;
    }
    case 'move': {
      const 待移动备忘录 = (window._备忘录数据源 || []).find(m => m.id === id);
      const 当前文件夹 = 待移动备忘录?.文件夹 || '未分类';
      const 全文件夹列表 = window._获取所有文件夹列表 ? window._获取所有文件夹列表() : [];
      const 所有文件夹 = 全文件夹列表.filter(f => f.名称 !== '全部').map(f => f.名称);
      // 调用文件夹选择对话框（与编辑器一致，可选择而非手工输入）
      if (window._显示文件夹选择对话框) {
        window._显示文件夹选择对话框(所有文件夹, `移动「${待移动备忘录?.标题?.slice(0, 20) || id}」`).then(目标文件夹 => {
          if (!目标文件夹 || 目标文件夹 === 当前文件夹) return;
          window.备忘录管理器.updateMemo(id, { 文件夹: 目标文件夹 }).then(() => { if (window.渲染备忘录列表) window.渲染备忘录列表(); });
        });
      } else {
        // 降级：用自定义对话框替代 prompt()（鸿蒙 WebView 屏蔽 prompt）
        window._自定义输入(`移动「${待移动备忘录?.标题?.slice(0, 20) || id}」\n\n当前：${当前文件夹}\n\n输入目标文件夹：\n\n可用：${所有文件夹.join('、')}`, 当前文件夹).then(目标文件夹 => {
          if (!目标文件夹) return;
          if (!所有文件夹.includes(目标文件夹)) { window._显示提示(`文件夹「${目标文件夹}」不存在`,'error'); return; }
          if (目标文件夹 === 当前文件夹) { window._显示提示('已在该文件夹中','info'); return; }
          window.备忘录管理器.updateMemo(id, { 文件夹: 目标文件夹 }).then(() => { if (window.渲染备忘录列表) window.渲染备忘录列表(); });
        });
      }
      break;
    }
    case 'delete': window._删除备忘录(id); break;
    case 'restore': window._恢复备忘录(id); break;
    case 'permanent-delete': window._永久删除备忘录(id); break;
  }
}

function 全局点击收起(e) {
  if (当前展开的卡片容器) {
    // 点击操作栏按钮不收起（按钮有自己的处理）
    if (当前展开的卡片容器.contains(e.target) && e.target.closest('.操作栏按钮')) return;
    const 点击了其他卡片 = e.target.closest('.备忘录卡片滑动容器') && e.target.closest('.备忘录卡片滑动容器') !== 当前展开的卡片容器;
    收起所有卡片();
    if (点击了其他卡片) {
      刚收起卡片 = true;
      setTimeout(() => { 刚收起卡片 = false; }, 300);
    }
  }
}

function 开始滑动(e) {
  const 是触摸 = e.type.includes('touch');
  const 卡片 = e.currentTarget;
  const 容器 = 卡片.closest('.备忘录卡片滑动容器');
  
  // ★ 已展开的卡片：触摸在操作栏按钮或复选框上时不收起（让 click/touchend 正常处理），其余收起
  if (容器.classList.contains('展开')) {
    if (e.target.closest('.操作栏按钮') || e.target.closest('.多选复选框')) return;
    收起卡片(容器); return;
  }
  
  是否发生了滑动 = false;
  已判定为竖滚 = false;
  当前滑动卡片 = 卡片;
  容器.classList.add('滑动中');
  // transition 已由 CSS .滑动中 .备忘录卡片 { transition: none } 禁用，无需 JS 再设
  
  滑动起始X = 是触摸 ? e.touches[0].clientX : e.clientX;
  滑动起始Y = 是触摸 ? e.touches[0].clientY : e.clientY;
  当前滑动X = 0;
  卡片宽度 = 卡片.offsetWidth;
  
  if (!是触摸) e.stopPropagation();
  
  const 所有容器 = document.querySelectorAll('.备忘录卡片滑动容器');
  所有容器.forEach(other容器 => {
    if (other容器 !== 容器 && 当前展开的卡片容器 === other容器) 收起卡片(other容器);
  });
}

function 触摸移动(e) {
  if (!当前滑动卡片 || !当前滑动卡片.closest) return;
  if (已判定为竖滚) return;
  
  const clientX = e.touches[0].clientX;
  const clientY = e.touches[0].clientY;
  const deltaX = clientX - 滑动起始X;
  const deltaY = clientY - 滑动起始Y;
  
  if (Math.abs(deltaX) > 方向判定阈值 || Math.abs(deltaY) > 方向判定阈值) {
    if (Math.abs(deltaY) >= Math.abs(deltaX)) {
      已判定为竖滚 = true;
      return;
    }
  }
  
  if (deltaX > 0) {
    已判定为竖滚 = true;
    return;
  }
  
  if (Math.abs(deltaX) < 滑动阈值) return;
  
  是否发生了滑动 = true;
  当前滑动X = deltaX;
  let translateX = 当前滑动X;
  if (translateX > 0) translateX = 0;
  else if (translateX < -操作栏宽度) translateX = -操作栏宽度;
  当前滑动卡片.style.transform = `translateX(${translateX}px)`;
  const 容器 = 当前滑动卡片.closest('.备忘录卡片滑动容器');
  const 操作栏 = 容器?.querySelector('.卡片操作栏');
  if (操作栏) {
    操作栏.classList.toggle('操作栏可见', Math.abs(translateX) > 操作栏宽度 * 0.5);
  }
}

function 触摸结束(e) {
  if (!当前滑动卡片) return;
  结束滑动逻辑();
}

function 桌面鼠标移动(e) {
  if (!当前滑动卡片 || !当前滑动卡片.closest) return;
  const deltaX = e.clientX - 滑动起始X;
  if (Math.abs(deltaX) < 5) return;
  if (Math.abs(deltaX) > 滑动阈值) 是否发生了滑动 = true;
  if (deltaX > 0) return;
  当前滑动X = deltaX;
  let translateX = 当前滑动X;
  if (translateX > 0) translateX = 0;
  else if (translateX < -操作栏宽度) translateX = -操作栏宽度;
  当前滑动卡片.style.transform = `translateX(${translateX}px)`;
  const 容器 = 当前滑动卡片.closest('.备忘录卡片滑动容器');
  const 操作栏 = 容器?.querySelector('.卡片操作栏');
  if (操作栏) {
    操作栏.classList.toggle('操作栏可见', Math.abs(translateX) > 操作栏宽度 * 0.5);
  }
}

function 桌面鼠标结束(e) {
  if (!当前滑动卡片) return;
  结束滑动逻辑();
}

function 结束滑动逻辑() {
  if (!当前滑动卡片 || !当前滑动卡片.closest) {
    当前滑动卡片 = null;
    return;
  }
  const 容器 = 当前滑动卡片.closest('.备忘录卡片滑动容器');
  if (!容器) {
    当前滑动卡片 = null;
    return;
  }
  容器.classList.remove('滑动中');
  const shouldExpand = Math.abs(当前滑动X) > 操作栏宽度 * 0.3;
  if (shouldExpand) {
    if (当前展开的卡片容器 && 当前展开的卡片容器 !== 容器) 收起卡片(当前展开的卡片容器);
    // ★ 先加展开 class，再清 inline style，避免中间状态闪回
    容器.classList.add('展开');
    当前展开的卡片容器 = 容器;
    // 清空 inline style，CSS .展开 接管 transform
    // remove('滑动中') 已恢复 transition，清 inline 时会有 0.15s 平滑动画到 -300px（好效果）
    当前滑动卡片.style.transform = '';
    当前滑动卡片.style.transition = '';
    const 操作栏 = 容器.querySelector('.卡片操作栏');
    if (操作栏) 操作栏.classList.add('操作栏可见');
    忽略下次点击 = true;
    setTimeout(() => { 忽略下次点击 = false; }, 300);
  } else {
    收起卡片(容器);
  }
  当前滑动卡片 = null;
  滑动起始X = 0;
  滑动起始Y = 0;
  当前滑动X = 0;
  已判定为竖滚 = false;
  if (是否发生了滑动) {
    setTimeout(() => { 是否发生了滑动 = false; }, 300);
    是否发生了滑动 = false;
    滑动保护中 = true;
    setTimeout(() => { 滑动保护中 = false; }, 300);
  }
}

function 收起卡片(容器) {
  if (!容器) return;
  const 卡片 = 容器.querySelector('.备忘录卡片');
  // 先设好动画状态，确保收起动画完整播放
  if (卡片) {
    卡片.style.transform = '';
    卡片.style.transition = '';
  }
  容器.classList.remove('展开');
  const 操作栏 = 容器.querySelector('.卡片操作栏');
  if (操作栏) 操作栏.classList.remove('操作栏可见');
  // 延迟清指针，等 0.2s 收起动画结束
  if (当前展开的卡片容器 === 容器) {
    const 正在收起的 = 容器;
    当前展开的卡片容器 = null;
  }
}

function 收起所有卡片() {
  if (当前展开的卡片容器) 收起卡片(当前展开的卡片容器);
}

window.初始化卡片滑动 = 初始化卡片滑动;
window._是否发生了滑动 = () => 是否发生了滑动 || 滑动保护中;
window._当前展开的卡片 = () => 当前展开的卡片容器;
window._收起所有卡片 = 收起所有卡片;
window._刚收起卡片 = () => 刚收起卡片;
