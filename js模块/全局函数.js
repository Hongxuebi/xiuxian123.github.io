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
      window._显示提示('无痕模式已开启，对话不保存','info');
    } else {
      标记.textContent = '无痕模式';
      window._显示提示('无痕模式已关闭，对话将正常保存','info');
    }
  }
};

window.一键更新记忆 = window.智能提取记忆 || function() {
  console.warn('[一键更新记忆] 已迁移到智能提取: 请使用 智能提取记忆()');
  return window.智能提取记忆 ? window.智能提取记忆() : Promise.reject(new Error('智能提取未加载'));
};

window.调试检索 = function() {
  if (!window.AI记忆管理器) {
    window._显示提示('记忆管理器未初始化','error');
    return;
  }
  window.AI记忆管理器.queryMemories('').then(结果 => {
    window._显示提示('记忆库共有 ' + 结果.length + ' 条记忆','info');
  }).catch(err => {
    console.warn('[调试检索]', err);
  });
};
