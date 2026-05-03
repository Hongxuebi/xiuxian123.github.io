// 备忘录数据.js - 数据存储和核心操作

// 全局备忘录数据
let 备忘录数据 = [
  {
    id: 1,
    标题: '项目开发计划',
    内容: '1. 完成备忘录管理功能\n2. 实现记忆管理功能\n3. 开发鸿蒙原生层',
    日期: '2026-04-09',
    文件夹: '默认',
    标签: ['工作', '计划'],
    收藏: true,
    创建时间: '2026-04-09T10:00:00',
    更新时间: '2026-04-09T10:30:00'
  },
  {
    id: 2,
    标题: '购物清单',
    内容: '牛奶、鸡蛋、面包、蔬菜、水果',
    日期: '2026-04-08',
    文件夹: '个人',
    标签: ['生活', '购物'],
    收藏: false,
    创建时间: '2026-04-08T15:00:00',
    更新时间: '2026-04-08T15:30:00'
  },
  {
    id: 3,
    标题: '学习笔记',
    内容: 'JavaScript高级编程技巧\nReact Hooks使用心得',
    日期: '2026-04-07',
    文件夹: '学习',
    标签: ['学习', '编程'],
    收藏: true,
    创建时间: '2026-04-07T09:00:00',
    更新时间: '2026-04-07T10:00:00'
  }
];

// 当前状态
let 当前文件夹 = '全部';
let 当前搜索关键词 = '';
let 当前筛选 = 'all';   // 'all', 'favorite', 'deleted'

// 获取所有文件夹列表及其计数
function 获取所有文件夹列表() {
  const 数据源 = window._备忘录数据源 || 备忘录数据;
  const 文件夹计数 = new Map();
  数据源.forEach(备忘录 => {
    const 文件夹名 = 备忘录.文件夹 || '未分类';
    文件夹计数.set(文件夹名, (文件夹计数.get(文件夹名) || 0) + 1);
  });
  const 列表 = [{ 名称: '全部', 计数: 数据源.length }];
  for (let [名称, 计数] of 文件夹计数) {
    列表.push({ 名称, 计数 });
  }
  return 列表;
}

// 切换收藏状态
function 切换收藏(id) {
  // 优先使用 MemoManager
  if (window.备忘录管理器) {
    const 备忘录 = window.备忘录管理器.getMemo(id);
    if (备忘录) {
      const 新状态 = !备忘录.收藏;
      window.备忘录管理器.updateMemo(id, { 收藏: 新状态 }).then(() => {
        console.log('[切换收藏] 已更新到 IndexedDB');
        // 强制同步内存缓存
        const 缓存项 = 备忘录数据.find(m => m.id === id);
        if (缓存项) 缓存项.收藏 = 新状态;
        if (window.渲染备忘录列表) window.渲染备忘录列表();
      }).catch(err => {
        console.error('[切换收藏] 更新失败', err);
      });
    }
    return;
  }
  
  // 降级：使用内存存储
  const 备忘录 = 备忘录数据.find(m => m.id === id);
  if (备忘录) {
    备忘录.收藏 = !备忘录.收藏;
    if (window.渲染备忘录列表) window.渲染备忘录列表();
  }
}

// 删除备忘录
function 删除备忘录(id) {
  if (confirm('确定要删除这条备忘录吗？')) {
    // 优先使用 MemoManager
    if (window.备忘录管理器) {
      window.备忘录管理器.deleteMemo(id).then(() => {
        console.log('[删除备忘录] 已从 IndexedDB 删除');
        if (window.渲染文件夹树) window.渲染文件夹树();
        if (window.渲染备忘录列表) window.渲染备忘录列表();
      }).catch(err => {
        console.error('[删除备忘录] 删除失败', err);
      });
      return;
    }
    
    // 降级：使用内存存储
    备忘录数据 = 备忘录数据.filter(m => m.id !== id);
    if (window.渲染文件夹树) window.渲染文件夹树();
    if (window.渲染备忘录列表) window.渲染备忘录列表();
  }
}

// 动态获取备忘录数据：优先从备忘录管理器读取，否则用内存数据
window._备忘录数据 = 备忘录数据;

