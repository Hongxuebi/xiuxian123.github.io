// 标签页.js - 顶部标签页切换
window.绑定标签页切换 = function() {
  const 标签按钮列表 = document.querySelectorAll('.标签页按钮');
  const 面板列表 = document.querySelectorAll('.内容面板');
  const 顶部栏 = document.querySelector('.顶部栏');
  
  // 记忆上一次切换前是哪个面板
  let 上一面板ID = '对话面板';
  
  function 切换标签(激活面板ID) {
    const 抽屉开关 = document.getElementById('抽屉开关');
    const 当前面板 = 面板列表.length > 0 ? document.querySelector('.内容面板.激活') : null;
    
    // 记录上一面板（非记忆库面板才更新）
    if (当前面板 && 当前面板.id !== '记忆库面板') {
      上一面板ID = 当前面板.id || '对话面板';
    }
    
    面板列表.forEach(面板 => 面板.classList.remove('激活'));
    const 目标面板 = document.getElementById(激活面板ID);
    if (目标面板) 目标面板.classList.add('激活');
    标签按钮列表.forEach(btn => {
      btn.classList.remove('激活');
      if (btn.dataset.面板 === 激活面板ID) btn.classList.add('激活');
    });
    if (window.设置当前激活面板) window.设置当前激活面板(激活面板ID);
    
    if (顶部栏) {
      if (激活面板ID === '编辑页面') {
        顶部栏.style.display = 'none';
      } else {
        顶部栏.style.display = 'flex';
      }
    }
    
    const 智能体选择器 = document.querySelector('.智能体选择器');
    if (智能体选择器) {
      智能体选择器.style.display = 激活面板ID === '对话面板' ? 'block' : 'none';
    }
    
    const 备忘录更多按钮 = document.getElementById('备忘录更多按钮');
    if (备忘录更多按钮) {
      if (激活面板ID === '备忘录面板') {
        备忘录更多按钮.style.display = 'block';
      } else {
        备忘录更多按钮.style.display = 'none';
        const 全局浮动菜单 = document.getElementById('全局浮动菜单');
        if (全局浮动菜单) 全局浮动菜单.classList.remove('显示');
      }
    }
    
    // 对话面板专属按钮显隐
    const 上下文按钮 = document.getElementById('上下文占用率按钮');
    const 清空按钮 = document.getElementById('清空对话按钮');
    if (上下文按钮) 上下文按钮.style.display = 激活面板ID === '对话面板' ? '' : 'none';
    if (清空按钮) 清空按钮.style.display = 激活面板ID === '对话面板' ? '' : 'none';

    // 备忘录标题（用CSS类控制显隐，避免inline style被覆盖）
    const 备忘录标题 = document.getElementById('备忘录标题');
    if (备忘录标题) {
      if (激活面板ID === '备忘录面板') {
        备忘录标题.classList.add('面板可见');
      } else {
        备忘录标题.classList.remove('面板可见');
      }
    }

    // 切换到备忘录面板时刷新列表
    if (激活面板ID === '备忘录面板') {
      if (window.渲染备忘录列表) window.渲染备忘录列表();
    }

    // 切换到记忆库面板时刷新
    if (激活面板ID === '记忆库面板') {
      if (window.渲染记忆库面板) window.渲染记忆库面板();
    }

    // 记忆库面板特殊处理：☰ → 返回按钮
    if (抽屉开关) {
      if (激活面板ID === '记忆库面板') {
        // 保存原始文字和事件
        if (!抽屉开关.dataset.原始文本) {
          抽屉开关.dataset.原始文本 = 抽屉开关.textContent;
        }
        抽屉开关.textContent = '← 返回';
        抽屉开关.title = '返回';
        // 解绑旧事件（通过替换克隆节点方式）
        替换抽屉开关事件(抽屉开关, () => {
          const 目标 = document.getElementById(上一面板ID) || document.getElementById('对话面板');
          if (目标) 切换标签(目标.id);
        });
      } else {
        // 恢复 ☰ 按钮
        if (抽屉开关.dataset.原始文本) {
          抽屉开关.textContent = 抽屉开关.dataset.原始文本;
          抽屉开关.title = '菜单';
          // 恢复为打开抽屉
          替换抽屉开关事件(抽屉开关, () => {
            if (window.打开抽屉) window.打开抽屉();
          });
        }
      }
    }
  }
  
  标签按钮列表.forEach(btn => {
    btn.addEventListener('click', () => {
      const 面板ID = btn.dataset.面板;
      if (面板ID) 切换标签(面板ID);
    });
  });
  
  window.切换标签 = 切换标签;
};

/**
 * 替换抽屉开关的点击事件
 * 用 cloneNode 方式彻底移除旧事件监听
 */
function 替换抽屉开关事件(开关, 新回调) {
  if (!开关) return;
  const 克隆 = 开关.cloneNode(true);
  开关.parentNode.replaceChild(克隆, 开关);
  克隆.addEventListener('click', 新回调);
  // 更新全局引用
  window.记忆库返回按钮 = 克隆;
}
