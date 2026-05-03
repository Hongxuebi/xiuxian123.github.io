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
    关闭按钮.addEventListener('click', () => { 浮层.style.display = 'none'; });
  }
  浮层.addEventListener('click', (e) => {
    if (e.target === 浮层) 浮层.style.display = 'none';
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
        alert('✅ 已开启流式输出，后续对话将实时显示回复内容（函数调用将被暂时禁用）');
      } else {
        alert('✅ 已关闭流式输出，将使用标准模式（支持函数调用）');
      }
    });
  }
};