// 重写 getter：确保渲染时拿到正确数据
Object.defineProperty(window, '_备忘录数据源', {
  get() {
    // 优先使用备忘录管理器的数据（IndexedDB 持久化）
    if (window.备忘录管理器 && window.备忘录管理器.memos) {
      return window.备忘录管理器.memos;
    }
    // 降级：使用内存静态数据
    return 备忘录数据;
  }
});
// ========== 文件夹层级管理系统 ==========
// 文件夹结构：{名称, 父文件夹, 创建时间}
let 文件夹结构 = JSON.parse(localStorage.getItem('memo_folder_structure') || '[]');

// 系统内置文件夹（永久存在，不会被移除）
const 系统内置文件夹 = ['📥 待整理', '📚 知识库', '系统', '已归档'];

// 初始化默认文件夹结构（如果没有）
function 初始化文件夹结构() {
  // 从现有备忘录中提取所有文件夹
  const 数据源 = window._备忘录数据源 || 备忘录数据;
  const 文件夹名集 = new Set(数据源.map(m => m.文件夹 || '未分类'))
  
  // 同步：确保备忘录中的文件夹都在结构中
  let 有新增 = false;
  
  // 先确保所有系统内置文件夹存在
  系统内置文件夹.forEach(名称 => {
    const 已存在 = 文件夹结构.some(f => f.名称 === 名称 && f.父文件夹 === null);
    if (!已存在) {
      文件夹结构.push({
        名称,
        父文件夹: null,
        创建时间: new Date().toISOString()
      });
      有新增 = true;
    }
  });
  
  // 再同步用户文件夹
  文件夹名集.forEach(名称 => {
    // 跳过系统内置文件夹（已经创建了）
    if (系统内置文件夹.includes(名称)) return;
    const 已存在 = 文件夹结构.some(f => f.名称 === 名称 && f.父文件夹 === null);
    if (!已存在) {
      文件夹结构.push({
        名称,
        父文件夹: null,
        创建时间: new Date().toISOString()
      });
      有新增 = true;
    }
  });
  
  if (有新增 || 文件夹结构.length === 0) {
    保存文件夹结构();
  }
}

// 保存文件夹结构到 localStorage
function 保存文件夹结构() {
  localStorage.setItem('memo_folder_structure', JSON.stringify(文件夹结构));
}

// 创建新文件夹
function 创建文件夹(名称, 父文件夹 = null) {
  if (!名称 || 名称.trim() === '') return false;
  名称 = 名称.trim();
  
  // 检查是否已存在（同级）
  const 已存在 = 文件夹结构.some(f => f.名称 === 名称 && f.父文件夹 === 父文件夹);
  if (已存在) return false;
  
  文件夹结构.push({
    名称,
    父文件夹,
    创建时间: new Date().toISOString()
  });
  保存文件夹结构();
  return true;
}

// 获取文件夹的子文件夹
function 获取子文件夹(父文件夹名称) {
  return 文件夹结构.filter(f => f.父文件夹 === 父文件夹名称);
}

// 获取所有顶层文件夹（没有父文件夹的）
function 获取顶层文件夹() {
  return 文件夹结构.filter(f => f.父文件夹 === null);
}

// 获取文件夹树结构（用于渲染）
function 获取文件夹树() {
  const 数据源 = window._备忘录数据源 || 备忘录数据;
  
  function 递归计数(文件夹名) {
    // 排除已软删除的备忘录（deleteMemo 是软删除）
    const 有效数据 = 数据源.filter(m => !m.已删除);
    // 直接归属该文件夹的备忘录数
    const 直接计数 = 有效数据.filter(m => m.文件夹 === 文件夹名).length;
    // 子文件夹的备忘录数（递归累加）
    const 子文件夹列表 = 文件夹结构.filter(f => f.父文件夹 === 文件夹名);
    const 子计数 = 子文件夹列表.reduce((sum, 子) => sum + 递归计数(子.名称), 0);
    return 直接计数 + 子计数;
  }
  
  function 构建树(父文件夹) {
    const 子文件夹 = 文件夹结构.filter(f => f.父文件夹 === 父文件夹);
    return 子文件夹.map(文件夹 => {
      return {
        ...文件夹,
        计数: 递归计数(文件夹.名称),
        子文件夹: 构建树(文件夹.名称)
      };
    });
  }
  
  return 构建树(null);
}

