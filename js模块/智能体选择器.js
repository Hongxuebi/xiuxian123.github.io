// 智能体选择器.js - 智能体选择UI + 添加新智能体
window.创建智能体选择器UI = async function() {
  try {
    // 挂载到左侧区
    const 左侧区 = document.querySelector('.左侧区');
    if (!左侧区) return;

    if (!window.获取智能体列表) {
      setTimeout(window.创建智能体选择器UI, 500);
      return;
    }

    let 智能体列表 = [];
    try {
      智能体列表 = await window.获取智能体列表();
    } catch (e) {
      console.error('[智能体选择器] 获取列表失败', e);
    }
    if (!智能体列表 || !Array.isArray(智能体列表)) 智能体列表 = [];

    const 当前ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    const 当前智能体 = 智能体列表.find(a => a.id === 当前ID) || { id: 'default', name: '默认智能体', icon: '🤖' };

    更新抽屉头像(当前智能体);

    // 防重复：如果已存在则跳过
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
    左侧区.appendChild(选择器容器);

    function 渲染下拉菜单(列表, 当前选ID) {
      下拉菜单.innerHTML = '';
      列表.forEach(智能体 => {
        const 项 = document.createElement('div');
        项.className = '智能体选项' + (智能体.id === 当前选ID ? ' 选中' : '');
        项.dataset.id = 智能体.id;
        项.innerHTML = `${智能体.icon} ${智能体.name}`;
        项.addEventListener('click', async function(ev) {
          ev.stopPropagation();
          const id = this.dataset.id;
          下拉菜单.classList.remove('显示'); // 先关菜单，再切换
          if (id === 当前选ID) return;
          if (window.切换智能体) {
            try {
              await window.切换智能体(id);
              const 新智能体 = 列表.find(a => a.id === id);
              if (新智能体) {
                选择按钮.innerHTML = `${新智能体.icon} ${新智能体.name} ▼`;
                更新抽屉头像(新智能体);
              }
            } catch (err) {
              console.error('[智能体选择器] 切换失败', err);
              if (window._显示提示) window._显示提示('切换智能体失败', 'error');
            }
          }
        });
        下拉菜单.appendChild(项); // 🔧 修复：原来缺少 appendChild
      });

      // 分隔线
      const 分隔线 = document.createElement('div');
      分隔线.className = '智能体分隔线';
      下拉菜单.appendChild(分隔线);

      // 添加按钮
      const 添加项 = document.createElement('div');
      添加项.className = '智能体选项 添加智能体选项';
      添加项.id = '添加智能体按钮';
      添加项.innerHTML = '<span>➕</span><span>添加新智能体</span>';
      添加项.addEventListener('click', function(ev) {
        ev.stopPropagation();
        关闭下拉菜单();
        if (window.打开添加智能体浮层) window.打开添加智能体浮层();
        else if (window._显示提示) window._显示提示('添加智能体功能开发中','info');
      });
      下拉菜单.appendChild(添加项);
    }

    function 关闭下拉菜单() {
      下拉菜单.classList.remove('显示');
    }

    // 选择按钮交互
    const _选择按钮点击 = async function(e) {
      if (e) e.stopPropagation();
      console.log('[智能体选择器] 按钮点击');

      if (下拉菜单.classList.contains('显示')) {
        关闭下拉菜单();
        return;
      }

      // 显示加载状态
      下拉菜单.innerHTML = '<div style="padding:8px;text-align:center;color:var(--text-secondary,#888);">加载中...</div>';
      下拉菜单.classList.add('显示');

      try {
        // 5秒超时防挂起
        const 超时 = new Promise((_, reject) => setTimeout(() => reject(new Error('获取列表超时')), 5000));
        const 列表 = await Promise.race([window.获取智能体列表(), 超时]);
        if (!列表 || !Array.isArray(列表)) throw new Error('列表数据无效');
        const 当前ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
        渲染下拉菜单(列表, 当前ID);
      } catch (err) {
        console.error('[智能体选择器] 加载失败', err);
        下拉菜单.innerHTML = '<div style="padding:8px;color:red;">加载失败，点击重试</div>';
        if (window._显示提示) window._显示提示('智能体列表加载失败', 'error');
      }
    };

    // 鸿蒙 WebView：touchend + preventDefault 阻止click合成
    选择按钮.addEventListener('touchend', function(e) {
      e.preventDefault();
      _选择按钮点击(e);
    }, { passive: false });
    // 桌面浏览器：常规 click
    选择按钮.addEventListener('click', function(e) {
      _选择按钮点击(e);
    });

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', function(e) {
      if (!选择器容器.contains(e.target)) 关闭下拉菜单();
    });
    document.addEventListener('touchend', function(e) {
      if (!选择器容器.contains(e.target)) 关闭下拉菜单();
    });

    // 更新接口
    window.更新智能体选择器 = async function() {
      try {
        const 列表 = await window.获取智能体列表();
        const 当前ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
        const 智能体 = 列表.find(a => a.id === 当前ID) || 列表[0];
        if (智能体) {
          选择按钮.innerHTML = `${智能体.icon} ${智能体.name} ▼`;
          更新抽屉头像(智能体);
        }
        // 同时刷新下拉菜单列表
        渲染下拉菜单(列表, 当前ID);
      } catch (e) {
        console.error('[智能体选择器] 更新失败', e);
      }
    };

    // 兼容别名：其他模块调用 window.刷新智能体UI
    window.刷新智能体UI = window.更新智能体选择器;

  } catch(e) {
    console.error('[智能体选择器] 创建异常', e);
  }
};

