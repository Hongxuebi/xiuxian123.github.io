// [Phase D 标注] 记忆常量 - L0-L3 分层定义（架构预留，当前未使用）
// 保留原因：未来可能启用分层记忆架构，当前不影响运行

﻿// 记忆常量.js
const MEMORY_LEVELS = {
  SHORT_TERM: 'short_term',
  MID_TERM: 'mid_term',
  LONG_TERM: 'long_term'
};

const MEMORY_CATEGORIES = {
  PERSONAL: '个人信息',
  KNOWLEDGE: '知识',
  PREFERENCE: '偏好',
  WORK: '工作',
  HEALTH: '健康',
  LIFE: '生活',
  OTHER: '其他'
};

window.MEMORY_LEVELS = MEMORY_LEVELS;
window.MEMORY_CATEGORIES = MEMORY_CATEGORIES;