// 获取所有文件夹列表（兼容旧接口，但使用新结构）
function 获取所有文件夹列表新() {
  const 数据源 = window._备忘录数据源 || 备忘录数据;
  const 树 = 获取文件夹树();
  
  // 扁平化树结构
  function 扁平化(节点列表, 结果 = []) {
    节点列表.forEach(节点 => {
      const 子计数 = 数据源.filter(m => {
        // 检查是否在该文件夹或其子文件夹中
        const 文件夹列表 = [节点.名称, ...获取所有子文件夹名(节点.名称)];
        return 文件夹列表.includes(m.文件夹);
      }).length;
      
      结果.push({
        名称: 节点.名称,
        计数: 子计数,
        父文件夹: 节点.父文件夹,
        有子文件夹: 节点.子文件夹 && 节点.子文件夹.length > 0
      });
      if (节点.子文件夹 && 节点.子文件夹.length > 0) {
        扁平化(节点.子文件夹, 结果);
      }
    });
    return 结果;
  }
  
  const 全部计数 = 数据源.length;
  const 文件夹列表 = [{ 名称: '全部', 计数: 全部计数 }];
  return 文件夹列表.concat(扁平化(树));
}

// 辅助：获取所有子文件夹名称（递归）

function 获取所有子文件夹名(父文件夹名) {
  const 结果 = [];
  const 直接子文件夹 = 文件夹结构.filter(f => f.父文件夹 === 父文件夹名);
  直接子文件夹.forEach(子 => {
    结果.push(子.名称);
    结果.push(...获取所有子文件夹名(子.名称));
  });
  return 结果;
}

// 获取文件夹的父文件夹
function 获取文件夹的父文件夹(文件夹名) {
  const 文件夹 = 文件夹结构.find(f => f.名称 === 文件夹名);
  return 文件夹 ? 文件夹.父文件夹 : null;
}

// 移动文件夹到新的父文件夹
function 移动文件夹(文件夹名, 新父文件夹) {
  // 不能移动到自己
  if (新父文件夹 === 文件夹名) return false;
  
  // 不能移动到自己的子文件夹中
  const 子文件夹列表 = 获取所有子文件夹名(文件夹名);
  if (子文件夹列表.includes(新父文件夹)) return false;
  
  const 文件夹 = 文件夹结构.find(f => f.名称 === 文件夹名);
  if (!文件夹) return false;
  
  // 检查目标位置是否已有同名文件夹
  if (新父文件夹 !== null) {
    const 目标位置有同名 = 文件夹结构.some(f => f.名称 === 文件夹名 && f.父文件夹 === 新父文件夹);
    if (目标位置有同名) return false;
  } else {
    // 移动到顶层
    const 顶层有同名 = 文件夹结构.some(f => f.名称 === 文件夹名 && f.父文件夹 === null);
    if (顶层有同名) return false;
  }
  
  文件夹.父文件夹 = 新父文件夹;
  保存文件夹结构();
  return true;
}

// 重命名文件夹
function 重命名文件夹(原名称, 新名称) {
  if (!新名称 || 新名称.trim() === '') return false;
  新名称 = 新名称.trim();
  
  if (原名称 === 新名称) return true;
  
  const 文件夹 = 文件夹结构.find(f => f.名称 === 原名称);
  if (!文件夹) return false;
  
  // 检查同级是否已有同名文件夹
  const 父文件夹 = 文件夹.父文件夹;
  const 同级有同名 = 文件夹结构.some(f => f.名称 === 新名称 && f.父文件夹 === 父文件夹 && f.名称 !== 原名称);
  if (同级有同名) return false;
  
  // 更新文件夹结构中的名称
  文件夹.名称 = 新名称;
  
  // 更新所有子文件夹的父文件夹引用
  文件夹结构.forEach(f => {
    if (f.父文件夹 === 原名称) {
      f.父文件夹 = 新名称;
    }
  });
  
  // 更新所有备忘录的文件夹字段
  const 数据源 = window._备忘录数据源 || 备忘录数据;
  数据源.forEach(备忘录 => {
    if (备忘录.文件夹 === 原名称) {
      备忘录.文件夹 = 新名称;
    }
  });
  
  // 同步到 IndexedDB
  if (window.备忘录管理器) {
    数据源.forEach(备忘录 => {
      if (备忘录.文件夹 === 新名称) {
        window.备忘录管理器.updateMemo(备忘录.id, { 文件夹: 新名称 }).catch(console.error);
      }
    });
  }
  
  保存文件夹结构();
  return true;
}

