// 更多菜单.js - 对话面板的更多菜单（无痕、调试）
window.绑定更多菜单 = function() {
  const 更多按钮 = document.getElementById('更多按钮');
  const 下拉菜单 = document.querySelector('.更多菜单 .下拉内容');
  if (更多按钮 && 下拉菜单) {
    更多按钮.addEventListener('click', (e) => {
      e.stopPropagation();
      下拉菜单.classList.toggle('显示');
    });
    document.addEventListener('click', () => 下拉菜单.classList.remove('显示'));
  }
  
  const 无痕按钮 = document.getElementById('无痕会话按钮');
  if (无痕按钮) {
    无痕按钮.addEventListener('click', () => {
      if (window.切换无痕模式) window.切换无痕模式();
      // else alert('无痕模式功能开发中'); // 全局函数.js 已定义 window.切换无痕模式
    });
  }
  
  const 调试按钮 = document.getElementById('检索测试按钮');
  if (调试按钮) {
    调试按钮.addEventListener('click', () => {
      if (window.调试检索) window.调试检索();
      // else alert('调试检索功能开发中'); // 全局函数.js 已定义 window.调试检索
    });
  }
};