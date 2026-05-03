// 抽屉底部.js - 抽屉底部按钮事件（集成分批次更新记忆）

window.绑定抽屉底部按钮 = function() {
  const 打开记忆库 = document.getElementById('打开记忆库按钮');
  if (打开记忆库) {
    打开记忆库.addEventListener('click', () => {
      if (window.切换标签) window.切换标签('记忆库面板');
      if (window.关闭抽屉) window.关闭抽屉();
    });
  }
  
  // [已废弃] 一键更新记忆——旧 MemoryManager 系统已废弃
  // const 一键更新 = document.getElementById('一键更新记忆按钮');
  // const 记忆库更新 = document.getElementById('记忆库更新按钮');
  
  // 新建会话按钮
  const 新建会话按钮 = document.getElementById('新建会话按钮抽屉');
  if (新建会话按钮) {
    新建会话按钮.addEventListener('click', () => {
      if (window.新建会话) window.新建会话();
      else ;
      if (window.关闭抽屉) window.关闭抽屉();
    });
  }
  
  // 设置按钮
  const 设置按钮 = document.getElementById('打开设置按钮抽屉');
  const 设置浮层 = document.getElementById('设置浮层');
  if (设置按钮 && 设置浮层) {
    设置按钮.addEventListener('click', () => {
      设置浮层.style.display = 'flex';
      if (window.关闭抽屉) window.关闭抽屉();
    });
  }
  
  // 新建文件夹
  const 新建文件夹按钮 = document.getElementById('新建文件夹按钮抽屉');
  if (新建文件夹按钮) {
    新建文件夹按钮.addEventListener('click', () => {
      const 文件夹名称 = prompt('请输入新文件夹名称：');
      if (文件夹名称 && 文件夹名称.trim()) {
        if (window._创建文件夹) {
          const 成功 = window._创建文件夹(文件夹名称.trim(), null);
          if (成功) {
            if (window.渲染文件夹树) window.渲染文件夹树();
            // 不关闭抽屉，保持打开状态
          } else {
            alert('文件夹已存在或创建失败');
          }
        } else {
          alert('文件夹管理功能未初始化');
        }
      }
    });
  }
  
  // 文件夹管理功能已整合到右键菜单，此处按钮已移除
};