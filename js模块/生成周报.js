// 生成周报.js - 定期总结分析
// 每周日自动运行：分析过去一周的对话摘要、人物关系变化、知识库更新
// 生成一份结构化周报，写入 📊 周报 文件夹

/**
 * 注册周报定时器（在应用初始化时调用）
 * 每周日 22:00 左右检查，如果当前周还未生成报告则自动执行
 */
window.注册周报定时器 = function() {
  // 每分钟检查一次是否该生成周报
  setInterval(async () => {
    try {
      await 检查并生成周报();
    } catch (e) {
      console.warn('[周报] 检查失败:', e);
    }
  }, 60000); // 每分钟检测
};

/**
 * 检查当前是否该生成周报，是则执行
 */
async function 检查并生成周报() {
  const 现在 = new Date();
  // 只在周日执行（0=周日）
  if (现在.getDay() !== 0) return;
  // 只在 22:00~23:00 之间检查
  if (现在.getHours() < 22 || 现在.getHours() >= 23) return;

  const 最后执行 = localStorage.getItem('周报_最后执行时间');
  const 本周日 = 获取本周日();
  
  // 如果本周已经生成过了，跳过
  if (最后执行 && Number(最后执行) >= 本周日) return;

  console.log('[周报] 开始生成周报...');
  await 生成周报();
  
  localStorage.setItem('周报_最后执行时间', String(Date.now()));
  console.log('[周报] 周报已生成');
}

/**
 * 获取本周日的 00:00 时间戳
 */
function 获取本周日() {
  const 现在 = new Date();
  const 周日 = new Date(现在);
  周日.setDate(现在.getDate() + (7 - 现在.getDay()));
  周日.setHours(0, 0, 0, 0);
  return 周日.getTime();
}

/**
 * 获取当前周的周一 00:00 时间戳
 */
function 获取本周一() {
  const 现在 = new Date();
  const 周一 = new Date(现在);
  周一.setDate(现在.getDate() - 现在.getDay() + 1);
  周一.setHours(0, 0, 0, 0);
  return 周一.getTime();
}

/**
 * 生成结构化周报
 */