function 更新抽屉头像(智能体) {
  if (!智能体) return;
  // 抽屉头部头像区：有照片优先显示照片，否则用emoji icon
  const 头像区 = document.getElementById('抽屉头像区');
  if (头像区) {
    const 名元素 = document.getElementById('抽屉智能体名');
    const img = document.getElementById('抽屉智能体头像');
    const 占位 = document.getElementById('抽屉头像占位');
    if (智能体.avatar) {
      if (img) { img.src = 智能体.avatar; img.style.display = 'block'; }
      if (占位) 占位.style.display = 'none';
      if (名元素) 名元素.textContent = '';
      头像区.classList.add('has-img');
    } else if (智能体.icon) {
      if (名元素) 名元素.textContent = 智能体.icon;
      if (img) img.style.display = 'none';
      if (占位) 占位.style.display = 'none';
      头像区.classList.remove('has-img');
    }
  }
}

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
  const 打开预览 = function(e) {
    if (e) e.stopPropagation();
    const 配置 = window.获取当前智能体配置 ? window.获取当前智能体配置() : null;
    const 头像源 = 配置?.avatar || 配置?.icon || '🤖';
    const 名称 = 配置?.name || '默认智能体';

    if (头像源.startsWith('http') || 头像源.startsWith('/') || 头像源.startsWith('data:')) {
      预览图片.src = 头像源;
      预览图片.style.display = 'block';
    } else {
      预览图片.style.display = 'none';
    }
    预览名字.textContent = 名称;
    预览浮层.style.display = 'flex';
  };

  头像区.addEventListener('touchend', function(e) {
    e.preventDefault();
    打开预览(e);
  }, { passive: false });
  头像区.addEventListener('click', function(e) {
    打开预览(e);
  });

  // 关闭预览
  if (关闭按钮) {
    关闭按钮.addEventListener('click', function() { 预览浮层.style.display = 'none'; });
  }
  预览浮层.addEventListener('click', function(e) {
    if (e.target === 预览浮层) 预览浮层.style.display = 'none';
  });

  // 更换头像 → 触发文件选择
  if (更换按钮 && 文件选择) {
    更换按钮.addEventListener('click', function(e) {
      e.stopPropagation();
      文件选择.click();
    });
    文件选择.addEventListener('change', async function() {
      const file = 文件选择.files[0];
      if (!file) return;
      try {
        const base64 = await window.裁切图片为正方形(file);
        const 成功 = await window.保存头像(base64);
        if (成功) {
          预览图片.src = base64;
          预览图片.style.display = 'block';
          const 配置 = window.获取当前智能体配置 ? window.获取当前智能体配置() : {};
          配置.avatar = base64;
          if (window.更新抽屉头像) window.更新抽屉头像(配置);
          if (window.更新智能体选择器) window.更新智能体选择器();
        } else {
          if (window._显示提示) window._显示提示('保存头像失败','error');
        }
      } catch(err) {
        console.error('[头像预览] 保存失败', err);
        if (window._显示提示) window._显示提示('保存头像失败','error');
      }
    });
  }
};
