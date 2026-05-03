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
  遮罩.addEventListener('click', 关闭抽屉);
  
  window.关闭抽屉 = 关闭抽屉;
  window.打开抽屉 = 打开抽屉;
};

// 供标签页切换时更新当前激活面板
window.设置当前激活面板 = function(面板ID) {
  当前激活面板 = 面板ID;
  window.当前激活面板 = 面板ID; // 同步到 window，供其他模块读取
  console.log('当前激活面板已更新为:', 面板ID);
};