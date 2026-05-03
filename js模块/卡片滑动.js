// 卡片滑动.js - 左滑菜单逻辑

let 当前滑动卡片 = null;
let 滑动起始X = 0;
let 当前滑动X = 0;
let 卡片宽度 = 0;
const 操作栏宽度 = 300;
const 滑动阈值 = 30;
let 是否发生了滑动 = false;
let 当前展开的卡片容器 = null;
let 忽略下次点击 = false;

function 初始化卡片滑动() {
  const 卡片列表 = document.querySelectorAll('.备忘录卡片滑动容器');
  卡片列表.forEach(容器 => {
    const 卡片 = 容器.querySelector('.备忘录卡片');
    if (!卡片) return;
    卡片.removeEventListener('mousedown', 开始滑动);
    卡片.removeEventListener('touchstart', 开始滑动);
    卡片.addEventListener('mousedown', 开始滑动);
    卡片.addEventListener('touchstart', 开始滑动, { passive: false });
    const 操作栏按钮 = 容器.querySelectorAll('.操作栏按钮');
    操作栏按钮.forEach(按钮 => {
      按钮.removeEventListener('click', 操作栏点击处理);
      按钮.addEventListener('click', 操作栏点击处理);
    });
    
    // 绑定多选复选框点击事件
    const 复选框 = 容器.querySelector('.多选复选框');
    if (复选框) {
      复选框.removeEventListener('click', 复选框点击处理);
      复选框.addEventListener('click', 复选框点击处理);
    }
  });
  document.removeEventListener('click', 全局点击收起);
  document.addEventListener('click', 全局点击收起);
  document.removeEventListener('touchend', 结束滑动);
  document.removeEventListener('mouseup', 结束滑动);
  document.addEventListener('touchend', 结束滑动);
  document.addEventListener('mouseup', 结束滑动);
  document.removeEventListener('touchmove', 滑动中);
  document.removeEventListener('mousemove', 滑动中);
  document.addEventListener('touchmove', 滑动中, { passive: false });
  document.addEventListener('mousemove', 滑动中);
}

// 多选复选框点击处理
function 复选框点击处理(e) {
  e.stopPropagation();
  const 复选框 = e.currentTarget;
  const 容器 = 复选框.closest('.备忘录卡片滑动容器');
  if (!容器) return;
  const id = parseInt(容器.dataset.id);
  
  // 切换选中状态
  window.多选状态?.切换选中(id);
}

function 操作栏点击处理(e) {
  e.stopPropagation();
  const 按钮 = e.currentTarget;
  const action = 按钮.dataset.action;
  const 容器 = 按钮.closest('.备忘录卡片滑动容器');
  if (!容器) return;
  const id = parseInt(容器.dataset.id);
  // 根据action执行操作
  switch (action) {
    case 'favorite': {
      window._切换收藏(id);
      break;
    }
    case 'pin': {
      // 切换置顶状态：已置顶则取消，否则置顶
      const 当前备忘录 = window.备忘录管理器?.memos?.find(m => m.id === id) || (window._备忘录数据 || []).find(m => m.id === id);
      if (当前备忘录?.已置顶) {
        window._取消置顶(id);
      } else {
        window._置顶备忘录(id);
      }
      break;
    }
    case 'move': {
      // 获取当前备忘录的文件夹和所有可用文件夹
      const 待移动备忘录 = (window._备忘录数据源 || []).find(m => m.id === id);
      const 当前文件夹 = 待移动备忘录?.文件夹 || '未分类';
      const 所有文件夹 = window._获取所有文件夹列表 ? window._获取所有文件夹列表().map(f => f.名称) : ['未分类'];
      const 选择提示 = `移动「${待移动备忘录?.标题?.slice(0, 20) || id}」\n\n当前：${当前文件夹}\n\n输入目标文件夹名称：\n\n可用：${所有文件夹.join('、')}`;
      const 目标文件夹 = prompt(选择提示);
      if (!目标文件夹) break;
      if (!所有文件夹.includes(目标文件夹)) {
        alert(`文件夹「${目标文件夹}」不存在，可用：${所有文件夹.join('、')}`);
        break;
      }
      if (目标文件夹 === 当前文件夹) {
        alert('已在该文件夹中');
        break;
      }
      window.备忘录管理器.updateMemo(id, { 文件夹: 目标文件夹 }).then(() => {
        if (window.渲染备忘录列表) window.渲染备忘录列表();
      });
      break;
    }
    case 'delete': {
      window._删除备忘录(id);
      break;
    }
    case 'restore': {
      window._恢复备忘录(id);
      break;
    }
    case 'permanent-delete': {
      window._永久删除备忘录(id);
      break;
    }
  }
}

