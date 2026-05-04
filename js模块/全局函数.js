// 全局函数.js - 杂项全局函数
// 注意：会话相关函数（新建会话、清空对话）在 对话管理.js 中已定义
// 此文件仅保留其他杂项全局函数

window.切换无痕模式 = function() {
  const 标记 = document.getElementById('无痕标记提示');
  if (标记) {
    const 当前 = window.无痕模式激活 || false;
    window.无痕模式激活 = !当前;
    标记.style.display = window.无痕模式激活 ? 'inline-block' : 'none';
    if (window.无痕模式激活) {
      标记.textContent = '无痕模式 · 切换会话后不保留记录';
      alert('已开启无痕模式\n\n⚠️ 切换会话后，当前对话内容不会被保留。\nAI 仍可能从备忘录中记住你的信息。');
    } else {
      标记.textContent = '无痕模式';
      alert('已关闭无痕模式，对话将正常保存');
    }
  }
};

window.一键更新记忆 = window.智能提取记忆 || function() {
  console.warn('[一键更新记忆] 已迁移到智能提取: 请使用 智能提取记忆()');
  return window.智能提取记忆 ? window.智能提取记忆() : Promise.reject(new Error('智能提取未加载'));
};

window.调试检索 = function() {
  if (!window.AI记忆管理器) {
    alert('记忆管理器未初始化');
    return;
  }
  window.AI记忆管理器.queryMemories('').then(结果 => {
    alert('当前记忆库共有 ' + 结果.length + ' 条记忆');
  }).catch(err => {
    console.warn('[调试检索]', err);
  });
};
