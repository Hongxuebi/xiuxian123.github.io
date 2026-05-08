// 设置管理.js - 全局配置管理、持久化存储

// 预设主题配置（不可删除）
const 预设主题 = {
  '清爽白': { 主色: '#2c3e50', 强调色: '#3b82f6', 背景色: '#f0f2f5', 内容底色: '#ffffff', 文字主色: '#111827', 文字辅色: '#667085', 边框色: '#e5e7eb', 成功色: '#27ae60', 警告色: '#f59e0b', 错误色: '#ef4444', 暖灰色: '#f3f4f6', 助理消息背景: '#e9e9eb', 助理消息文字: '#111827', 用户消息背景: '#3b82f6', 用户消息文字: '#ffffff' },
  '浅海蓝': { 主色: '#1e3a5f', 强调色: '#3b82f6', 背景色: '#f0f7ff', 内容底色: '#ffffff', 文字主色: '#111827', 文字辅色: '#667085', 边框色: '#dbeafe', 成功色: '#27ae60', 警告色: '#f59e0b', 错误色: '#ef4444', 暖灰色: '#f3f4f6', 助理消息背景: '#e0eaff', 助理消息文字: '#111827', 用户消息背景: '#3b82f6', 用户消息文字: '#ffffff' },
  '草木绿': { 主色: '#166534', 强调色: '#22c55e', 背景色: '#f0fdf4', 内容底色: '#ffffff', 文字主色: '#111827', 文字辅色: '#667085', 边框色: '#dcfce7', 成功色: '#27ae60', 警告色: '#f59e0b', 错误色: '#ef4444', 暖灰色: '#f3f4f6', 助理消息背景: '#dcfce7', 助理消息文字: '#111827', 用户消息背景: '#22c55e', 用户消息文字: '#ffffff' },
  '暖米橙': { 主色: '#78350f', 强调色: '#f59e0b', 背景色: '#fef9ef', 内容底色: '#fffbf5', 文字主色: '#292524', 文字辅色: '#78716c', 边框色: '#fde68a', 成功色: '#27ae60', 警告色: '#f59e0b', 错误色: '#ef4444', 暖灰色: '#f5f5f4', 助理消息背景: '#fef3c7', 助理消息文字: '#292524', 用户消息背景: '#f59e0b', 用户消息文字: '#ffffff' },
  '东方美学': { 主色: '#4a6a6f', 强调色: '#b95f49', 背景色: '#ede0c8', 内容底色: '#f8f5e6', 文字主色: '#3a4a4f', 文字辅色: '#6a5a4f', 边框色: '#d6c8a7', 成功色: '#27ae60', 警告色: '#f39c12', 错误色: '#e74c3c', 暖灰色: '#f0ebe0', 助理消息背景: '#e8dfc8', 助理消息文字: '#3a4a4f', 用户消息背景: '#b95f49', 用户消息文字: '#fef9e6' },
  '深色夜': { 主色: '#e2e8f0', 强调色: '#3b82f6', 背景色: '#1f2937', 内容底色: '#111827', 文字主色: '#f9fafb', 文字辅色: '#9ca3af', 边框色: '#374151', 成功色: '#27ae60', 警告色: '#f59e0b', 错误色: '#ef4444', 暖灰色: '#374151', 助理消息背景: '#374151', 助理消息文字: '#f9fafb', 用户消息背景: '#2563eb', 用户消息文字: '#ffffff' },
  '渐变幻境': { 主色: '#4c1d95', 强调色: '#667eea', 背景色: '#667eea', 内容底色: 'rgba(255,255,255,0.95)', 文字主色: '#1f2937', 文字辅色: '#6b7280', 边框色: '#e5e7eb', 成功色: '#27ae60', 警告色: '#f59e0b', 错误色: '#ef4444', 暖灰色: '#f3f4f6', 助理消息背景: '#e5e7eb', 助理消息文字: '#1f2937', 用户消息背景: '#667eea', 用户消息文字: '#ffffff' },
};

// 主题配置（运行时合并预设 + 用户创建）
window.主题配置 = { ...预设主题 };

// 加载用户创建的主题
function 加载用户主题() {
  try {
    const 用户主题JSON = localStorage.getItem('user_themes');
    if (用户主题JSON) {
      const 用户主题 = JSON.parse(用户主题JSON);
      Object.assign(window.主题配置, 用户主题);
      console.log('已加载用户主题：', Object.keys(用户主题));
    }
  } catch (错误) {
    console.error('加载用户主题失败', 错误);
  }
}

// 保存用户创建的主题
window.保存用户主题 = function(名称, 配置) {
  if (!名称 || !配置) return false;
  
  // 不允许覆盖预设主题
  if (预设主题[名称]) {
    console.warn('不能覆盖预设主题');
    return false;
  }
  
  // 保存到主题配置
  window.主题配置[名称] = 配置;
  
  // 持久化到 localStorage
  const 用户主题JSON = localStorage.getItem('user_themes');
  let 用户主题 = {};
  try {
    用户主题 = 用户主题JSON ? JSON.parse(用户主题JSON) : {};
  } catch (e) {}
  
  用户主题[名称] = 配置;
  localStorage.setItem('user_themes', JSON.stringify(用户主题));
  
  console.log('✅ 已保存用户主题：', 名称);
  return true;
};