// 删除文件夹及其子文件夹，将其中备忘录移入回收站
function 删除文件夹(文件夹名) {
  // 获取该文件夹及其所有子文件夹
  const 子文件夹列表 = 获取所有子文件夹名(文件夹名);
  const 要删除的文件夹列表 = [文件夹名, ...子文件夹列表];
  
  // 从文件夹结构中删除
  文件夹结构 = 文件夹结构.filter(f => !要删除的文件夹列表.includes(f.名称));
  保存文件夹结构();
  
  // 将该文件夹及其子文件夹中的所有备忘录移入回收站（软删除）
  const 数据源 = window._备忘录数据源 || 备忘录数据;
  数据源.forEach(备忘录 => {
    if (要删除的文件夹列表.includes(备忘录.文件夹)) {
      备忘录.已删除 = true;
      备忘录.删除时间 = new Date().toISOString();
      
      // 同步到 IndexedDB
      if (window.备忘录管理器) {
        window.备忘录管理器.updateMemo(备忘录.id, { 
          已删除: true, 
          删除时间: 备忘录.删除时间 
        }).catch(console.error);
      }
    }
  });
  
  return true;
}

// 初始化
初始化文件夹结构();

// ========== 导出到全局 ==========
window._当前文件夹 = () => 当前文件夹;
window._设置当前文件夹 = (文件夹) => { 当前文件夹 = 文件夹; };
window._当前搜索关键词 = () => 当前搜索关键词;
window._设置当前搜索关键词 = (关键词) => { 当前搜索关键词 = 关键词; };
window._当前筛选 = () => 当前筛选;
window._设置当前筛选 = (筛选) => { 当前筛选 = 筛选; };
window._获取所有文件夹列表 = 获取所有文件夹列表新;
window._获取文件夹树 = 获取文件夹树;
window._创建文件夹 = 创建文件夹;
window._获取子文件夹 = 获取子文件夹;
window._获取所有子文件夹名 = 获取所有子文件夹名;
window._获取文件夹的父文件夹 = 获取文件夹的父文件夹;
window._移动文件夹 = 移动文件夹;
window._重命名文件夹 = 重命名文件夹;
window._删除文件夹 = 删除文件夹;
window._切换收藏 = 切换收藏;
window._删除备忘录 = 删除备忘录;

// 获取当前备忘录的所有标签（去重排序）
function 获取当前备忘录标签(memoId) {
  const memo = (window._备忘录数据源 || []).find(m => m.id === memoId) ||
               window.备忘录管理器?.memos?.find(m => m.id === memoId);
  return memo?.标签 || [];
}

// 获取所有已用标签（去重排序）
function 获取所有已用标签() {
  const 数据源 = window._备忘录数据源 || window.备忘录管理器?.memos || [];
  const 标签集 = new Set();
  数据源.forEach(m => {
    if (m.标签 && Array.isArray(m.标签)) {
      m.标签.forEach(t => 标签集.add(t));
    }
  });
  return [...标签集].sort();
}

window._获取当前备忘录标签 = 获取当前备忘录标签;
window._获取所有已用标签 = 获取所有已用标签;

// 恢复备忘录（从回收站）
function 恢复备忘录(id) {
  if (window.备忘录管理器) {
    window.备忘录管理器.恢复备忘录(id).then(() => {
      console.log('[恢复备忘录] 已恢复');
      if (window.渲染文件夹树) window.渲染文件夹树();
      if (window.渲染备忘录列表) window.渲染备忘录列表();
    }).catch(err => {
      console.error('[恢复备忘录] 恢复失败', err);
    });
    return;
  }
  // 降级
  const 备忘录 = (window._备忘录数据 || []).find(m => m.id === id);
  if (备忘录) {
    备忘录.已删除 = false;
    备忘录.删除时间 = null;
  }
  if (window.渲染文件夹树) window.渲染文件夹树();
  if (window.渲染备忘录列表) window.渲染备忘录列表();
}

