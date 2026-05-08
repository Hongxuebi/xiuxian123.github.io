// 初始化.js - 应用启动入口
window.addEventListener('DOMContentLoaded', async () => {
  // 备忘录标题显隐已改为CSS类控制，无需MutationObserver监控
  // window.当前激活面板 拦截器已移除
  console.log('主入口启动，初始化存储...');
  
  try {
    await window.初始化存储();
    console.log('存储适配器初始化成功');
  } catch (错误) {
    console.error('存储适配器初始化失败', 错误);
    alert('存储初始化失败，应用将无法保存数据');
    return;
  }
  
  try {
    await window.初始化智能体系统();
    console.log('智能体系统初始化成功');
  } catch (错误) {
    console.error('智能体系统初始化失败', 错误);
  }
  
  // 记忆管理由 AI记忆管理器 按需初始化，旧 MemoryManager 已废弃
  
  // 创建智能体选择器（函数在智能体选择器.js中）
  if (window.创建智能体选择器UI) await window.创建智能体选择器UI();
  
  // 绑定各模块事件
  if (window.绑定抽屉事件) window.绑定抽屉事件();
  if (window.绑定标签页切换) window.绑定标签页切换();
  // 初始化面板状态：确保对话面板激活、备忘录标题隐藏
  if (window.切换标签) window.切换标签('对话面板');
  if (window.绑定对话框按钮) window.绑定对话框按钮();
  if (window.绑定抽屉底部按钮) window.绑定抽屉底部按钮();
  if (window.绑定文件上传事件) window.绑定文件上传事件();
  if (window.绑定更多菜单) window.绑定更多菜单();
  if (window.绑定设置浮层) window.绑定设置浮层();
  if (window.绑定添加智能体浮层) window.绑定添加智能体浮层();
  if (window.绑定头像预览) window.绑定头像预览();
  if (window.绑定备忘录UI) window.绑定备忘录UI();
  
  // 显示智能体选择器（默认对话面板激活）
  const 智能体选择器 = document.querySelector('.智能体选择器');
  if (智能体选择器) 智能体选择器.style.display = 'block';
  
  // 初始化备忘录管理（核心数据）
  try {
    if (window.初始化备忘录管理) {
      window.初始化备忘录管理();
      console.log('备忘录管理初始化成功');
    }
    // 初始化备忘录管理器（IndexedDB持久化 + AI工具）
    if (window.MemoManager) {
      const 备忘录管理器 = new MemoManager();
      console.log('[初始化] 开始加载备忘录管理器...');
      await 备忘录管理器.init(window.storage);
      console.log(`[初始化] 备忘录管理器加载完成，memos 数量: ${备忘录管理器.memos.length}`);
      // 从旧内存数据迁移（首次运行一次性）
      await 备忘录管理器.migrateFromMemory();
      console.log(`[初始化] 迁移完成，memos 数量: ${备忘录管理器.memos.length}`);
      await 备忘录管理器.补充历史元数据();
      console.log(`[初始化] 历史元数据补充完成`);
      window.备忘录管理器 = 备忘录管理器;
      console.log('备忘录管理器（AI联动）初始化完成');
      
      // 强制刷新 UI
      if (window.渲染备忘录列表) {
        window.渲染备忘录列表();
        console.log('[初始化] 已触发备忘录列表渲染');
      }
      if (window.渲染文件夹树) {
        window.渲染文件夹树();
        console.log('[初始化] 已触发文件夹树渲染');
      }

    }
  } catch (错误) {
    console.error('备忘录管理初始化失败', 错误);
  }

  // 初始化对话记忆：从IndexedDB恢复历史 + 预热记忆索引
  try {
    if (window.加载智能体会话列表) {
      const 当前智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
      window.加载智能体会话列表(当前智能体ID);
    }
    if (window.加载对话历史) {
      // 先从 localStorage 恢复上次的会话ID
      const 智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
      const 上次会话ID = localStorage.getItem('最近会话ID_' + 智能体ID);
      const 会话ID = 上次会话ID || (window.当前会话ID ? window.当前会话ID() : 'default');
      console.log('[初始化] 恢复会话:', 会话ID);
      // 先切换会话，确保 当前会话ID 同步
      if (window.切换会话) {
        await window.切换会话(会话ID);
      } else {
        await window.加载对话历史(会话ID);
        const 消息 = window.当前对话历史 || [];
        消息.forEach(m => {
          if (window.添加消息到界面) {
            window.添加消息到界面(
              m.role === 'user' ? '用户' : '助理',
              m.content
            );
          }
        });
      }
      console.log('[初始化] 对话历史恢复完成，共', (window.当前对话历史 || []).length, '条');
    }
    // 确保会话列表已渲染（模块初始化时的渲染可能早于智能体初始化）
    if (window.渲染会话列表) window.渲染会话列表();
  } catch (错误) {
    console.error('[初始化] 恢复对话历史失败', 错误);
    // 提供用户反馈
    if (错误.message) {
      console.warn('对话历史恢复失败原因:', 错误.message);
    }
  }

  // 注册存储错误监听（IndexedDB 配额不足提示）
  window.addEventListener('存储错误', (e) => {
    const { message } = e.detail || {};
    if (message && window.添加消息到界面) {
      window.添加消息到界面?.('助理', `⚠️ ${message}\n\n建议：导出备份旧会话后，在设置中删除不必要的会话以释放空间。`);
    }
  });

  console.log('主入口初始化完成');

  // 注册周报定时器（每周日 22:00 自动生成周报）
  if (window.注册周报定时器) {
    window.注册周报定时器();
    console.log('[初始化] 周报定时器已注册');
  }

  // 数据备份：绑定按钮 + 刷新状态 + 注册自动备份
  if (window.绑定备份按钮) {
    window.绑定备份按钮();
  }
  if (window.备份_刷新显示状态) {
    window.备份_刷新显示状态();
  }
  if (window.注册自动备份) {
    window.注册自动备份();
    console.log('[初始化] 自动备份已注册');
  }

  // === P1-2: 断网提示条 ===
  // 创建顶部提示条（默认隐藏）
  const 网络提示条 = document.createElement('div');
  网络提示条.id = '网络状态提示条';
  网络提示条.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#e74c3c;color:#fff;text-align:center;padding:8px 16px;font-size:14px;display:none;';
  网络提示条.textContent = '网络连接已断开，部分功能不可用';
  document.body.appendChild(网络提示条);

  function 更新网络状态() {
    if (navigator.onLine) {
      网络提示条.style.display = 'none';
    } else {
      网络提示条.style.display = 'block';
    }
  }
  window.addEventListener('online', 更新网络状态);
  window.addEventListener('offline', 更新网络状态);
  // 初始检测
  更新网络状态();

  // === P1-3: 首次使用 Key 引导 ===
  // 检测 API Key 是否为空且对话区无内容，显示引导消息
  setTimeout(() => {
    const apiKey = localStorage.getItem('deepseek_api_key') || '';
    const 对话区 = document.getElementById('对话消息区');
    const 无对话 = !对话区 || 对话区.children.length === 0;
    if (!apiKey.trim() && 无对话 && window.添加消息到界面) {
      window.添加消息到界面('助理', '👋 欢迎使用爱助手！请先点击右上角 ☰ 打开侧栏，进入「设置」配置 API 密钥，然后我就可以为你服务了。');
    }
  }, 800);

  // === 联网搜索开关 ===
  // 开关始终可点击，用户自行决定是否启用
  // （之前按百度Key有无设disabled，但Key可能存在而JS读取时机不对，导致开关永远灰色）
  const 开关 = document.getElementById('联网搜索开关');
  if (开关) 开关.disabled = false;

  // === 隐藏启动 loading ===
  const 启动loading = document.getElementById('启动loading');
  if (启动loading) {
    启动loading.classList.add('隐藏');
    setTimeout(() => 启动loading.remove(), 400);
  }
});

