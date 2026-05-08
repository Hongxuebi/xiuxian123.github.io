// 智能体选择器.js - 智能体选择UI + 添加新智能体
window.创建智能体选择器UI = async function() {
  const 对话面板 = document.querySelector('#对话面板 .对话布局');
  if (!对话面板) {
    console.warn('对话面板未找到，智能体选择器挂载失败');
    return;
  }

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
  对话面板.insertBefore(选择器容器, 对话面板.firstChild);
  // 给选择器容器添加合适的外边距
  选择器容器.style.cssText = 'padding: 8px 12px 4px;';

  function 渲染下拉菜单(列表, 当前选ID) {
    下拉菜单.innerHTML = '';
    列表.forEach(智能体 => {
      const 项 = document.createElement('div');
      项.className = '智能体选项' + (智能体.id === 当前选ID ? ' 选中' : '');
      项.dataset.id = 智能体.id;
      项.innerHTML = `<span>${智能体.icon}</span><span>${智能体.name}</span>`;
      // 删除按钮已移至记忆库面板，避免误点
      下拉菜单.appendChild(项);
    });
    // 分隔线
    下拉菜单.appendChild(Object.assign(document.createElement('div'), { className: '智能体分隔线' }));
    // 添加按钮
    const 添加项 = document.createElement('div');
    添加项.className = '智能体选项 添加智能体选项';
    添加项.id = '添加智能体按钮';
    添加项.innerHTML = '<span>➕</span><span>添加新智能体</span>';
    下拉菜单.appendChild(添加项);
  }

  function 刷新按钮(列表, 选ID) {
    const 当前 = 列表.find(a => a.id === 选ID) || { name: 选ID, icon: '🤖' };
    选择按钮.innerHTML = `${当前.icon} ${当前.name} ▼`;
    更新抽屉头像(当前);
  }

  function 更新抽屉头像(智能体) {
    const 头像区 = document.getElementById('抽屉头像区');
    const 头像Img = document.getElementById('抽屉智能体头像');
    const 名字区 = document.getElementById('抽屉智能体名');
    if (!头像区) return;
    头像区.querySelectorAll('.抽屉智能体名-emoji').forEach(e => e.remove());

    // 优先显示头像图片（avatar 字段 > icon URL）
    const 头像源 = 智能体.avatar || 智能体.icon;
    if (头像源 && (头像源.startsWith('http') || 头像源.startsWith('/') || 头像源.startsWith('data:'))) {
      头像Img.src = 头像源;
      头像Img.style.display = 'block';
      头像区.classList.add('has-img');
    } else {
      // emoji 头像
      头像Img.style.display = 'none';
      头像区.classList.remove('has-img');
      const emoji = 头像源 || '🤖';
      const emojiSpan = document.createElement('div');
      emojiSpan.className = '抽屉智能体名-emoji';
      emojiSpan.textContent = emoji;
      头像区.appendChild(emojiSpan);
    }

    if (名字区) 名字区.textContent = 智能体.name;

    // 控制占位符显隐
    const 占位符 = document.getElementById('抽屉头像占位');
    if (占位符) {
      const 有图片 = 头像源 && (头像源.startsWith('http') || 头像源.startsWith('/') || 头像源.startsWith('data:'));
      占位符.style.display = 有图片 ? 'none' : 'flex';
    }
  }

  // 暴露给外部绑定函数使用
  window.更新抽屉头像 = 更新抽屉头像;

  渲染下拉菜单(智能体列表, 当前ID);

  选择按钮.addEventListener('click', (e) => {
    e.stopPropagation();
    下拉菜单.style.display = 下拉菜单.style.display === 'block' ? 'none' : 'block';
  });

  下拉菜单.addEventListener('click', async (e) => {
    const 选项 = e.target.closest('.智能体选项');
    if (!选项) return;
    const 选ID = 选项.dataset.id;
    if (选项.id === '添加智能体按钮') {
      下拉菜单.style.display = 'none';
      if (window.打开添加智能体浮层) window.打开添加智能体浮层();
      else window._显示提示('添加智能体功能开发中','info');
      return;
    }
    if (选ID && window.切换智能体) {
      await window.切换智能体(选ID);
      刷新按钮(智能体列表, 选ID);
      渲染下拉菜单(智能体列表, 选ID);
    }
    下拉菜单.style.display = 'none';
  });

  document.addEventListener('click', () => {
    下拉菜单.style.display = 'none';
  });

  window.刷新智能体UI = async () => {
    let 新列表 = [];
    try {
      新列表 = await window.获取智能体列表();
    } catch (e) { console.error(e); }
    if (!新列表 || !Array.isArray(新列表)) 新列表 = [];
    智能体列表 = 新列表;
    const 当前选ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    刷新按钮(新列表, 当前选ID);
    const 当前 = 新列表.find(a => a.id === 当前选ID) || { name: 当前选ID, icon: '🤖' };
    更新抽屉头像(当前);
    渲染下拉菜单(新列表, 当前选ID);
  };
};

// ========== 头像预览浮层绑定 ==========
window.绑定头像预览 = function() {
  const 头像区 = document.getElementById('抽屉头像区');
  const 预览浮层 = document.getElementById('头像预览浮层');
  const 预览图片 = document.getElementById('头像预览图片');
  const 预览名字 = document.getElementById('头像预览名字');
  const 更换按钮 = document.getElementById('更换头像按钮');
  const 关闭按钮 = document.getElementById('关闭头像预览');
  const 文件选择 = document.getElementById('头像文件选择');

  if (!头像区 || !预览浮层) return;

  // 点击头像区 → 打开预览
  头像区.addEventListener('click', () => {
    const 配置 = window.获取当前智能体配置 ? window.获取当前智能体配置() : null;
    const 头像源 = 配置?.avatar || 配置?.icon || '🤖';
    const 名称 = 配置?.name || '默认智能体';

    if (头像源.startsWith('http') || 头像源.startsWith('/') || 头像源.startsWith('data:')) {
      预览图片.src = 头像源;
      预览图片.style.display = 'block';
    } else {
      // emoji 显示在图片区
      预览图片.style.display = 'none';
    }
    预览名字.textContent = 名称;
    预览浮层.style.display = 'flex';
  });

  // 关闭预览
  if (关闭按钮) {
    关闭按钮.addEventListener('click', () => { 预览浮层.style.display = 'none'; });
  }
  预览浮层.addEventListener('click', (e) => {
    if (e.target === 预览浮层) 预览浮层.style.display = 'none';
  });

  // 更换头像 → 触发文件选择
  if (更换按钮 && 文件选择) {
    更换按钮.addEventListener('click', (e) => {
      e.stopPropagation();
      文件选择.click();
    });
    文件选择.addEventListener('change', async () => {
      const file = 文件选择.files[0];
      if (!file) return;
      try {
        const base64 = await window.裁切图片为正方形(file);
        const 成功 = await window.保存头像(base64);
        if (成功) {
          // 更新预览图
          预览图片.src = base64;
          预览图片.style.display = 'block';
          // 更新抽屉头像
          const 配置 = window.获取当前智能体配置 ? window.获取当前智能体配置() : {};
          配置.avatar = base64;
          if (window.更新抽屉头像) window.更新抽屉头像(配置);
        } else {
          window._显示提示('保存头像失败','error');
        }
      } catch (err) {
        console.error('处理头像失败', err);
        window._显示提示('处理图片失败','error');
      }
      文件选择.value = '';
    });
  }
};
