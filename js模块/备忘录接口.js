// 备忘录接口.js - 对外暴露的全局函数

// 初始化备忘录管理
function 初始化备忘录管理() {
  // 绑定事件
  if (window._绑定搜索框事件) window._绑定搜索框事件();
  if (window._绑定筛选按钮事件) window._绑定筛选按钮事件();
  // 初始渲染（渲染文件夹树内部会绑定文件夹树点击事件）
  if (window.渲染文件夹树) window.渲染文件夹树();
  if (window.渲染备忘录列表) window.渲染备忘录列表();
}

// 保存备忘录（从编辑页面调用）
function 保存备忘录(标题, 内容, 文件夹, 标签) {
  if (!标题) {
    window._显示提示('请输入标题','error');
    return;
  }
  
  // 优先使用新的 MemoManager（IndexedDB持久化）
  if (window.备忘录管理器) {
    if (window.当前编辑备忘录ID) {
      // 更新现有备忘录
      window.备忘录管理器.updateMemo(window.当前编辑备忘录ID, {
        标题,
        内容,
        文件夹: 文件夹 || '默认',
        标签: 标签 || []
      }).then(() => {
        console.log('[保存备忘录] 已更新到 IndexedDB');
        // 强制同步内存缓存
        const 缓存项 = (window._备忘录数据 || []).find(m => m.id === window.当前编辑备忘录ID);
        if (缓存项) {
          缓存项.标题 = 标题;
          缓存项.内容 = 内容;
          缓存项.文件夹 = 文件夹 || '默认';
          缓存项.标签 = 标签 || [];
          缓存项.更新时间 = new Date().toISOString();
        }
      }).catch(err => {
        console.error('[保存备忘录] 更新失败', err);
      });
    } else {
      // 创建新备忘录
      window.备忘录管理器.createMemo({
        标题,
        内容,
        文件夹: 文件夹 || '默认',
        标签: 标签 || []
      }).then(() => {
        console.log('[保存备忘录] 已创建到 IndexedDB');
      }).catch(err => {
        console.error('[保存备忘录] 创建失败', err);
      });
    }
  } else {
    // 降级：使用旧内存存储（兼容）
    const 当前时间 = new Date().toISOString();
    if (window.当前编辑备忘录ID) {
      const 备忘录 = window._备忘录数据.find(m => m.id === window.当前编辑备忘录ID);
      if (备忘录) {
        备忘录.标题 = 标题;
        备忘录.内容 = 内容;
        备忘录.文件夹 = 文件夹 || '默认';
        备忘录.标签 = 标签 || [];
        备忘录.更新时间 = 当前时间;
      }
    } else {
      const 新备忘录 = {
        id: window._备忘录数据.length > 0 ? Math.max(...window._备忘录数据.map(m => m.id)) + 1 : 1,
        标题,
        内容,
        日期: new Date().toISOString().split('T')[0],
        文件夹: 文件夹 || '默认',
        标签: 标签 || [],
        收藏: false,
        创建时间: 当前时间,
        更新时间: 当前时间
      };
      window._备忘录数据.push(新备忘录);
    }
  }
  
  // 切换回备忘录面板
  if (window.切换标签) window.切换标签('备忘录面板');
  // 重新渲染
  if (window.渲染文件夹树) window.渲染文件夹树();
  if (window.渲染备忘录列表) window.渲染备忘录列表();
  // 清空编辑表单
  document.getElementById('编辑标题').value = '';
  document.getElementById('编辑内容').textContent = '';
  window.当前编辑备忘录ID = null;
}

// 按标签筛选（供卡片标签点击 + 标签操作菜单使用）
function 按标签筛选(标签) {
  console.log('[按标签筛选] 调用, 标签=', 标签);
  // 清除其他筛选模式
  if (window._设置当前文件夹) window._设置当前文件夹('全部');
  if (window._设置当前搜索关键词) window._设置当前搜索关键词('');
  if (window._设置当前日期筛选) window._设置当前日期筛选(null);
  if (window._设置当前筛选) window._设置当前筛选('all');
  if (window._设置当前标签筛选) window._设置当前标签筛选(标签);
  // 清空搜索框
  const 搜索框 = document.getElementById('备忘录搜索框');
  if (搜索框) 搜索框.value = '';
  if (window.渲染备忘录列表) window.渲染备忘录列表();
}

// 暴露全局
window.初始化备忘录管理 = 初始化备忘录管理;
window.保存备忘录 = 保存备忘录;
window.按标签筛选 = 按标签筛选;

// 填充编辑表单（供AI单条整理后直接修改表单）
// 建议格式: { 新标题, 新文件夹, 新标签, 整理后内容 }
window.填充编辑表单 = function(建议) {
  const 标题输入 = document.getElementById('编辑标题');
  const 内容输入 = document.getElementById('编辑内容');
  const 文件夹显示 = document.getElementById('当前文件夹名称');
  
  if (建议.新标题 !== undefined && 标题输入) {
    标题输入.value = 建议.新标题;
  }
  if (建议.整理后内容 !== undefined && 内容输入) {
    内容输入.innerHTML = 建议.整理后内容;
  }
  if (建议.新文件夹 !== undefined && 文件夹显示) {
    文件夹显示.textContent = 建议.新文件夹;
  }
  
  // 标签暂时无法直接在页面显示，可以通过提示告知用户
  if (建议.新标签) {
    console.log('AI建议的标签:', 建议.新标签);
  }
};

// 兼容旧接口（可选）
window.切换收藏 = (id) => { window._切换收藏(id); };
window.删除备忘录 = (id) => { window._删除备忘录(id); };

// 回收站操作接口
window.恢复备忘录 = async function(id) {
  if (!window.备忘录管理器) {
    window._显示提示('备忘录管理器未初始化','error');
    return;
  }
  try {
    await window.备忘录管理器.恢复备忘录(id);
    window._显示提示('备忘录已恢复','success');
  } catch (错误) {
    window._显示提示('恢复失败: ' + 错误.message,'error');
  }
};

window.永久删除备忘录 = async function(id) {
  if (!window.备忘录管理器) {
    window._显示提示('备忘录管理器未初始化','error');
    return;
  }
  if (!await window._自定义确认('确定要永久删除这条备忘录吗？此操作不可撤销。')) return;
  try {
    await window.备忘录管理器.永久删除备忘录(id);
    window._显示提示('备忘录已永久删除','success');
  } catch (错误) {
    window._显示提示('删除失败: ' + 错误.message,'error');
  }
};