// === 自定义输入对话框（替代 prompt()，兼容鸿蒙 WebView） ===
window._自定义输入 = function(提示文字, 默认值) {
  return new Promise((resolve) => {
    const 遮罩 = document.createElement('div');
    遮罩.className = '自定义输入遮罩';
    遮罩.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

    const 对话框 = document.createElement('div');
    对话框.style.cssText = 'background:var(--内容底色,#fff);border-radius:1rem;padding:1.5rem;width:85%;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.2);';

    const 提示 = document.createElement('div');
    提示.textContent = 提示文字;
    提示.style.cssText = 'margin-bottom:1rem;font-size:0.9rem;color:var(--文字主色,#333);white-space:pre-line;line-height:1.5;';

    const 输入框 = document.createElement('input');
    输入框.type = 'text';
    输入框.value = 默认值 || '';
    输入框.style.cssText = 'width:100%;padding:0.6rem;border:1px solid var(--边框色,#ddd);border-radius:0.5rem;font-size:1rem;box-sizing:border-box;outline:none;background:var(--背景色,#f9f9f9);color:var(--文字主色,#333);';
    输入框.addEventListener('focus', () => { 输入框.style.borderColor = 'var(--强调色,#4F46E5)'; });
    输入框.addEventListener('blur', () => { 输入框.style.borderColor = 'var(--边框色,#ddd)'; });

    const 按钮区 = document.createElement('div');
    按钮区.style.cssText = 'display:flex;gap:0.75rem;margin-top:1rem;justify-content:flex-end;';

    const 取消按钮 = document.createElement('button');
    取消按钮.textContent = '取消';
    取消按钮.style.cssText = 'padding:0.5rem 1.2rem;border:1px solid var(--边框色,#ddd);border-radius:0.5rem;background:var(--内容底色,#fff);color:var(--文字主色,#333);cursor:pointer;font-size:0.9rem;';

    const 确认按钮 = document.createElement('button');
    确认按钮.textContent = '确认';
    确认按钮.style.cssText = 'padding:0.5rem 1.2rem;border:none;border-radius:0.5rem;background:var(--强调色,#4F46E5);color:#fff;cursor:pointer;font-size:0.9rem;';

    const 关闭 = (值) => { 遮罩.remove(); resolve(值); };
    取消按钮.onclick = () => 关闭(null);
    确认按钮.onclick = () => 关闭(输入框.value);
    输入框.onkeydown = (e) => { if (e.key === 'Enter') 关闭(输入框.value); };
    遮罩.onclick = (e) => { if (e.target === 遮罩) 关闭(null); };

    按钮区.append(取消按钮, 确认按钮);
    对话框.append(提示, 输入框, 按钮区);
    遮罩.append(对话框);
    document.body.append(遮罩);
    setTimeout(() => 输入框.focus(), 100);
  });
};

