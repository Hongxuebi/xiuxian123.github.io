// 抽屉.js - 会话抽屉和备忘录抽屉的控制
let 当前激活面板 = '对话面板';  // 模块变量
window.当前激活面板 = '对话面板'; // 立即暴露到 window，供其他模块初始化时读取

window.绑定抽屉事件 = function() {
  const 会话抽屉 = document.getElementById('会话抽屉');
  const 备忘录抽屉 = document.getElementById('备忘录抽屉');
  const 遮罩 = document.getElementById('抽屉遮罩');
  const 开关 = document.getElementById('抽屉开关');
  if (!会话抽屉 || !备忘录抽屉 || !遮罩 || !开关) return;
  
  function 打开抽屉() {
    会话抽屉.classList.remove('打开');
    备忘录抽屉.classList.remove('打开');
    if (当前激活面板 === '对话面板') {
      会话抽屉.classList.add('打开');
    } else if (当前激活面板 === '备忘录面板') {
      备忘录抽屉.classList.add('打开');
    }
    遮罩.classList.add('显示');
  }
  
  function 关闭抽屉() {
    会话抽屉.classList.remove('打开');
    备忘录抽屉.classList.remove('打开');
    遮罩.classList.remove('显示');
  }
  
  开关.addEventListener('click', 打开抽屉);
  开关.addEventListener('touchend', function(e) {
    e.preventDefault();
    打开抽屉();
  });
  遮罩.addEventListener('click', 关闭抽屉);
  
  // ========== 抽屉拖拽关闭（移动端）==========
  let 拖拽开始X = 0;
  let 抽屉拖动中 = false;
  
  // 获取当前打开的抽屉元素
  function 获取当前抽屉() {
    if (会话抽屉.classList.contains('打开')) return 会话抽屉;
    if (备忘录抽屉.classList.contains('打开')) return 备忘录抽屉;
    return null;
  }
  
  遮罩.addEventListener('touchstart', function(e) {
    拖拽开始X = e.touches[0].clientX;
    抽屉拖动中 = true;
  }, { passive: true });
  
  遮罩.addEventListener('touchmove', function(e) {
    if (!抽屉拖动中) return;
    const 偏移 = e.touches[0].clientX - 拖拽开始X;
    if (偏移 < 0) {
      // 向左滑动（抽屉内容向左滑出屏幕）
      const 抽屉 = 获取当前抽屉();
      if (抽屉) {
        抽屉.style.transform = `translateX(${Math.max(偏移, -250)}px)`;
        抽屉.style.transition = 'none';
        抽屉.style.opacity = Math.max(0, 1 + 偏移 / 250);
      }
    }
  }, { passive: true });
  
  遮罩.addEventListener('touchend', function(e) {
    if (!抽屉拖动中) return;
    抽屉拖动中 = false;
    const 偏移 = e.changedTouches[0].clientX - 拖拽开始X;
    const 抽屉 = 获取当前抽屉();
    if (!抽屉) return;
    
    if (偏移 < -80) {
      // 滑动超过阈值，关闭抽屉
      抽屉.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      抽屉.style.transform = 'translateX(-100%)';
      抽屉.style.opacity = '0';
      setTimeout(() => {
        关闭抽屉();
        抽屉.style.transform = '';
        抽屉.style.opacity = '';
        抽屉.style.transition = '';
      }, 200);
    } else {
      // 未超过阈值，弹回
      抽屉.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      抽屉.style.transform = '';
      抽屉.style.opacity = '';
      setTimeout(() => { 抽屉.style.transition = ''; }, 200);
    }
    拖拽开始X = 0;
  }, { passive: true });
  
  window.关闭抽屉 = 关闭抽屉;
  window.打开抽屉 = 打开抽屉;
};

// 供标签页切换时更新当前激活面板
window.设置当前激活面板 = function(面板ID) {
  当前激活面板 = 面板ID;
  window.当前激活面板 = 面板ID; // 同步到 window，供其他模块读取
  console.log('当前激活面板已更新为:', 面板ID);
};