// 永久删除备忘录
function 永久删除备忘录(id) {
  if (!confirm('确定要永久删除这条备忘录吗？此操作不可撤销！')) return;
  if (window.备忘录管理器) {
    window.备忘录管理器.永久删除备忘录(id).then(() => {
      console.log('[永久删除] 已永久删除');
      if (window.渲染文件夹树) window.渲染文件夹树();
      if (window.渲染备忘录列表) window.渲染备忘录列表();
    }).catch(err => {
      console.error('[永久删除] 删除失败', err);
    });
    return;
  }
  // 降级
  window._备忘录数据 = (window._备忘录数据 || []).filter(m => m.id !== id);
  if (window.渲染文件夹树) window.渲染文件夹树();
  if (window.渲染备忘录列表) window.渲染备忘录列表();
}

// 永久删除备忘录
function 永久删除备忘录(id) {
  if (!confirm('确定要永久删除这条备忘录吗？此操作不可撤销！')) return;
  if (window.备忘录管理器) {
    window.备忘录管理器.永久删除备忘录(id).then(() => {
      console.log('[永久删除] 已永久删除');
      if (window.渲染文件夹树) window.渲染文件夹树();
      if (window.渲染备忘录列表) window.渲染备忘录列表();
    }).catch(err => {
      console.error('[永久删除] 删除失败', err);
    });
    return;
  }
  // 降级
  window._备忘录数据 = (window._备忘录数据 || []).filter(m => m.id !== id);
  if (window.渲染文件夹树) window.渲染文件夹树();
  if (window.渲染备忘录列表) window.渲染备忘录列表();
}

// 置顶备忘录
function 置顶备忘录(id) {
  if (window.备忘录管理器) {
    window.备忘录管理器.置顶备忘录(id).then(() => {
      console.log('[置顶] 已置顶 ID:', id);
    }).catch(err => {
      console.error('[置顶] 失败', err);
    });
    return;
  }
  // 降级：使用内存存储
  const 备忘录 = (window._备忘录数据 || []).find(m => m.id === id);
  if (备忘录) {
    const now = new Date().toISOString();
    // 取消其他置顶
    (window._备忘录数据 || []).forEach(m => {
      if (m.已置顶 && m.id !== id) {
        m.已置顶 = false;
        m.置顶时间 = null;
      }
    });
    备忘录.已置顶 = true;
    备忘录.置顶时间 = now;
    if (window.渲染备忘录列表) window.渲染备忘录列表();
  }
}

// 取消置顶
function 取消置顶(id) {
  if (window.备忘录管理器) {
    window.备忘录管理器.取消置顶(id).then(() => {
      console.log('[取消置顶] ID:', id);
    }).catch(err => {
      console.error('[取消置顶] 失败', err);
    });
    return;
  }
  // 降级
  const 备忘录 = (window._备忘录数据 || []).find(m => m.id === id);
  if (备忘录) {
    备忘录.已置顶 = false;
    备忘录.置顶时间 = null;
    if (window.渲染备忘录列表) window.渲染备忘录列表();
  }
}

window._恢复备忘录 = 恢复备忘录;
window._永久删除备忘录 = 永久删除备忘录;
window._置顶备忘录 = 置顶备忘录;
window._取消置顶 = 取消置顶;
// ========== AI 临时筛选状态 ==========
let AI临时筛选 = null; // { memoIds: string[], title: string, originalFolder: string, originalFilter: string }

window._获取AI临时筛选 = () => AI临时筛选;

