// 智能体选择器.js - 智能体选择UI + 添加新智能体
window.创建智能体选择器UI = async function() {
  try {
    window._调试面板('选择器: 开始');
    // 挂载到左侧区
    const 左侧区 = document.querySelector('.左侧区');
    window._调试面板('左侧区: ' + (!!左侧区));
    if (!左侧区) { window._调试面板('左侧区不存在!'); return; }

    window._调试面板('step1: 检查获取智能体列表');
    if (!window.获取智能体列表) {
      window._调试面板('获取智能体列表函数未定义，稍后重试');
      setTimeout(window.创建智能体选择器UI, 500);
      return;
    }
    window._调试面板('step2: 开始获取列表');

    let 智能体列表 = [];
    try {
      智能体列表 = await window.获取智能体列表();
      window._调试面板('智能体列表: ' + (智能体列表?.length || 0));
    } catch (e) {
      window._调试面板('获取列表失败: ' + String(e));
    }
    if (!智能体列表 || !Array.isArray(智能体列表)) 智能体列表 = [];

    window._调试面板('step3: 列表长度=' + 智能体列表.length);
    const 当前ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    const 当前智能体 = 智能体列表.find(a => a.id === 当前ID) || { id: 'default', name: '默认智能体', icon: '🤖' };

    window._调试面板('step4: 当前智能体=' + 当前智能体.name);
    更新抽屉头像(当前智能体);

    window._调试面板('step5: 检查是否已存在');
    if (document.querySelector('.智能体选择器')) { window._调试面板('选择器已存在，跳过'); return; }

    window._调试面板('step6: 开始创建DOM');

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
    // 插入到左侧区
    // 挂到左侧区
    左侧区.appendChild(选择器容器);

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

    // 选择按钮交互（鸿蒙WebView兼容 touchend + click 降级）
    const _选择按钮点击 = async function(e) {
      e.stopPropagation();
      e.preventDefault();
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
    };
    // 同时监听 touchend 和 click，鸿蒙 WebView 优先走 touchend
    选择按钮.addEventListener('touchend', _选择按钮点击, { passive: false });
    选择按钮.addEventListener('click', _选择按钮点击);

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', function(e) {
      if (!选择器容器.contains(e.target)) {
        关闭下拉菜单();
      }
    });
    // 鸿蒙 WebView 也走 touchend 关闭
    document.addEventListener('touchend', function(e) {
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

    window._调试面板('step7: 选择器创建完成');
  } catch(e) {
    window._调试面板('创建选择器异常: ' + String(e));
  }
};

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
