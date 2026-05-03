// 备忘录事件.js - 绑定UI事件（搜索框、筛选按钮、文件夹树点击）

// 绑定搜索框
function 绑定搜索框事件() {
  const 搜索框 = document.getElementById('备忘录搜索框');
  if (!搜索框) return;
  搜索框.addEventListener('input', (e) => {
    // 用户主动搜索，清除AI筛选
    if (window._获取AI临时筛选 && window._获取AI临时筛选()) {
      window._设置AI临时筛选(null);
      // 恢复默认筛选状态
      if (window._设置当前文件夹) window._设置当前文件夹('全部');
      if (window._设置当前筛选) window._设置当前筛选('all');
      if (window._设置当前日期筛选) window._设置当前日期筛选(null);
    }
    window._设置当前搜索关键词(e.target.value);
    window.渲染备忘录列表();
  });
}

// 绑定筛选按钮（全部备忘/收藏/最近删除）— 事件委托到容器
function 绑定筛选按钮事件() {
  const 容器 = document.getElementById('筛选内容');
  if (!容器) return;
  容器.addEventListener('click', (e) => {
    const 按钮 = e.target.closest('.筛选按钮');
    if (!按钮) return;
    e.stopPropagation(); // 阻止冒泡，避免触发抽屉遮罩关闭
    const filter = 按钮.dataset.filter;
    if (!filter) return;

    // 用户主动操作，清除AI筛选
    if (window._获取AI临时筛选 && window._获取AI临时筛选()) {
      window._设置AI临时筛选(null);
    }

    if (filter === 'all') {
      window._设置当前筛选('all');
      window._设置当前文件夹('全部');
      if (window._设置当前日期筛选) window._设置当前日期筛选(null);
      if (window._设置当前标签筛选) window._设置当前标签筛选(null);
      if (window.渲染文件夹树) window.渲染文件夹树();
    } else if (filter === 'favorite') {
      window._设置当前筛选('favorite');
      window._设置当前文件夹('全部');
      if (window._设置当前日期筛选) window._设置当前日期筛选(null);
      if (window._设置当前标签筛选) window._设置当前标签筛选(null);
      if (window.渲染文件夹树) window.渲染文件夹树();
    } else if (filter === 'deleted') {
      window._设置当前筛选('deleted');
      window._设置当前文件夹('全部');
      if (window._设置当前日期筛选) window._设置当前日期筛选(null);
      if (window._设置当前标签筛选) window._设置当前标签筛选(null);
      if (window.渲染文件夹树) window.渲染文件夹树();
    }
    window.渲染备忘录列表();
  });
}

// 导出绑定函数
window._绑定搜索框事件 = 绑定搜索框事件;
window._绑定筛选按钮事件 = 绑定筛选按钮事件;