window._设置AI临时筛选 = (筛选) => {
  console.log('[🔍调试] _设置AI临时筛选 被调用：', 筛选 ? '设置AI筛选 memoIds=' + 筛选.memoIds?.length : '清除AI筛选');
  if (!筛选) {
    // 清除：只清数据，不重置状态（调用方自己决定重置为什么）
    AI临时筛选 = null;
    console.log('[🔍调试] AI筛选已清除（状态由调用方控制）');
  } else {
    // 保存原始状态
    const originalFolder = window._当前文件夹 ? window._当前文件夹() : '全部';
    const originalFilter = window._当前筛选 ? window._当前筛选() : 'all';
    AI临时筛选 = {
      memoIds: 筛选.memoIds,
      title: 筛选.title || 'AI筛选结果',
      originalFolder,
      originalFilter,
    };
    // 临时修改状态：全部备忘，无日期筛选，无搜索
    if (window._设置当前文件夹) window._设置当前文件夹('全部');
    if (window._设置当前筛选) window._设置当前筛选('all');
    if (window._设置当前日期筛选) window._设置当前日期筛选(null);
    if (window._设置当前搜索关键词) window._设置当前搜索关键词('');
    if (window._设置当前标签筛选) window._设置当前标签筛选(null);
  }
  // 刷新视图
  if (window.渲染备忘录列表) window.渲染备忘录列表();
  if (window.渲染文件夹树) window.渲染文件夹树();
  if (window.渲染筛选按钮) window.渲染筛选按钮();
};

