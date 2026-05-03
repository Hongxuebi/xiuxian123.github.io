// 对话面板.js - 发送消息、清空对话
window.绑定对话框按钮 = function() {
  const 发送按钮 = document.getElementById('发送消息按钮');
  const 输入框 = document.getElementById('用户输入框');
  console.log('[调试] 绑定对话框按钮，按钮:', !!发送按钮, '输入框:', !!输入框);
  if (发送按钮 && 输入框) {
    发送按钮.addEventListener('click', () => {
      const 内容 = 输入框.value.trim();
      console.log('[调试] 发送按钮点击，内容:', 内容, '发送消息函数:', typeof window.发送消息);
      if (内容 && window.发送消息) window.发送消息(内容);
    });
    输入框.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        console.log('[调试] 回车发送，触发点击');
        发送按钮.click();
      }
    });
  } else {
    console.error('[调试] 绑定失败！按钮:', 发送按钮, '输入框:', 输入框);
  }

  const 清空按钮 = document.getElementById('清空对话按钮');
  if (清空按钮) {
    清空按钮.addEventListener('click', () => {
      if (window.清空当前会话) window.清空当前会话();
    });
  }

  // 上下文占用率按钮
  const 上下文按钮 = document.getElementById('上下文占用率按钮');
  if (上下文按钮) {
    上下文按钮.addEventListener('click', () => {
      if (window.显示压缩对话框) window.显示压缩对话框();
    });
  }
};