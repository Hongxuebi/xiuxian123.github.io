// 设置浮层.js - 设置浮层交互（含流式输出开关）

window.绑定设置浮层 = function() {

  // 刷新主题选择器选项（AI创建主题后调用）
  window.刷新主题选择器 = function() {
    const 主题选择器 = document.getElementById('主题选择');
    if (!主题选择器) return;
    const 当前值 = 主题选择器.value;
    主题选择器.innerHTML = '';
    Object.keys(window.主题配置 || {}).forEach(名称 => {
      const opt = document.createElement('option');
      opt.value = 名称;
      opt.textContent = 名称;
      主题选择器.appendChild(opt);
    });
    主题选择器.value = window.全局设置.当前主题 || '清爽白';
  };

  const 浮层 = document.getElementById('设置浮层');
  const 关闭按钮 = document.getElementById('关闭设置按钮');
  if (!浮层) return;
  
  if (关闭按钮) {
    关闭按钮.addEventListener('click', () => {
      浮层.style.display = 'none';
      if (window._解锁滚动) window._解锁滚动();
    });
  }
  浮层.addEventListener('click', (e) => {
    if (e.target === 浮层) {
      浮层.style.display = 'none';
      if (window._解锁滚动) window._解锁滚动();
    }
  });
  
  // 主题选择器
  const 主题选择器 = document.getElementById('主题选择');
  if (主题选择器) {
    主题选择器.addEventListener('change', function() {
      if (this.value && window.切换主题) {
        window.切换主题(this.value);
      }
    });
  }
  
  // API密钥保存
  const API密钥输入 = document.getElementById('API密钥输入');
  const 百度搜索密钥输入 = document.getElementById('百度搜索密钥输入');
  const 保存API密钥按钮 = document.getElementById('保存API密钥按钮');
  if (API密钥输入 && 保存API密钥按钮) {
    API密钥输入.value = window.全局设置.API密钥;
    if (百度搜索密钥输入) {
      百度搜索密钥输入.value = window.全局设置.百度搜索密钥 || '';
    }
    保存API密钥按钮.addEventListener('click', function() {
      window.校验并保存API密钥(API密钥输入, 百度搜索密钥输入);
    });
  }
  
  // 初始化主题选择器选项（覆盖写死的HTML option）
  if (window.刷新主题选择器) {
    setTimeout(() => window.刷新主题选择器(), 0);
  }

  // ========== 人物关系映射编辑 ==========
  const 映射编辑框 = document.getElementById('关系映射编辑框');
  const 保存映射按钮 = document.getElementById('保存关系映射按钮');
  const 映射状态 = document.getElementById('关系映射状态');

  function 加载关系映射到编辑框() {
    const 用户映射 = window.获取用户关系映射 ? window.获取用户关系映射() : {};
    const 行 = Object.entries(用户映射).map(([词, 类别]) => 词 + ' → ' + 类别);
    映射编辑框.value = 行.join('\n');
  }

  function 保存关系映射() {
    const 文本 = 映射编辑框.value.trim();
    const 映射 = {};
    for (const 行 of 文本.split('\n')) {
      const t = 行.trim();
      if (!t) continue;
      // 支持 → 和 : 两种分隔符
      const 匹配 = t.match(/^(.+?)\s*[→:]\s*(.+)$/);
      if (匹配) {
        映射[匹配[1].trim()] = 匹配[2].trim();
      }
    }
    if (window.保存用户关系映射 && window.保存用户关系映射(映射)) {
      // 通知对话管理.js 重新加载
      if (window._重新加载关系映射) window._重新加载关系映射();
      映射状态.textContent = '✅ 已保存（' + Object.keys(映射).length + ' 条自定义映射）';
      setTimeout(() => { 映射状态.textContent = ''; }, 3000);
    } else {
      映射状态.textContent = '❌ 保存失败';
    }
  }

  if (映射编辑框 && 保存映射按钮) {
    加载关系映射到编辑框();
    保存映射按钮.addEventListener('click', 保存关系映射);
  }

  // ========== 新增：流式输出开关 ==========
  const 流式开关 = document.getElementById('流式输出开关');
  if (流式开关) {
    流式开关.checked = window.全局设置.启用流式输出 || false;
    流式开关.addEventListener('change', function() {
      window.全局设置.启用流式输出 = this.checked;
      window.保存设置();
      if (this.checked) {
        window._显示提示('已开启流式输出','info');
      } else {
        window._显示提示('已关闭流式输出','info');
      }
    });
  }

  // ========== 新增：字体大小滑条 ==========
  const 字体滑条 = document.getElementById('字体大小滑条');
  const 比例显示 = document.getElementById('字体大小比例显示');
  const 预览正文 = document.getElementById('字体大小预览正文');
  if (字体滑条) {
    // 初始化
    const 初始值 = window.全局设置.字体缩放比例 || 1;
    字体滑条.value = 初始值;
    更新字体比例显示(初始值);

    字体滑条.addEventListener('input', function() {
      const 比例 = parseFloat(this.value);
      更新字体比例显示(比例);
    });

    字体滑条.addEventListener('change', function() {
      const 比例 = parseFloat(this.value);
      window.全局设置.字体缩放比例 = 比例;
      document.documentElement.style.fontSize = (16 * 比例) + 'px';
      document.documentElement.style.setProperty('--文字缩放比例', 比例);
      window.保存设置();
      window._显示提示('字体大小已调整为 ' + 获取比例标签(比例), 'info');
    });
  }

  function 获取比例标签(比例) {
    if (比例 <= 0.8) return '小';
    if (比例 >= 1.25) return '大';
    if (比例 <= 0.9) return '偏小';
    if (比例 >= 1.1) return '偏大';
    return '标准';
  }

  function 更新字体比例显示(比例) {
    const 标签 = 获取比例标签(比例);
    if (比例显示) 比例显示.textContent = 标签;
    if (预览正文) {
      预览正文.style.fontSize = 'calc(0.875rem * ' + 比例 + ')';
    }
  }
};