async function 生成周报() {
  const manager = window.备忘录管理器;
  if (!manager) return;

  // 确保 📊 周报 文件夹存在
  const 所有文件夹 = window._获取所有文件夹列表?.() || [];
  if (!所有文件夹.some(f => f.名称 === '📊 周报')) {
    window._创建文件夹?.('📊 周报', null);
  }

  const 本周一戳 = 获取本周一();
  const 本周日戳 = 获取本周日();
  const 时间范围开始 = new Date(本周一戳).toISOString();
  const 时间范围结束 = new Date(本周日戳).toISOString();
  const allMemos = await manager.getAllMemos();

  // === 1. 对话概览（统计本周创建的待整理条目） ===
  const 本周待整理 = allMemos.filter(m => 
    m.文件夹 === '📥 待整理' && 
    new Date(m.创建时间).getTime() >= 本周一戳
  );
  
  // === 2. 人物关系（本周有更新的） ===
  const 本周人物 = allMemos.filter(m => 
    m.文件夹 === '📇 人物关系' && 
    new Date(m.更新时间).getTime() >= 本周一戳
  );

  // === 3. 知识库更新（本周新增/更新的） ===
  const 本周知识库 = allMemos.filter(m => 
    m.文件夹 === '📚 知识库' && 
    new Date(m.创建时间).getTime() >= 本周一戳
  );

  // === 4. 新建的备忘录 ===
  const 本周其他备忘录 = allMemos.filter(m => 
    !['📥 待整理', '📇 人物关系', '📚 知识库', '系统', '📊 周报'].includes(m.文件夹) &&
    new Date(m.创建时间).getTime() >= 本周一戳
  );

  // === 5. 构建周报内容 ===
  const 周开始 = new Date(本周一戳).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  const 周结束 = new Date(本周日戳).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  const 生成时间 = new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  let 内容 = `# 📊 周报：${周开始} ~ ${周结束}\n\n`;
  内容 += `*生成时间：${生成时间}*\n\n`;

  // 对话概览
  内容 += `## 一、对话概览\n\n`;
  内容 += `- 本周共记录 **${本周待整理.length}** 条对话摘要\n`;
  if (本周待整理.length > 0) {
    内容 += `- 主要话题：\n`;
    const 话题列表 = 本周待整理.map(m => {
      const 标题 = m.标题 || '';
      return `  - ${标题.replace('[📥] ', '').replace(/ \[\d+轮\]$/, '')}`;
    }).slice(0, 10);
    内容 += 话题列表.join('\n') + '\n';
  }
  内容 += '\n';

  // 人物活跃
  内容 += `## 二、人物关系动态\n\n`;
  if (本周人物.length > 0) {
    for (const p of 本周人物) {
      const 记录行 = (p.内容 || '').split('\n').filter(l => /^- \d\d?/.test(l));
      内容 += `- **${p.标题}** — 本周互动 ${记录行.length} 次\n`;
    }
  } else {
    内容 += `- 本周没有新的人物互动记录\n`;
  }
  内容 += '\n';

  // 知识库
  内容 += `## 三、知识库更新\n\n`;
  if (本周知识库.length > 0) {
    for (const k of 本周知识库) {
      const 标题 = k.标题 || '(无标题)';
      const 标签 = (k.标签 || []).join(', ');
      内容 += `- **${标题}** ${标签 ? '(' + 标签 + ')' : ''}\n`;
    }
  } else {
    内容 += `- 本周没有新的知识库条目\n`;
  }
  内容 += '\n';

  // 其他备忘录
  内容 += `## 四、其他备忘录\n\n`;
  if (本周其他备忘录.length > 0) {
    const 文件夹分组 = {};
    for (const m of 本周其他备忘录) {
      const f = m.文件夹 || '未分类';
      if (!文件夹分组[f]) 文件夹分组[f] = [];
      文件夹分组[f].push(m.标题 || '(无标题)');
    }
    for (const [f, 列表] of Object.entries(文件夹分组)) {
      内容 += `**${f}**（${列表.length}条）：\n`;
      for (const t of 列表.slice(0, 5)) {
        内容 += `  - ${t}\n`;
      }
      if (列表.length > 5) 内容 += `  ...还有 ${列表.length - 5} 条\n`;
    }
  } else {
    内容 += `- 本周没有新建其他备忘录\n`;
  }
  内容 += '\n';

  // 洞察与建议
  内容 += `## 五、洞察与建议\n\n`;
  if (本周待整理.length > 5) {
    内容 += `- 📌 本周有较多对话记录（${本周待整理.length}条），建议花点时间整理到知识库，避免信息流失\n`;
  }
  if (本周人物.length > 0) {
    内容 += `- 👥 本周与 ${本周人物.length} 个人物有互动，可以主动补充他们的详细信息（关系、背景等）\n`;
  }
  if (本周待整理.length === 0 && 本周人物.length === 0 && 本周知识库.length === 0) {
    内容 += `- 💤 本周活跃度较低，是一个安静的一周\n`;
  }
  内容 += `- 📝 周报自动保存在「📊 周报」文件夹中，如需删除或调整，直接操作即可\n`;

  // 写入周报备忘录
  const 标题 = `📊 ${周开始}~${周结束} 周报`;
  
  // 检查是否已有本周周报（避免重复生成）
  const 已有 = allMemos.find(m => m.标题 === 标题 && m.文件夹 === '📊 周报');
  if (已有) {
    await manager.updateMemo(已有.id, { 内容: 内容 });
    console.log('[周报] 已更新本周周报:', 标题);
  } else {
    await manager.createMemo({
      标题: 标题,
      内容: 内容,
      文件夹: '📊 周报',
      标签: ['周报', '总结'],
      创建时间: new Date().toISOString(),
      更新时间: new Date().toISOString()
    });
    console.log('[周报] 已创建周报:', 标题);
  }
}
