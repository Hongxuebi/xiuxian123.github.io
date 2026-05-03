/**
 * AI日志客户端
 * 用于将应用日志发送到本地调试服务器
 */

class AILogger {
  constructor(serverUrl = 'http://localhost:3888') {
    this.serverUrl = serverUrl;
    this.enabled = false;
    this.checkServer();
  }

  // 检查服务器是否可用
  async checkServer() {
    try {
      const response = await fetch(`${this.serverUrl}/logs`, { method: 'GET' });
      if (response.ok) {
        this.enabled = true;
        console.log('[AILogger] ✅ 已连接到调试服务器');
      }
    } catch (err) {
      console.log('[AILogger] ⚠️ 调试服务器未启动，日志仅输出到控制台');
    }
  }

  // 发送日志到服务器
  async log(level, message, data = null) {
    // 始终输出到控制台
    const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
    console[consoleMethod](`[${level}] ${message}`, data || '');

    // 如果服务器可用，发送到服务器
    if (!this.enabled) {
      try {
        await fetch(`${this.serverUrl}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level, message, data })
        });
      } catch (err) {
        // 静默失败
      }
    }
  }

  info(message, data) { return this.log('INFO', message, data); }
  warn(message, data) { return this.log('WARN', message, data); }
  error(message, data) { return this.log('ERROR', message, data); }
  debug(message, data) { return this.log('DEBUG', message, data); }
}

// 创建全局实例
window.aiLogger = new AILogger();

// 便捷方法
window.aiLog = (message, data) => window.aiLogger.info(message, data);
window.aiWarn = (message, data) => window.aiLogger.warn(message, data);
window.aiError = (message, data) => window.aiLogger.error(message, data);
