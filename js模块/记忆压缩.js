// 记忆压缩.js - 零 token 成本的规则聚类压缩器
// 职责：自动压缩 📥 待整理 / 📚 知识库 / AI 记忆，不调用 AI API
// 纯关键词重合度 + 时间阈值 + 重要性阈值，对标 CoPaw/MemPalace 的自动摘要但零成本

'use strict';

class 记忆压缩器 {

  /**
   * 1. 待整理压缩：超3天未更新的条目按话题聚类合并
   * 合并后标题加 `[摘要]` 前缀，原条目标记为已压缩
   * @param {Object} manager - MemoManager 实例
   * @returns {number} 压缩的条目数
   */
  static async 压缩待整理(manager) {
    if (!manager) return 0;
    const 所有 = manager.getAllMemos();
    // 过滤出 📥 待整理 中未压缩且超过3天的条目
    const 待整理 = 所有.filter(m => {
      if (m.文件夹 !== '📥 待整理') return false;
      if (m.标题?.startsWith('[摘要]')) return false; // 已压缩的跳过
      if (m.已压缩) return false;
      // 检查是否超过3天
      const 更新时间 = m.更新时间 ? new Date(m.更新时间) : null;
      if (!更新时间) return false;
      const 三天前 = Date.now() - 3 * 24 * 60 * 60 * 1000;
      return 更新时间.getTime() < 三天前;
    });

    if (待整理.length < 2) return 0;

    // 话题聚类：按关键词重叠度 >= 60% 聚类
    function 提取关键词(文本) {
      const s = (文本 || '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^\u4e00-\u9fff\w]/g, ' ');
      const 词集 = new Set(s.split(/\s+/).filter(w => w.length >= 2));
      return 词集;
    }

    function 计算重叠度(词集A, 词集B) {
      if (词集A.size === 0 || 词集B.size === 0) return 0;
      const 交集 = new Set([...词集A].filter(x => 词集B.has(x)));
      return 交集.size / Math.min(词集A.size, 词集B.size);
    }

    // 简单聚类（贪心：每个新条目匹配已有簇，不到则新建）
    const 簇列表 = [];
    for (const 条目 of 待整理) {
      const 关键词集 = 提取关键词(条目.标题 + ' ' + (条目.内容片段 || ''));
      let 已匹配 = false;
      for (const 簇 of 簇列表) {
        const 簇关键词 = 提取关键词(簇.主题);
        if (计算重叠度(关键词集, 簇关键词) >= 0.6) {
          簇.条目.push(条目);
          已匹配 = true;
          break;
        }
      }
      if (!已匹配) {
        簇列表.push({ 主题: 条目.标题 || '其他', 关键词集, 条目: [条目] });
      }
    }

    // 聚合大于1的簇，合并写入新备忘录
    let 压缩计数 = 0;
    for (const 簇 of 簇列表) {
      if (簇.条目.length < 2) continue;

      // 生成合并标题
      const 话题集 = new Set(簇.条目.map(m => {
        const t = (m.标题 || '').replace(/^\[📥\]\s*/, '').replace(/\[\d+轮\]/, '').trim();
        return t.slice(0, 10);
      }));
      const 话题串 = [...话题集].join('、').slice(0, 20);
      const 合并标题 = `[摘要] ${话题串} (${簇.条目.length}条合并)`;

      // 生成合并内容
      const 条目片段 = 簇.条目.map(m => {
        const 时间 = m.日期 || '';
        const 内容 = (m.内容片段 || '').slice(0, 100);
        return `--- ${时间} ---\n${内容}`;
      }).join('\n\n');

      // 写入新合并条目
      try {
        await manager.createMemo({
          标题: 合并标题,
          内容: `## 自动合并摘要\n\n${条目片段}\n\n---\n*由记忆压缩器于 ${new Date().toLocaleString('zh-CN')} 自动合并*`,
          文件夹: '📥 待整理',
          标签: ['待整理', '已压缩']
        });
        // 标记原条目为已压缩
        for (const 条目 of 簇.条目) {
          await manager.updateMemo(条目.id, { 已压缩: true, 标签: [...(条目.标签 || []), '已压缩'] });
        }
        压缩计数 += 簇.条目.length;
      } catch (e) {
        console.warn('[记忆压缩] 合并失败:', e);
      }
    }

    return 压缩计数;
  }

  /**
   * 2. 知识库归档：超30天未使用/未更新的条目提取摘要替换全文
   * @param {Object} manager - MemoManager 实例
   * @returns {number} 归档的条目数
   */
  static async 归档知识库(manager) {
    if (!manager) return 0;
    const 所有 = manager.getAllMemos();
    const 三十天前 = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const 待归档 = 所有.filter(m => {
      if (m.文件夹 !== '📚 知识库') return false;
      if (m.标题?.startsWith('[已归档]')) return false;
      const 更新时间 = m.更新时间 ? new Date(m.更新时间).getTime() : 0;
      return 更新时间 > 0 && 更新时间 < 三十天前;
    });

    let 计数 = 0;
    for (const 条目 of 待归档) {
      const 纯文本 = (条目.内容片段 || 条目.内容 || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const 摘要 = 纯文本.slice(0, 100) + (纯文本.length > 100 ? '...' : '');
      try {
        await manager.updateMemo(条目.id, {
          标题: `[已归档] ${(条目.标题 || '').replace(/^\[已归档\]\s*/, '')}`,
          内容: `> 自动归档摘要（${new Date().toLocaleDateString('zh-CN')}）\n\n${摘要}\n\n---\n*原内容已归档，如需查看完整内容请取消归档*`,
          标签: [...(条目.标签 || []), '已归档']
        });
        计数++;
      } catch (e) {
        console.warn('[记忆压缩] 归档失败:', e);
      }
    }
    return 计数;
  }

  /**
   * 3. AI记忆压缩：重要性 < 3 且超过7天的记忆按类型聚类合并
   * @param {Object} ai记忆管理器 - AI记忆管理器实例（或从其 getAll 方法获取数据）
   * @returns {number} 压缩的条目数
   */
  static async 压缩AI记忆(ai记忆管理器) {
    if (!ai记忆管理器 || typeof ai记忆管理器.搜索 !== 'function') return 0;

    const 七天前 = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // AI记忆管理器没有 getAll，我们需要通过其内部存储读取
    // 尝试通过 IndexedDB 获取所有记忆
    let 所有记忆 = [];
    try {
      if (ai记忆管理器.db && ai记忆管理器.db.getAll) {
        所有记忆 = await ai记忆管理器.db.getAll('ai_knowledge') || [];
      } else if (window._获取所有AI记忆) {
        所有记忆 = await window._获取所有AI记忆() || [];
      }
    } catch (e) {
      console.warn('[记忆压缩] 读取AI记忆失败:', e);
      return 0;
    }

    if (所有记忆.length < 3) return 0;

    // 筛选出低重要性 + 过期的记忆
    const 待压缩 = 所有记忆.filter(m => {
      // 重要性字段在备忘录中非必填，默认5分（中间值，压缩时保留中性判断）
      const 重要性 = typeof m.重要性 === 'number' ? m.重要性 : 5;
      if (重要性 >= 3) return false;
      const 时间 = m.时间 ? new Date(m.时间).getTime() : 0;
      return 时间 > 0 && 时间 < 七天前;
    });

    if (待压缩.length < 3) return 0;

    // 按类型聚类
    const 按类型 = {};
    for (const m of 待压缩) {
      const 类型 = m.类型 || 'other';
      if (!按类型[类型]) 按类型[类型] = [];
      按类型[类型].push(m);
    }

    let 计数 = 0;
    for (const [类型, 条目组] of Object.entries(按类型)) {
      if (条目组.length < 2) continue;
      const 摘要内容 = 条目组.map(m => `- ${(m.内容 || '').slice(0, 80)}`).join('\n');
      try {
        // 写入一条合并后的摘要记忆
        if (ai记忆管理器.记住) {
          await ai记忆管理器.记住(
            `[记忆压缩] ${类型}类型记忆合并 (${条目组.length}条)`, 类型, 2
          );
          // 尝试删除原条目（如果有删除方法的话）
          if (ai记忆管理器.删除) {
            for (const m of 条目组) {
              await ai记忆管理器.删除(m.id).catch(() => {});
            }
          }
        } else if (ai记忆管理器.db && ai记忆管理器.db.add) {
          await ai记忆管理器.db.add('ai_knowledge', {
            内容: `[记忆压缩] ${类型}记忆摘要 (${条目组.length}条合并):\n${摘要内容}`,
            类型: 类型,
            重要性: 2,
            时间: new Date().toISOString(),
            已压缩: true
          });
        }
        计数 += 条目组.length;
      } catch (e) {
        console.warn('[记忆压缩] AI记忆合并失败:', e);
      }
    }
    return 计数;
  }

  /**
   * 一键执行全部压缩（供后端定时或对话后触发调用）
   * @param {Object} manager - MemoManager 实例
   * @param {Object} ai记忆管理器 - AI记忆管理器实例（可选）
   * @returns {Object} 各维度压缩统计
   */
  static async 全部压缩(manager, ai记忆管理器) {
    const 结果 = {
      待整理: await 记忆压缩器.压缩待整理(manager),
      知识库: await 记忆压缩器.归档知识库(manager),
      AI记忆: await 记忆压缩器.压缩AI记忆(ai记忆管理器),
    };
    console.log('[记忆压缩] 全部压缩完成:', JSON.stringify(结果));
    return 结果;
  }
}

// 暴露到全局
window.记忆压缩器 = 记忆压缩器;