function 全局点击收起(e) {
  if (忽略下次点击) return;
  if (当前展开的卡片容器) {
    if (当前展开的卡片容器.contains(e.target) && e.target.closest('.操作栏按钮')) return;
    收起所有卡片();
  }
}

function 开始滑动(e) {
  e.preventDefault();
  e.stopPropagation();
  const 卡片 = e.currentTarget;
  const 容器 = 卡片.closest('.备忘录卡片滑动容器');
  if (容器.classList.contains('展开') && e.type === 'mousedown') return;
  是否发生了滑动 = false;
  当前滑动卡片 = 卡片;
  容器.classList.add('滑动中');
  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  滑动起始X = clientX;
  当前滑动X = 0;
  卡片宽度 = 卡片.offsetWidth;
  const 所有容器 = document.querySelectorAll('.备忘录卡片滑动容器');
  所有容器.forEach(other容器 => {
    if (other容器 !== 容器 && 当前展开的卡片容器 === other容器) 收起卡片(other容器);
  });
}

function 滑动中(e) {
  if (!当前滑动卡片) return;
  e.preventDefault();
  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  const deltaX = clientX - 滑动起始X;
  if (Math.abs(deltaX) < 5) return;
  if (Math.abs(deltaX) > 滑动阈值) 是否发生了滑动 = true;
  当前滑动X = deltaX;
  let translateX = 当前滑动X;
  if (translateX > 0) translateX = 0;
  else if (translateX < -操作栏宽度) translateX = -操作栏宽度;
  当前滑动卡片.style.transform = `translateX(${translateX}px)`;
  const 容器 = 当前滑动卡片.closest('.备忘录卡片滑动容器');
  const 操作栏 = 容器.querySelector('.卡片操作栏');
  if (操作栏) {
    const opacity = Math.min(Math.abs(translateX) / 操作栏宽度, 1);
    操作栏.style.opacity = opacity.toString();
  }
}

function 结束滑动(e) {
  if (!当前滑动卡片) return;
  const 容器 = 当前滑动卡片.closest('.备忘录卡片滑动容器');
  容器.classList.remove('滑动中');
  const shouldExpand = Math.abs(当前滑动X) > 操作栏宽度 * 0.3;
  if (shouldExpand) {
    if (当前展开的卡片容器 && 当前展开的卡片容器 !== 容器) 收起卡片(当前展开的卡片容器);
    当前滑动卡片.style.transform = '';
    当前滑动卡片.style.transition = '';
    容器.classList.add('展开');
    const 操作栏 = 容器.querySelector('.卡片操作栏');
    if (操作栏) 操作栏.style.opacity = '1';
    当前展开的卡片容器 = 容器;
    忽略下次点击 = true;
    setTimeout(() => { 忽略下次点击 = false; }, 200);
  } else {
    收起卡片(容器);
  }
  当前滑动卡片 = null;
  滑动起始X = 0;
  当前滑动X = 0;
}

function 收起卡片(容器) {
  if (!容器) return;
  const 卡片 = 容器.querySelector('.备忘录卡片');
  if (卡片) {
    卡片.style.transform = '';
    卡片.style.transition = '';
  }
  容器.classList.remove('展开');
  const 操作栏 = 容器.querySelector('.卡片操作栏');
  if (操作栏) 操作栏.style.opacity = '';
  if (当前展开的卡片容器 === 容器) 当前展开的卡片容器 = null;
}

function 收起所有卡片() {
  if (当前展开的卡片容器) 收起卡片(当前展开的卡片容器);
}

// 暴露给全局
window.初始化卡片滑动 = 初始化卡片滑动;
window._是否发生了滑动 = () => 是否发生了滑动;
window._收起所有卡片 = 收起所有卡片;