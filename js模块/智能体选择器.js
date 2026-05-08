// 智能体选择器.js - 智能体选择UI + 添加新智能体
window.创建智能体选择器UI = async function() {
  // 挂载到标签页容器之后，作为顶部栏中间的子元素
  const 标签页容器 = document.querySelector('.标签页容器');
  if (!标签页容器) return;

  if (!window.获取智能体列表) {
    console.warn('获取智能体列表函数未定义，稍后重试');
    setTimeout(window.创建智能体选择器UI, 500);
    return;
  }

  let 智能体列表 = [];
  try {
    智能体列表 = await window.获取智能体列表();
  } catch (e) {
    console.error('获取智能体列表失败', e);
  }
  if (!智能体列表 || !Array.isArray(智能体列表)) 智能体列表 = [];

  const 当前ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
  const 当前智能体 = 智能体列表.find(a => a.id === 当前ID) || { id: 'default', name: '默认智能体', icon: '🤖' };

  更新抽屉头像(当前智能体);

  更新抽屉头像(当前智能体);

  if (document.querySelector('.智能体选择器')) return;

  const 选择器容器 = document.createElement('div');
  选择器容器.className = '智能体选择器';

  const 选择按钮 = document.createElement('button');
  选择按钮.id = '智能体选择按钮';
  选择按钮.className = '智能体选择按钮';
  选择按钮.innerHTML = `${当前智能体.icon} ${当前智能体.name} ▼`;

  const 下拉菜单 = document.createElement('div');
  下拉菜单.id = '智能体下拉菜单';
  下拉菜单.className = '智能体下拉菜单';

  选择器容器.appendChild(选择按钮);
  选择器容器.appendChild(下拉菜单);
  // 插入到标签页容器之后（兄弟关系）
  // 挂到标签页容器内部（作为子元素，和按钮并列）
  标签页容器.appendChild(选择器容器);

  function 渲染下拉菜单(列表, 当前选ID) {
    下拉菜单.innerHTML = '';
    列表.forEach(智能体 => {
      const 项 = document.createElement('div');
      项.className = '智能体选项' + (智能体.id === 当前选ID ? ' 选中' : '');
      项.dataset.id = 智能体.id;
      项.innerHTML = `${智能体.icon} ${智能体.name}`;
      项.addEventListener('click', async function() {
        const id = this.dataset.id;
        if (id === 当前选ID) { 下拉菜单.classList.remove('显示'); return; }
        if (window.切换智能体) {
          await window.切换智能体(id);
          关闭下拉菜单();
          更新抽屉头像(智能体列表.find(a => a.id === id) || 智能体);
          选择按钮.innerHTML = `${(智能体列表.find(a=>a.id===id)||{}).icon||'🤖'} ${(智能体列表.find(a=>a.id===id)||{}).name||'未知'} ▼`;
        }
      });
    });
  }

  // 删除智能体功能（长按选中项触发）
  // ... （如需删除，可以通过智能体管理界面操作）

  function 关闭下拉菜单() {
    下拉菜单.classList.remove('显示');
  }

  // 点击选择按钮展开下拉菜单
  选择按钮.addEventListener('click', async function(e) {
    e.stopPropagation();
    if (下拉菜单.classList.contains('显示')) {
      关闭下拉菜单();
      return;
    }
    try {
      const 列表 = await window.获取智能体列表();
      const 当前ID = window.当前智能体ID();
      渲染下拉菜单(列表, 当前ID);
      下拉菜单.classList.add('显示');
    } catch (err) {
      console.error('刷新智能体列表失败', err);
    }
  });

  // 点击其他地方关闭下拉菜单
  document.addEventListener('click', function(e) {
    if (!选择器容器.contains(e.target)) {
      关闭下拉菜单();
    }
  });

  // 更新智能体选择按钮的接口
  window.更新智能体选择器 = async function() {
    try {
      const 列表 = await window.获取智能体列表();
      const 当前ID = window.当前智能体ID();
      const 智能体 = 列表.find(a => a.id === 当前ID) || 列表[0];
      if (智能体) {
        选择按钮.innerHTML = `${智能体.icon} ${智能体.name} ▼`;
        更新抽屉头像(智能体);
      }
    } catch (e) {
      console.error('更新智能体选择器失败', e);
    }
  };
};

let _更新抽屉头像 = null;

function 更新抽屉头像(智能体) {
  if (!智能体) return;
  // 更新抽屉中的智能体头像
  const 抽屉头像 = document.querySelector('.抽屉 .智能体头像');
  if (抽屉头像) {
    抽屉头像.textContent = 智能体.icon || '';
  }
  // 更新底部抽屉中的智能体头像
  const 底部头像 = document.querySelector('.抽屉底部 .智能体头像');
  if (底部头像) {
    底部头像.textContent = 智能体.icon || '';
  }
}