// ========== AI 查询工具：按日期范围或关键词查询备忘录 ==========
window._查询备忘录 = (参数) => {
  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];

  let 结果 = 数据源;

  // 按ID筛选（支持字符串或数字ID，修复类型不匹配问题）
  if (参数?.memoIds?.length) {
    const idSet = new Set(参数.memoIds.map(id => String(id)));
    结果 = 结果.filter(m => idSet.has(String(m.id)));
  }

  // 排除已删除
  结果 = 结果.filter(m => !m.已删除);

  // 按日期范围
  if (参数?.startDate || 参数?.endDate) {
    const start = 参数.startDate ? new Date(参数.startDate) : null;
    const end = 参数.endDate ? new Date(参数.endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    结果 = 结果.filter(m => {
      const d = new Date(m.日期 || m.更新时间);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }

  // 按语义关键词（多维度搜索：精确匹配 + 分词 + 同义词展开 + 标签加权）
  if (参数?.keyword) {
    const kw = 参数.keyword.toLowerCase();
    const 提取纯文本 = window.提取纯文本 || (html => html || '');
    // 复用备忘录管理器的同义词表
    const 同义词表 = MemoManager.同义词表 || {};
    const 词列表 = kw.split(/\s+/).filter(Boolean);
    const 所有搜索词 = new Set(词列表);
    for (const 词 of 词列表) {
      const 同义词 = 同义词表[词];
      if (同义词) 同义词.forEach(s => 所有搜索词.add(s));
    }
    const 搜索词数组 = [...所有搜索词];

    // 简单分词（双字符滑动窗口）
    function 简单分词(文本) {
      const s = 文本.toLowerCase().trim();
      if (!s) return [];
      const 英文词元 = s.split(/[^a-z0-9+#.\-_]/).filter(w => w.length >= 1);
      const 中文 = s.replace(/[^\u4e00-\u9fff]/g, '');
      const 中文词元 = [];
      for (let i = 0; i < 中文.length - 1; i++) 中文词元.push(中文.slice(i, i + 2));
      const 单字词元 = 中文.split('').filter(c => c.length === 1);
      return [...new Set([...英文词元, ...中文词元, ...单字词元])];
    }

    结果 = 结果.map(m => {
      let 分数 = 0;
      const 标题 = (m.标题 || '').toLowerCase();
      const 内容文本 = 提取纯文本(m.内容).toLowerCase();
      const 标签文本 = (m.标签 || []).join(' ').toLowerCase();
      const 全文 = 标题 + ' ' + 内容文本 + ' ' + 标签文本;
      const 内容词元 = new Set(简单分词(全文));

      for (const 搜索词 of 搜索词数组) {
        if (全文.includes(搜索词)) {
          if (标签文本.includes(搜索词)) 分数 += 6;
          else if (标题.includes(搜索词)) 分数 += 4;
          else 分数 += 2;
        }
        for (const 词元 of 内容词元) {
          if (词元.includes(搜索词) || 搜索词.includes(词元)) {
            分数 += 1;
            break;
          }
        }
      }
      return { memo: m, 分数 };
    })
    .filter(r => r.分数 > 0)
    .sort((a, b) => b.分数 - a.分数)
    .map(r => r.memo);
  }

  // 按文件夹精确筛选
  if (参数?.folder) {
    结果 = 结果.filter(m => (m.文件夹 || '未分类') === 参数.folder);
  }

  // 按结构特征搜索
  if (参数?.hasTodo !== undefined) {
    结果 = 结果.filter(m => !!m.hasTodo === !!参数.hasTodo);
  }
  if (参数?.hasImg !== undefined) {
    结果 = 结果.filter(m => !!m.hasImg === !!参数.hasImg);
  }
  if (参数?.hasAttachment !== undefined) {
    结果 = 结果.filter(m => !!m.hasAttachment === !!参数.hasAttachment);
  }
  if (参数?.hasCompletedTodo !== undefined) {
    结果 = 结果.filter(m => !!m.hasCompletedTodo === !!参数.hasCompletedTodo);
  }

  return {
    count: 结果.length,
    ids: 结果.map(m => String(m.id)),
    samples: 结果.slice(0, 8).map(m => {
      // 结构化预览：待办项文本、图片数、附件数
      let 结构概要 = '';
      if (m.hasTodo && m.内容) {
        const todoTexts = [];
        const todoRe = /<span[^>]*class="[^"]*todo-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
        let tMatch;
        while ((tMatch = todoRe.exec(m.内容)) !== null) {
          todoTexts.push(tMatch[1].replace(/<[^>]+>/g, '').trim());
        }
        if (todoTexts.length) 结构概要 += '待办: ' + todoTexts.join(', ');
      }
      if (m.hasImg) 结构概要 += (结构概要 ? '; ' : '') + `图片${m.imgCount}张`;
      if (m.hasAttachment) 结构概要 += (结构概要 ? '; ' : '') + `附件${m.attachmentCount}个`;
      const 纯文本预览 = m.内容 ? m.内容.replace(/<[^>]+>/g, '').slice(0, 200) : '';
      return {
        id: String(m.id),
        title: m.标题,
        date: m.日期 || m.更新时间,
        preview: 纯文本预览,
        结构概要: 结构概要 || null,
        hasTodo: !!m.hasTodo,
        hasImg: !!m.hasImg,
        hasAttachment: !!m.hasAttachment,
        todoCount: m.todoCount || 0
      };
    })
  };
};

/**
 * 按路径字符串查找最深层匹配的文件夹名称
 * 支持 "个人/日记/2026年" 或 "个人 → 日记 → 2026年" 格式
 */
function 按路径查找文件夹(路径字符串) {
  const 分隔符 = 路径字符串.includes('→') ? '→' : '/';
  const 路径段 = 路径字符串.split(分隔符).map(s => s.trim()).filter(s => s);
  if (路径段.length === 0) return null;
  let 当前匹配 = null;
  for (let 层级 = 0; 层级 < 路径段.length; 层级++) {
    const 期望名称 = 路径段[层级];
    if (层级 === 0) {
      当前匹配 = 文件夹结构.find(f => f.名称 === 期望名称 && (f.父文件夹 === null || f.父文件夹 === undefined));
    } else {
      当前匹配 = 文件夹结构.find(f => f.名称 === 期望名称 && f.父文件夹 === 当前匹配?.名称);
    }
    if (!当前匹配) return null;
  }
  return 当前匹配 ? 当前匹配.名称 : null;
}
window.按路径查找文件夹 = 按路径查找文件夹;
window.创建新文件夹 = window._创建文件夹;

/**
 * 确保路径上的所有文件夹都存在，自动创建缺失的中间文件夹
 * @param {string} 路径字符串 - 如 "个人/日记/2026年" 或 "个人 → 日记 → 2026年"
 * @returns {string|null} 最终叶子文件夹的名称，失败返回 null
 */
function 确保路径文件夹(路径字符串) {
  const 分隔符 = 路径字符串.includes('→') ? '→' : '/';
  const 路径段 = 路径字符串.split(分隔符).map(s => s.trim()).filter(s => s);
  if (路径段.length === 0) return null;
  let 父文件夹 = null;
  for (let 层级 = 0; 层级 < 路径段.length; 层级++) {
    const 名称 = 路径段[层级];
    const 已存在 = 文件夹结构.some(f => f.名称 === 名称 && f.父文件夹 === 父文件夹);
    if (!已存在) {
      创建文件夹(名称, 父文件夹);
    }
    父文件夹 = 名称;
  }
  return 路径段[路径段.length - 1];
}
window.确保路径文件夹 = 确保路径文件夹;

