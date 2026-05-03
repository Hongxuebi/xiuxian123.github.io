/**
 * 调试日志工具
 * 将关键信息发送到本地调试服务器，便于 AI 协助调试
 */

const DEBUG_SERVER = 'http://localhost:3777';

window.debugLog = function(level, tag, data) {
  // level: 'info' | 'warn' | 'error' | 'debug'
  // tag: 标签（如 'API调用'、'备忘录管理器'）
  // data: 对象或字符串

  const payload = {
    level,
    tag,
    data: typeof data === 'object' ? data : { message: data }
  };

  fetch(`${DEBUG_SERVER}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {
    // 静默失败，不影响应用运行
  });
};

// 便捷方法
window.debugInfo = (tag, data) => debugLog('info', tag, data);
window.debugWarn = (tag, data) => debugLog('warn', tag, data);
window.debugError = (tag, data) => debugLog('error', tag, data);
window.debugDebug = (tag, data) => debugLog('debug', tag, data);

// 在控制台也输出一份
const originalDebugLog = window.debugLog;
window.debugLog = function(level, tag, data) {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `[${timestamp}][${tag}]`;

  if (level === 'error') console.error(prefix, data);
  else if (level === 'warn') console.warn(prefix, data);
  else console.log(prefix, data);

  originalDebugLog(level, tag, data);
};

// ====== 拦截所有 console.log 中转 ======
(function() {
  const _originals = {};
  ['log', 'warn', 'error', 'info', 'debug'].forEach(level => {
    _originals[level] = console[level].bind(console);
    console[level] = function(...args) {
      // 调用原始
      _originals[level].apply(console, args);
      // 发送到debug-server（异步，不阻塞）
      const data = args.map(a => typeof a === 'object' ? JSON.stringify(a).slice(0, 500) : String(a).slice(0, 500)).join(' ');
      fetch(`${DEBUG_SERVER}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level === 'log' ? 'info' : level, tag: 'console', data: { message: data.slice(0, 1000) } })
      }).catch(() => {});
    };
  });
})();

console.log('[调试日志] 工具已加载，服务器地址:', DEBUG_SERVER);