window._自定义确认 = function(提示文字, 确认按钮文字 = '确定', 取消按钮文字 = '取消') {
  return new Promise((resolve) => {
    const 遮罩 = document.createElement('div');
    遮罩.className = '自定义确认遮罩';
    遮罩.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

    const 对话框 = document.createElement('div');
    对话框.style.cssText = 'background:var(--内容底色,#fff);border-radius:1rem;padding:1.5rem;width:85%;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.2);';

    const 提示 = document.createElement('div');
    提示.textContent = 提示文字;
    提示.style.cssText = 'font-size:0.9rem;color:var(--文字主色,#333);white-space:pre-line;line-height:1.5;margin-bottom:1.2rem;';

    const 按钮区 = document.createElement('div');
    按钮区.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end;';

    const 取消按钮 = document.createElement('button');
    取消按钮.textContent = 取消按钮文字;
    取消按钮.style.cssText = 'padding:0.5rem 1.2rem;border:1px solid var(--边框色,#ddd);border-radius:0.5rem;background:var(--内容底色,#fff);color:var(--文字主色,#333);cursor:pointer;font-size:0.9rem;';

    const 确认按钮 = document.createElement('button');
    确认按钮.textContent = 确认按钮文字;
    确认按钮.style.cssText = 'padding:0.5rem 1.2rem;border:none;border-radius:0.5rem;background:#dc2626;color:#fff;cursor:pointer;font-size:0.9rem;';

    const 关闭 = (值) => { 遮罩.remove(); resolve(值); };
    取消按钮.onclick = () => 关闭(false);
    确认按钮.onclick = () => 关闭(true);
    遮罩.onclick = (e) => { if (e.target === 遮罩) 关闭(false); };

    按钮区.append(取消按钮, 确认按钮);
    对话框.append(提示, 按钮区);
    遮罩.append(对话框);
    document.body.append(遮罩);
    确认按钮.focus();
  });
};