// 删除用户创建的主题
window.删除用户主题 = function(名称) {
  // 不允许删除预设主题
  if (预设主题[名称]) {
    console.warn('不能删除预设主题');
    return false;
  }
  
  // 从运行时配置删除
  delete window.主题配置[名称];
  
  // 从 localStorage 删除
  const 用户主题JSON = localStorage.getItem('user_themes');
  if (用户主题JSON) {
    try {
      const 用户主题 = JSON.parse(用户主题JSON);
      delete 用户主题[名称];
      localStorage.setItem('user_themes', JSON.stringify(用户主题));
    } catch (e) {}
  }
  
  console.log('🗑️ 已删除用户主题：', 名称);
  return true;
};

// 判断是否为预设主题
window.是否预设主题 = function(名称) {
  return !!预设主题[名称];
};

// ========== 人物关系映射表 ==========

/**
 * 获取用户自定义的关系映射（从 localStorage）
 * 格式：{ '老婆':'👨‍👩‍👧‍👦 亲属', '导师':'🎓 师长', ... }
 */
window.获取用户关系映射 = function() {
  try {
    const json = localStorage.getItem('user_relation_mapping');
    return json ? JSON.parse(json) : {};
  } catch { return {}; }
};

/**
 * 保存用户自定义的关系映射
 * @param {Object} 映射 - { 关系词: 类别 }
 */
window.保存用户关系映射 = function(映射) {
  try {
    localStorage.setItem('user_relation_mapping', JSON.stringify(映射));
    return true;
  } catch { return false; }
};

window.全局设置 = {
  API密钥: localStorage.getItem('deepseek_api_key') || '',
  百度搜索密钥: localStorage.getItem('baidu_search_key') || '',
  模型版本: 'deepseek-chat',
  最大token数: 4096,
  启用函数调用: true,
  最大工具调用轮次: 15,
  启用预检索: true,
  预检索最大条数: 5,
  当前主题: localStorage.getItem('current_theme') || '默认主题'
};

function 保存设置() {
  try {
    localStorage.setItem('deepseek_api_key', btoa(window.全局设置.API密钥 || ''));
    localStorage.setItem('baidu_search_key', btoa(window.全局设置.百度搜索密钥 || ''));
    localStorage.setItem('current_theme', window.全局设置.当前主题);
    console.log('设置已保存');
  } catch (错误) { console.error('保存设置失败', 错误); }
}

function 加载设置() {
  try {
    const 保存的密钥 = localStorage.getItem('deepseek_api_key');
    if (保存的密钥) try { window.全局设置.API密钥 = atob(保存的密钥); } catch { window.全局设置.API密钥 = 保存的密钥; }
    const 保存的百度密钥 = localStorage.getItem('baidu_search_key');
    if (保存的百度密钥) try { window.全局设置.百度搜索密钥 = atob(保存的百度密钥); } catch { window.全局设置.百度搜索密钥 = 保存的百度密钥; }
    const 保存的主题 = localStorage.getItem('current_theme');
    if (保存的主题) window.全局设置.当前主题 = 保存的主题;
    
    // 加载用户创建的主题
    加载用户主题();
    
    console.log('设置已加载');
  } catch (错误) { console.error('加载设置失败', 错误); }
}

function 切换主题(主题名称) {
  const 配置 = window.主题配置[主题名称];
  if (!配置) {
    console.error('主题不存在：', 主题名称);
    return;
  }
  
  window.全局设置.当前主题 = 主题名称;
  document.body.className = `主题-${主题名称}`;
  
  // 应用配色到 CSS 变量
  const root = document.documentElement;
  root.style.setProperty('--主色', 配置.主色);
  root.style.setProperty('--强调色', 配置.强调色);
  root.style.setProperty('--背景色', 配置.背景色);
  root.style.setProperty('--内容底色', 配置.内容底色);
  root.style.setProperty('--文字主色', 配置.文字主色);
  root.style.setProperty('--文字辅色', 配置.文字辅色);
  root.style.setProperty('--边框色', 配置.边框色);
  root.style.setProperty('--成功色', 配置.成功色);
  root.style.setProperty('--警告色', 配置.警告色);
  root.style.setProperty('--错误色', 配置.错误色);
  root.style.setProperty('--暖灰色', 配置.暖灰色);
  root.style.setProperty('--用户消息背景', 配置.用户消息背景);
  root.style.setProperty('--用户消息文字', 配置.用户消息文字);
  root.style.setProperty('--助理消息背景', 配置.助理消息背景);
  root.style.setProperty('--助理消息文字', 配置.助理消息文字);
  
  // 主题切换计数
  const 主题计数 = parseInt(localStorage.getItem('_主题切换计数') || '0');
  localStorage.setItem('_主题切换计数', 主题计数 + 1);
  
  保存设置();
}

加载设置();
window.保存设置 = 保存设置;
window.加载设置 = 加载设置;
window.切换主题 = 切换主题;

document.addEventListener('DOMContentLoaded', () => 切换主题(window.全局设置.当前主题));

window.校验并保存API密钥 = function(密钥输入框, 百度密钥输入框) {
  let 密钥 = 密钥输入框.value.trim();
  if (密钥 && !密钥.startsWith('sk-')) {
    window._显示提示('DeepSeek密钥格式错误，应以 sk- 开头','error');
    return false;
  }
  window.全局设置.API密钥 = 密钥;
  
  // 保存百度搜索密钥
  if (百度密钥输入框) {
    window.全局设置.百度搜索密钥 = 百度密钥输入框.value.trim();
  }
  
  window.保存设置();
  const 状态 = [];
  if (密钥) 状态.push('DeepSeek密钥已保存');
  if (window.全局设置.百度搜索密钥) 状态.push('百度搜索密钥已保存');
  window._显示提示('设置已保存','success');
  return true;
};