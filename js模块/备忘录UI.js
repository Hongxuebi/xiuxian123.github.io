// 备忘录UI.js - 备忘录面板的UI事件（新建、返回、保存、文件夹选择等）
window.绑定备忘录UI = function() {
  const 顶部栏 = document.querySelector('.顶部栏');
  
  // 辅助函数：清空编辑页面并进入新建模式
  function 准备新建备忘录() {
    const 标题输入 = document.getElementById('编辑标题');
    const 内容输入 = document.getElementById('编辑内容');
    if (标题输入) 标题输入.value = '';
    if (内容输入) 内容输入.textContent = '';
    window.当前编辑备忘录ID = null;
    const 当前文件夹名称Span = document.getElementById('当前文件夹名称');
    if (当前文件夹名称Span) 当前文件夹名称Span.textContent = '默认';
    const 时间戳元素 = document.getElementById('编辑时间戳');
    if (时间戳元素) {
      const 当前时间 = new Date();
      const 时间字符串 = 当前时间.toISOString().slice(0, 10);
      时间戳元素.textContent = 时间字符串;
    }
  }
  
  // ========== AI整理确认卡片 ==========
  window.显示整理确认卡片 = function() {
    const 已有 = document.getElementById('整理确认卡片');
    if (已有) 已有.remove();
    const 遮罩 = document.createElement('div');
    遮罩.id = '整理确认卡片';
    遮罩.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99998;display:flex;align-items:center;justify-content:center;';
    遮罩.onclick = (e) => { if (e.target === 遮罩) { 遮罩.remove(); if (window._解锁滚动) window._解锁滚动(); } };
    const 卡片 = document.createElement('div');
    卡片.style.cssText = 'background:var(--背景色, white);border-radius:16px;padding:24px;max-width:320px;width:85%;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
    卡片.onclick = (e) => e.stopPropagation();
    卡片.innerHTML = `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:32px;margin-bottom:8px;">🤖</div>
        <div style="font-size:16px;font-weight:600;color:var(--文字主色);">AI 整理备忘录</div>
      </div>
      <div style="font-size:13px;color:var(--文字副色);line-height:1.6;margin-bottom:20px;">
        将一次性整理全部备忘录的<strong>标签、文件夹分类和摘要</strong>。此操作较耗时，功能测试中，可能存在整理失败的情况。
      </div>
      <div style="display:flex;gap:10px;">
        <button id="整理确认取消" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--边框色);background:transparent;color:var(--文字主色);font-size:14px;cursor:pointer;font-weight:500;">取消</button>
        <button id="整理确认开始" style="flex:1;padding:10px;border-radius:10px;border:none;background:#4a90d9;color:white;font-size:14px;cursor:pointer;font-weight:600;">开始整理</button>
      </div>
    `;
    遮罩.appendChild(卡片);
    document.body.appendChild(遮罩);
    if (window._锁定滚动) window._锁定滚动();
    document.getElementById('整理确认取消').onclick = () => { 遮罩.remove(); if (window._解锁滚动) window._解锁滚动(); };
    document.getElementById('整理确认开始').onclick = async () => {
      遮罩.remove();
      if (window._解锁滚动) window._解锁滚动();
      if (window.开始批量整理) window.开始批量整理();
    };
  };

  // ========== 批量整理入口（按钮和AI工具共用） ==========
  function 开始批量整理() {
    if (!window.备忘录管理器) {
      window._显示提示('备忘录管理器未初始化','error');
      return;
    }

    const 所有备忘录 = window.备忘录管理器.getAllMemos();
    if (所有备忘录.length === 0) {
      window._显示提示('没有可整理的备忘录','info');
      return;
    }

    const 总数 = 所有备忘录.length;
    const 每批上限 = 20;
    const 批次数 = Math.ceil(总数 / 每批上限);

    // 注册离开保护
    注册离开保护();

    // 设置批次状态
    window.整理批次状态 = {
      总数,
      批次数,
      当前列表: 所有备忘录,
      每批上限,
      已完成批次: 0,
      正在进行: true
    };

    // 开始第一批
    执行整理批次(0);
  }

  // 暴露给 AI 工具调用（batch_organize_memos）
  window.开始批量整理 = 开始批量整理;

  // ========== AI整理（从菜单触发，带确认卡片） ==========


  window.开始批量整理 = 开始批量整理;

  async function 执行整理批次(批次索引) {
    const 状态 = window.整理批次状态;
    if (!状态) return;

    const 起始 = 批次索引 * 状态.每批上限;
    const 本批 = 状态.当前列表.slice(起始, 起始 + 状态.每批上限);
    const 是首批 = 批次索引 === 0;
    const 是末批 = 批次索引 === 状态.批次数 - 1;

    // 更新进度条
    更新整理进度(批次索引, 状态.批次数, '处理中');

    // 在对话框显示友好的用户消息（不暴露内部prompt）
    const 批次标记 = 状态.批次数 > 1 ? `（第 ${批次索引 + 1}/${状态.批次数} 批，${本批.length} 条）` : '';
    if (window.添加消息到界面) {
      window.添加消息到界面('用户', `整理备忘录${批次标记}`);
    }

    const 加载元素 = 添加临时加载消息();

    const 上下文 = 是首批
      ? `整理我的备忘录（共${状态.总数}条）${批次标记}`
      : `继续整理备忘录${批次标记}`;

    const 整理提示 = `${上下文}。请逐条分析，对需要优化的备忘录调用 update_memo 工具更新。

【只能做以下3件事，绝对禁止修改原文内容】
1. **改动标签**：补充或修正标签（最多3个，每个2-4字），标签应准确概括备忘录主题
2. **移动文件夹**：将备忘录移到更合适的文件夹。⚠️必须先调用 get_folder_tree 获取文件夹树，只能从返回的文件夹中选择，绝对不允许使用文件夹树中不存在的文件夹名。如果觉得需要新文件夹，先用 create_folder 创建。
3. **添加摘要**：如果内容超过50字，在原文开头添加一行【摘要：xxx】（xxx不超过20字），原文内容一个字都不许改

【update_memo 参数说明】
- 备忘录ID（必须）、标题（不要改）、内容（仅可在原文前添加【摘要：xxx】\\n）、标签（可选）、文件夹（可选）
- 不需要更新的备忘录不要调用工具，直接跳过

【备忘录列表】（格式：ID | 标题 | 文件夹 | 标签 | 内容前150字）
${本批.map(m => `${m.id} | ${m.标题} | ${m.文件夹 || '默认'} | ${(m.标签 || []).join(',')} | ${(m.内容 || '').replace(/<[^>]+>/g, '').substring(0, 80)}`).join('\n')}

【效率要求】
- 每轮必须同时更新2-3条备忘录（调用多个update_memo），不要每轮只更新1条
- 已更新的备忘录不要再用read_memos验证，直接跳过
- 不需要更新的直接跳过，不要调用任何工具

请开始整理。`;

    try {
      // 直接调API，不走发送消息，避免暴露原始prompt
      const 系统提示词 = window.获取当前系统提示词 ? window.获取当前系统提示词() : '';
      const 消息列表 = [
        { role: 'system', content: 系统提示词 },
        { role: 'user', content: 整理提示 }
      ];

      // 每批30条最多需要20轮（先查文件夹树1轮 + 每轮更新多条）
      const 最大轮次 = Math.max(8, Math.ceil(本批.length / 4) + 2);
      const 状态回调 = (文本) => 更新加载状态(文本);

      const 结果 = await window.调用API(消息列表, 0, 状态回调, 最大轮次);
      移除加载消息(加载元素);

      const 回复内容 = typeof 结果 === 'string' ? 结果 : (结果.content || '');
      // 统计本批整理了多少条（通过界面消息统计工具调用次数）
      const 整理摘要 = `✅ 第 ${批次索引 + 1}/${状态.批次数} 批整理完成（${本批.length} 条）`;
      if (window.添加消息到界面) {
        window.添加消息到界面('助理', 整理摘要);
      }
      console.log(`[批量整理] ${整理摘要}, AI回复长度: ${回复内容.length}字`);

    } catch (错误) {
      移除加载消息(加载元素);
      if (window.添加消息到界面) {
        window.添加消息到界面('助理', '❌ 整理失败：' + (错误.message || '请检查网络和API配置'));
      }
    }

    状态.已完成批次 = 批次索引 + 1;

    if (是末批) {
      更新整理进度(状态.批次数, 状态.批次数, '已完成');
      window.整理批次状态.正在进行 = false;
      注销离开保护();
    } else {
      更新整理进度(批次索引 + 1, 状态.批次数, '等待确认');
      显示继续整理按钮(批次索引 + 1);
    }
  }

  function 更新整理进度(已完成, 总批次, 状态文字) {
    const 消息列表 = document.getElementById('消息列表');
    if (!消息列表) return;

    // 查找或创建进度元素
    let 进度条 = document.getElementById('整理进度条');
    if (!进度条) {
      进度条 = document.createElement('div');
      进度条.id = '整理进度条';
      进度条.style.cssText = 'position:sticky;top:0;z-index:10;background:linear-gradient(90deg,#f3e8ff,#ede9fe);padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:0.8rem;color:#6d28d9;display:flex;align-items:center;gap:8px;';
      消息列表.prepend(进度条);
    }

    const 百分比 = Math.round((已完成 / 总批次) * 100);
    进度条.innerHTML = `
      <div style="flex:1;">
        <div style="margin-bottom:4px;">整理进度：${已完成}/${总批次} 批 ${状态文字 !== '已完成' ? `— ${状态文字}` : ' ✅'}</div>
        <div style="background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;">
          <div style="background:#8b5cf6;height:100%;width:${百分比}%;transition:width 0.3s;border-radius:4px;"></div>
        </div>
      </div>`;

    if (状态文字 === '已完成') {
      setTimeout(() => { 进度条.style.opacity = '0'; setTimeout(() => 进度条.remove(), 500); }, 3000);
    }
  }

  function 显示继续整理按钮(下一批索引) {
    const 消息列表 = document.getElementById('消息列表');
    if (!消息列表) return;

    const 按钮 = document.createElement('div');
    按钮.id = '继续整理按钮容器';
    按钮.style.cssText = 'margin:8px 0;text-align:center;';
    按钮.innerHTML = `<button id="继续整理按钮" style="background:#8b5cf6;color:white;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:0.85rem;">▶ 继续整理下一批</button>`;
    消息列表.appendChild(按钮);
    消息列表.scrollTop = 消息列表.scrollHeight;

    document.getElementById('继续整理按钮').addEventListener('click', async () => {
      按钮.remove();
      await 执行整理批次(下一批索引);
    });
  }

  function 注册离开保护() {
    window._整理离开处理 = (e) => {
      if (window.整理批次状态?.正在进行) {
        e.preventDefault();
        e.returnValue = '整理正在进行中，已完成的批次已保存。确定离开吗？';
      }
    };
    window.addEventListener('beforeunload', window._整理离开处理);
  }

  function 注销离开保护() {
    if (window._整理离开处理) {
      window.removeEventListener('beforeunload', window._整理离开处理);
      window._整理离开处理 = null;
    }
  }

  // 暴露到window供API调用.js的批量整理工具使用
  window.执行整理批次 = 执行整理批次;
  window.注册离开保护 = 注册离开保护;
  window.注销离开保护 = 注销离开保护;
  window._当前日期筛选 = () => 当前日期筛选;
  window._设置当前日期筛选 = (v) => { 当前日期筛选 = v; };
  // 标签筛选状态
  let 当前标签筛选 = null;
  window._当前标签筛选 = () => 当前标签筛选;
  window._设置当前标签筛选 = (v) => { 当前标签筛选 = v; };
  window._日期分组菜单已展开 = () => 日期分组菜单已展开;
  window._获取日期分组树HTML = 生成日期分组树HTML;
  window._进入日期筛选模式 = function(year, month) {
    当前日期筛选 = { year, month };
    if (window._设置当前文件夹) window._设置当前文件夹('__date-group__');
    if (window.渲染备忘录列表) window.渲染备忘录列表();
    if (window.渲染文件夹树) window.渲染文件夹树();
  };
  
  // 编辑页面AI整理按钮：整理当前正在编辑的备忘录
  const 编辑页面AI整理按钮 = document.getElementById('编辑页面AI整理按钮');
  if (编辑页面AI整理按钮) {
    编辑页面AI整理按钮.addEventListener('click', async () => {
      const 标题 = document.getElementById('编辑标题').value.trim();
      const 内容 = document.getElementById('编辑内容').innerHTML;
      const 当前文件夹 = document.getElementById('当前文件夹名称').textContent;
      
      if (!标题 && !内容) {
        window._显示提示('没有内容可整理','info');
        return;
      }
      
      // 如果没有保存过（新建中），先保存
      let 当前备忘录ID = window.当前编辑备忘录ID;
      if (!当前备忘录ID) {
        if (!标题) {
          window._显示提示('请先输入标题再使用AI整理','info');
          return;
        }
        // 先保存到默认文件夹
        if (window.备忘录管理器) {
          const 新建 = await window.备忘录管理器.createMemo({
            标题,
            内容,
            文件夹: '未分类',
            标签: []
          });
          当前备忘录ID = 新建.id;
          window.当前编辑备忘录ID = 当前备忘录ID;
          window._显示提示('已保存到「未分类」文件夹，开始AI整理...','info');
        } else {
          window._显示提示('备忘录管理器未初始化','error');
          return;
        }
      }
      
      // 切换到对话面板
      if (window.切换标签) window.切换标签('对话面板');
      const 顶部栏 = document.querySelector('.顶部栏');
      if (顶部栏) 顶部栏.style.display = 'flex';
      
      // 构造整理请求，使用新的 organize_memo 工具
      const 整理请求 = `帮我整理这条备忘录（ID: ${当前备忘录ID}）。

当前信息：
- 标题：${标题 || '（无标题）'}
- 当前文件夹：${当前文件夹}
- 内容：${内容.substring(0, 500)}${内容.length > 500 ? '...' : ''}

请分析内容，调用 organize_memo 工具进行整理：
- 备忘录ID：${当前备忘录ID}
- 建议标题：优化后的标题
- 建议标签：["标签1", "标签2"]（最多3个）
- 建议文件夹：推荐最合适的文件夹名称
- 是否需要新建文件夹：如果推荐的新文件夹不存在，设为true
- 新建文件夹的父文件夹：如果要新建，建议放在哪个父文件夹下（可选）

系统会自动询问用户是否创建新文件夹。只需要调用一次 organize_memo。`;
      
      if (window.发送消息) {
        window.发送消息(整理请求);
      }
    });
  }
  
  // 空状态新建按钮
  const 空状态新按钮 = document.getElementById('空状态新建按钮');
  if (空状态新按钮) {
    空状态新按钮.addEventListener('click', () => {
      准备新建备忘录();
      const 编辑页面 = document.getElementById('编辑页面');
      const 备忘录面板 = document.getElementById('备忘录面板');
      if (编辑页面 && 备忘录面板) {
        备忘录面板.classList.remove('激活');
        编辑页面.classList.add('激活');
        if (顶部栏) 顶部栏.style.display = 'none';
        if (window.切换标签) window.切换标签('编辑页面');
      }
    });
  }

  // 悬浮新建按钮
  const 悬浮新建按钮 = document.getElementById('悬浮新建按钮');
  if (悬浮新建按钮) {
    悬浮新建按钮.addEventListener('click', () => {
      准备新建备忘录();
      const 编辑页面 = document.getElementById('编辑页面');
      const 备忘录面板 = document.getElementById('备忘录面板');
      if (编辑页面 && 备忘录面板) {
        备忘录面板.classList.remove('激活');
        编辑页面.classList.add('激活');
        if (顶部栏) 顶部栏.style.display = 'none';
        if (window.切换标签) window.切换标签('编辑页面');
      }
    });
  }
  
  // 返回按钮
  const 返回按钮 = document.getElementById('返回按钮');
  if (返回按钮) {
    返回按钮.addEventListener('click', () => {
      const 编辑页面 = document.getElementById('编辑页面');
      const 备忘录面板 = document.getElementById('备忘录面板');
      if (编辑页面 && 备忘录面板) {
        编辑页面.classList.remove('激活');
        备忘录面板.classList.add('激活');
        if (顶部栏) 顶部栏.style.display = 'flex';
        if (window.切换标签) window.切换标签('备忘录面板');
      }
    });
  }
  
  // 导出当前篇按钮
  const 导出按钮 = document.getElementById('导出当前篇按钮');
  if (导出按钮) {
    导出按钮.addEventListener('click', () => {
      window.导出当前篇?.();
    });
  }

  // 保存按钮
  const 保存按钮 = document.getElementById('保存按钮');
  if (保存按钮) {
    保存按钮.addEventListener('click', () => {
      const 标题 = document.getElementById('编辑标题').value.trim();
      const 内容 = document.getElementById('编辑内容').innerHTML;
      const 文件夹 = document.getElementById('当前文件夹名称').textContent;
      if (!标题) {
        window._显示提示('请输入标题','error');
        return;
      }
      
      // 获取当前备忘录的标签（优先从 UI 直接读取，兜底从数据源）
      let 标签 = [];
      if (window._备忘录数据源) {
        const 原备忘录 = window._备忘录数据源.find(m => m.id === window.当前编辑备忘录ID);
        if (原备忘录 && 原备忘录.标签) 标签 = 原备忘录.标签;
      }
      
      if (window.保存备忘录) {
        window.保存备忘录(标题, 内容, 文件夹, 标签);
      } else {
        console.log('保存备忘录:', { 标题, 内容, 文件夹, 标签 });
        window._显示提示('备忘录已保存','success');
        const 编辑页面 = document.getElementById('编辑页面');
        const 备忘录面板 = document.getElementById('备忘录面板');
        if (编辑页面 && 备忘录面板) {
          编辑页面.classList.remove('激活');
          备忘录面板.classList.add('激活');
          if (顶部栏) 顶部栏.style.display = 'flex';
          if (window.切换标签) window.切换标签('备忘录面板');
        }
      }
    });
  }
  
  // ========== 撤销/重做 ==========
  const 撤销按钮 = document.getElementById('撤销按钮');
  const 重做按钮 = document.getElementById('重做按钮');
  const 编辑内容区 = document.getElementById('编辑内容');
  let 历史栈 = [];
  let 重做栈 = [];
  let _上次内容 = '';

  function 保存历史() {
    const 内容 = 编辑内容区?.innerHTML || '';
    if (内容 !== _上次内容) {
      历史栈.push(_上次内容);
      _上次内容 = 内容;
      重做栈 = []; // 重做栈在新编辑时清空
      if (历史栈.length > 50) 历史栈.shift(); // 最多50步
    }
  }

  function 执行撤销() {
    if (历史栈.length === 0) return;
    重做栈.push(_上次内容);
    _上次内容 = 历史栈.pop();
    编辑内容区.innerHTML = _上次内容;
    触发输入事件();
  }

  function 执行重做() {
    if (重做栈.length === 0) return;
    历史栈.push(_上次内容);
    _上次内容 = 重做栈.pop();
    编辑内容区.innerHTML = _上次内容;
    触发输入事件();
  }

  function 触发输入事件() {
    编辑内容区?.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (编辑内容区) {
    // 初始化上次内容
    _上次内容 = 编辑内容区.innerHTML || '';
    // 内容变化时保存历史
    编辑内容区.addEventListener('input', 保存历史);
  }

  if (撤销按钮) {
    撤销按钮.addEventListener('click', (e) => {
      e.stopPropagation();
      执行撤销();
    });
  }
  if (重做按钮) {
    重做按钮.addEventListener('click', (e) => {
      e.stopPropagation();
      执行重做();
    });
  }
  // 键盘快捷键 Ctrl+Z / Ctrl+Shift+Z
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        执行重做();
      } else {
        e.preventDefault();
        执行撤销();
      }
    }
  });
  
  // 文件夹选择下拉菜单
  const 文件夹选择按钮 = document.getElementById('文件夹选择按钮');
  const 文件夹下拉菜单 = document.getElementById('文件夹下拉菜单');
  if (文件夹选择按钮 && 文件夹下拉菜单) {
    文件夹选择按钮.addEventListener('click', (e) => {
      e.stopPropagation();
      // 从抽屉的文件夹列表读取（动态关联，保持完全一致）
      const 文件夹列表 = window._获取所有文件夹列表 ? window._获取所有文件夹列表() : [];
      // 排除"全部"（这是筛选器，不是可保存的文件夹）
      const 实际文件夹 = 文件夹列表.filter(f => f.名称 !== '全部');
      
      // 当前选中的文件夹（高亮用）
      const 当前选中 = document.getElementById('当前文件夹名称').textContent || '默认';
      
      // 如果当前选中的是预设文件夹但数据中不存在，也要显示它
      const 当前选中存在 = 实际文件夹.some(f => f.名称 === 当前选中);
      let 全部文件夹 = [...实际文件夹.map(f => f.名称)];
      if (!当前选中存在 && 当前选中) {
        全部文件夹.unshift(当前选中); // 把当前选中的放最前面
      }
      // 确保至少有一个"默认"选项
      if (全部文件夹.length === 0) {
        全部文件夹 = ['默认'];
      }
      
      let html = 全部文件夹.map(名称 => `
        <div class="文件夹选项 ${名称 === 当前选中 ? '选中' : ''}" data-folder="${名称}">
          ${名称 === 当前选中 ? '✓ ' : ''}${名称}
        </div>
      `).join('');
      
      // 添加分隔线和"新建文件夹"选项
      html += `
        <div style="border-top: 1px solid #e5e7eb; margin: 4px 0;"></div>
        <div class="文件夹选项 新建文件夹选项" data-action="create-folder">
          <i class="fa fa-plus-circle text-green-500 mr-1"></i> 新建文件夹
        </div>
      `;
      
      文件夹下拉菜单.innerHTML = html;
      
      // 绑定文件夹选择事件
      const 文件夹选项 = 文件夹下拉菜单.querySelectorAll('.文件夹选项:not(.新建文件夹选项)');
      文件夹选项.forEach(选项 => {
        选项.addEventListener('click', (optEvent) => {
          optEvent.stopPropagation();
          const 文件夹名称 = 选项.dataset.folder;
          const 当前文件夹名称Span = document.getElementById('当前文件夹名称');
          if (当前文件夹名称Span) 当前文件夹名称Span.textContent = 文件夹名称;
          文件夹下拉菜单.classList.remove('显示');
          文件夹下拉菜单.classList.remove('显示');
        });
      });
      
      // 绑定"新建文件夹"事件
      const 新建文件夹选项 = 文件夹下拉菜单.querySelector('.新建文件夹选项');
      if (新建文件夹选项) {
        新建文件夹选项.addEventListener('click', async (optEvent) => {
          optEvent.stopPropagation();
          // 用自定义对话框替代 prompt()（鸿蒙 WebView 屏蔽 prompt）
          let 文件夹名称;
          if (window._自定义输入) {
            文件夹名称 = await window._自定义输入('请输入新文件夹名称：');
          } else {
            文件夹名称 = await window._自定义输入('请输入新文件夹名称：');
          }
          if (文件夹名称 && 文件夹名称.trim()) {
            if (window._创建文件夹) {
              const 成功 = window._创建文件夹(文件夹名称.trim(), null);
              if (成功) {
                const 当前文件夹名称Span = document.getElementById('当前文件夹名称');
                if (当前文件夹名称Span) 当前文件夹名称Span.textContent = 文件夹名称.trim();
                if (window.渲染文件夹树) window.渲染文件夹树();
              } else {
                window._显示提示('文件夹已存在或创建失败','error');
              }
            }
          }
          文件夹下拉菜单.classList.remove('显示');
          文件夹下拉菜单.classList.remove('显示');
        });
      }
      const 按钮位置 = 文件夹选择按钮.getBoundingClientRect();
      // 只设置动态定位（top/left随按钮位置变化），样式全部由CSS class控制
      文件夹下拉菜单.style.top = (按钮位置.top + 按钮位置.height + 10) + 'px';
      文件夹下拉菜单.style.left = 按钮位置.left + 'px';
      文件夹下拉菜单.classList.add('显示');
    });
    document.addEventListener('click', (e) => {
      if (!文件夹选择按钮.contains(e.target) && !文件夹下拉菜单.contains(e.target)) {
        文件夹下拉菜单.classList.remove('显示');
        文件夹下拉菜单.classList.remove('显示');
      }
    });
    文件夹下拉菜单.addEventListener('click', (e) => e.stopPropagation());
  }
  
  // 暴露给鸿蒙返回手势
  window.关闭文件夹下拉菜单 = function() {
    if (文件夹下拉菜单) {
      文件夹下拉菜单.classList.remove('显示');
      // 清除动态定位（top/left随按钮位置变化，关闭后需要重置）
      文件夹下拉菜单.style.top = '';
      文件夹下拉菜单.style.left = '';
    }
  };
  window.关闭全局浮动菜单 = function() { var m = document.getElementById('全局浮动菜单'); if (m) m.classList.remove('显示'); };

  // ===== 标签管理（微信风格独立页面） =====
  const 标签按钮 = document.getElementById('标签按钮');
  const 标签选择页 = document.getElementById('标签选择页');
  const 关闭标签页 = document.getElementById('关闭标签页');
  const 确认标签选择 = document.getElementById('确认标签选择');
  const 标签搜索框 = document.getElementById('标签搜索框');
  const 已选标签列表 = document.getElementById('已选标签列表');
  const 标签卡片容器 = document.getElementById('标签卡片容器');
  const 标签列表容器 = document.getElementById('标签列表容器');
  const 编辑标签按钮 = document.getElementById('编辑标签按钮');
  const 新建标签按钮 = document.getElementById('新建标签按钮');

  let 标签列表编辑模式 = false;

  // 更新按钮上已选标签数角标
  function 更新已选标签数() {
    const 当前ID = window.当前编辑备忘录ID;
    const 当前标签 = window._获取当前备忘录标签(当前ID) || [];
    const 角标 = document.getElementById('已选标签数');
    if (!角标) return;
    if (当前标签.length > 0) {
      角标.textContent = 当前标签.length;
      角标.style.display = 'inline-flex';
    } else {
      角标.style.display = 'none';
    }
  }

  // 获取标签计数
  function _获取标签计数() {
    const 数据源 = window._备忘录数据源 || window.备忘录管理器?.memos || [];
    const 计数 = {};
    数据源.forEach(m => {
      if (m.标签 && Array.isArray(m.标签)) {
        m.标签.forEach(t => { 计数[t] = (计数[t] || 0) + 1; });
      }
    });
    return 计数;
  }

  // 已选标签缓存，确保渲染和操作用同一份数据
  let 标签已选缓存 = [];

  // 渲染已选标签胶囊
  function 渲染已选胶囊() {
    const 当前ID = window.当前编辑备忘录ID;
    const 当前标签 = 标签已选缓存.length > 0 ? 标签已选缓存 : (window._获取当前备忘录标签(当前ID) || []);
    if (!已选标签列表) return;
    const 数量提示 = 当前标签.length > 0 ? `<span class="已选标签计数">已选${当前标签.length}个</span>` : '';
    已选标签列表.innerHTML = 数量提示 + 当前标签.map(t => {
      const 编码 = encodeURIComponent(t);
      return `<span class="标签选择页已选胶囊" data-tag="${编码}">${escapeHtml(t)}<span class="删除叉" data-tag="${编码}"></span></span>`;
    }).join('');
  }

  // 渲染卡片区
  function 渲染标签卡片(搜索词) {
    const 当前标签 = 标签已选缓存.length > 0 ? 标签已选缓存 : (window._获取当前备忘录标签(window.当前编辑备忘录ID) || []);
    const 所有标签 = window._获取所有已用标签() || [];
    const 计数 = _获取标签计数();
    const 关键词 = (搜索词 || '').trim().toLowerCase();
    let 过滤 = 所有标签;
    if (关键词) 过滤 = 所有标签.filter(t => t.toLowerCase().includes(关键词));
    if (!标签卡片容器) return;
    标签卡片容器.innerHTML = 过滤.map(t => {
      const 已选 = 当前标签.includes(t);
      return `<span class="标签卡 ${已选 ? '已选' : ''}" data-tag="${encodeURIComponent(t)}">${escapeHtml(t)} ${已选 ? '<span class="勾角标"></span>' : ''}</span>`;
    }).join('');
    if (过滤.length === 0) {
      标签卡片容器.innerHTML = '<div style="padding:16px;text-align:center;color:#BBB;width:100%">暂无标签</div>';
    }
  }

  // 渲染列表区（编辑模式）
  function 渲染标签列表() {
    const 计数 = _获取标签计数();
    const 所有标签 = window._获取所有已用标签() || [];
    if (!标签列表容器) return;
    标签列表容器.innerHTML = 所有标签.map(t => {
      const 编码 = encodeURIComponent(t);
      return `<div class="标签列表项" data-tag="${编码}"><span>${escapeHtml(t)}</span><span class="计数">${计数[t] || 0}</span></div>`;
    }).join('');
  }

  // 打开标签选择页
  function 打开标签选择页() {
    if (!标签选择页) return;
    标签列表编辑模式 = false;
    // 初始化缓存
    标签已选缓存 = window._获取当前备忘录标签(window.当前编辑备忘录ID) || [];
    _标签页当前标签 = [...标签已选缓存];
    if (编辑标签按钮) 编辑标签按钮.textContent = '编辑';
    if (标签卡片容器) 标签卡片容器.style.display = '';
    if (标签列表容器) 标签列表容器.style.display = 'none';
    更新已选标签数();
    渲染已选胶囊();
    if (标签搜索框) 标签搜索框.value = '';
    渲染标签卡片();
    渲染标签列表();
    标签选择页.style.display = '';
    setTimeout(() => 标签搜索框?.focus(), 100);
  }

  function 关闭标签选择页() {
    if (标签选择页) 标签选择页.style.display = 'none';
  }

  // 切换标签选中状态（直接传标签数组，不依赖数据源读取）
  let _标签页当前标签 = window._获取当前备忘录标签(window.当前编辑备忘录ID) || [];
  function 切换标签选中(标签原始) {
    const 标签 = decodeURIComponent(标签原始);
    if (_标签页当前标签.includes(标签)) {
      _标签页当前标签 = _标签页当前标签.filter(t => t !== 标签);
    } else {
      // 用户手动添加不限制数量
      _标签页当前标签 = [..._标签页当前标签, 标签];
    }
    // 更新数据源（内存）
    const 当前ID = window.当前编辑备忘录ID;
    const 数据源 = window._备忘录数据源 || [];
    const memo = 数据源.find(m => m.id === 当前ID);
    if (memo) {
      memo.标签 = _标签页当前标签;
    } else if (window.备忘录管理器?.memos) {
      const m = window.备忘录管理器.memos.find(m => m.id === 当前ID);
      if (m) m.标签 = _标签页当前标签;
    }
    // 持久化到 IndexedDB
    if (window.备忘录管理器 && 当前ID) {
      window.备忘录管理器.updateMemo(当前ID, { 标签: _标签页当前标签 }).catch(err => {
        console.error('[切换标签选中] 持久化失败', err);
      });
    }
    // 刷新 UI（直接用内存状态，不重新读数据源）
    更新已选标签数();
    标签已选缓存 = _标签页当前标签;
    渲染已选胶囊();
    渲染标签卡片(标签搜索框?.value);
    const 编辑内容区 = document.getElementById('编辑内容');
    编辑内容区?.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 删除标签（全局）
  async function 全局删除标签(标签原始) {
    const 标签 = decodeURIComponent(标签原始);
    if (!await window._自定义确认(`确定删除标签「${标签}」？\n该操作将从所有备忘录中移除该标签。`)) return;
    const 数据源 = window._备忘录数据源 || window.备忘录管理器?.memos || [];
    数据源.forEach(m => {
      if (m.标签 && Array.isArray(m.标签) && m.标签.includes(标签)) {
        m.标签 = m.标签.filter(t => t !== 标签);
        if (window.备忘录管理器?.memos) {
          const mm = window.备忘录管理器.memos.find(x => x.id === m.id);
          if (mm) mm.标签 = m.标签;
        }
      }
    });
    渲染已选胶囊();
    渲染标签卡片(标签搜索框?.value);
    渲染标签列表();
    if (window.渲染备忘录列表) window.渲染备忘录列表();
  }

  // ===== 事件绑定 =====
  if (标签按钮) {
    标签按钮.addEventListener('click', (e) => { e.stopPropagation(); 打开标签选择页(); });
  }
  if (关闭标签页) {
    关闭标签页.addEventListener('click', () => 关闭标签选择页());
  }
  if (确认标签选择) {
    确认标签选择.addEventListener('click', () => 关闭标签选择页());
  }
  if (编辑标签按钮) {
    编辑标签按钮.addEventListener('click', function 切换编辑模式() {
      标签列表编辑模式 = !标签列表编辑模式;
      编辑标签按钮.textContent = 标签列表编辑模式 ? '完成' : '编辑';
      if (标签卡片容器) 标签卡片容器.style.display = 标签列表编辑模式 ? 'none' : '';
      if (标签列表容器) 标签列表容器.style.display = 标签列表编辑模式 ? '' : 'none';
    });
  }
  if (新建标签按钮) {
    新建标签按钮.addEventListener('click', async () => {
      const 名称 = await window._自定义输入('新建标签：', '');
      if (!名称 || !名称.trim()) return;
      const 新 = 名称.trim().slice(0, 20);
      const 已存在 = window._获取所有已用标签() || [];
      if (已存在.includes(新)) {
        window._显示提示('标签已存在','info');
        return;
      }
      切换标签选中(encodeURIComponent(新));
      渲染标签列表();
    });
  }
  if (标签搜索框) {
    标签搜索框.addEventListener('input', () => {
      if (!标签列表编辑模式) 渲染标签卡片(标签搜索框.value);
    });
  }
  // ESC关闭
  document.addEventListener('keydown', function 标签页ESC(e) {
    if (e.key === 'Escape') 关闭标签选择页();
  });
  // 点击外部关闭（遮罩层效果）
  if (标签选择页) {
    标签选择页.addEventListener('click', function 遮罩关闭(e) {
      // 点击空白区域关闭（只有点击页面背景才关闭，不是点击内部元素）
      if (e.target === 标签选择页) 关闭标签选择页();
    });
    // 返回手势由CSS touch-action:pan-y + 鸿蒙onBackPress处理
  }

  // ===== 事件委托 =====
  document.addEventListener('click', function 标签页委托(e) {
    if (!标签选择页 || 标签选择页.style.display === 'none') return;
    if (!标签选择页.contains(e.target)) return;

    // 已选胶囊删除叉
    if (e.target.classList.contains('删除叉')) {
      e.stopPropagation();
      切换标签选中(e.target.dataset.tag);
      return;
    }

    // 标签卡点击 → 切换选中（勾选/取消）
    const 卡 = e.target.closest('.标签卡');
    if (卡 && 标签卡片容器?.contains(卡)) {
      e.stopPropagation();
      切换标签选中(卡.dataset.tag);
      return;
    }

    // 列表项点击（编辑模式）→ 弹出操作菜单
    const 列项 = e.target.closest('.标签列表项');
    if (列项 && 标签列表容器?.contains(列项)) {
      e.stopPropagation();
      const 标签名 = decodeURIComponent(列项.dataset.tag);
      window.显示标签操作菜单(列项, 标签名);
      return;
    }

    // ===== 暴露到 window =====
    window.打开标签选择页 = 打开标签选择页;
    window.关闭标签选择页 = 关闭标签选择页;
    window.渲染标签卡片 = 渲染标签卡片;
  }); // 结束标签页委托

  // ===== 标签操作菜单（独立函数，供卡片/列表点击调用） =====
  window.显示标签操作菜单 = function(触发元素, 标签名) {
    console.log('[标签操作菜单] 显示, 标签=', 标签名);
    const 菜单 = document.createElement('div');
    菜单.className = '标签操作菜单';
    const 位置 = 触发元素.getBoundingClientRect();
    菜单.style.cssText = `position:fixed;left:${位置.left}px;top:${位置.bottom + 4}px;z-index:99999;background:#fff;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.15);min-width:160px;overflow:hidden;`;
    菜单.innerHTML = `
      <div class="标签操作项" data-action="view" style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:14px;border-bottom:1px solid #f0f0f0;">
        <span>🔍</span><span>查看相关备忘录</span>
      </div>
      <div class="标签操作项" data-action="delete" style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:14px;color:#e74c3c;">
        <span>🗑️</span><span>删除标签</span>
      </div>
    `;
    const 关闭菜单 = (ev) => {
      if (!菜单.contains(ev.target)) {
        菜单.remove();
        document.removeEventListener('click', 关闭菜单);
      }
    };
    菜单.addEventListener('click', async (ev) => {
      const 操作项 = ev.target.closest('.标签操作项');
      if (!操作项) return;
      const action = 操作项.dataset.action;
      菜单.remove();
      document.removeEventListener('click', 关闭菜单);
      if (action === 'delete') {
        if (await window._自定义确认('删除标签「' + 标签名 + '」？')) {
          if (window.全局删除标签) window.全局删除标签(encodeURIComponent(标签名));
        }
      } else if (action === 'view') {
        console.log('[标签操作] 查看相关备忘录, 标签名=', 标签名);
        if (window.关闭标签选择页) window.关闭标签选择页();
        if (window._设置当前文件夹) window._设置当前文件夹('全部');
        if (window._设置当前搜索关键词) window._设置当前搜索关键词('');
        if (window._设置当前日期筛选) window._设置当前日期筛选(null);
        if (window._设置当前筛选) window._设置当前筛选('all');
        if (window._设置当前标签筛选) window._设置当前标签筛选(标签名);
        if (window.设置当前激活面板) window.设置当前激活面板('备忘录面板');
        if (window.切换标签) window.切换标签('备忘录面板');
        const 搜索框 = document.getElementById('备忘录搜索框');
        if (搜索框) 搜索框.value = '';
        if (window.渲染备忘录列表) window.渲染备忘录列表();
        if (window.渲染筛选按钮) window.渲染筛选按钮();
        console.log('[标签操作] 渲染完成, _当前标签筛选=', window._当前标签筛选 ? window._当前标签筛选() : 'N/A');
      }
    });
    document.body.appendChild(菜单);
    setTimeout(() => document.addEventListener('click', 关闭菜单), 0);
  };

  // 初始化更新标签数
  更新已选标签数();
  
  // 工具栏按钮
  const 工具栏按钮 = document.querySelectorAll('.工具栏按钮');
  工具栏按钮.forEach(按钮 => {
    按钮.addEventListener('click', () => {
      const 工具类型 = 按钮.dataset.tool;
      const 编辑区 = document.getElementById('编辑内容');
      if (!编辑区) return;

      switch (工具类型) {
        case 'format':
          显示格式菜单(按钮, 编辑区);
          break;
        case 'size':
          显示字号抽屉();
          break;
        case 'todoList':
          插入待办项(编辑区);
          break;
        case 'image':
          插入图片(编辑区);
          break;
        case 'attach':
          插入附件(编辑区);
          break;
        case 'ai':
          显示AI辅助菜单(按钮, 编辑区);
          break;
      }
    });
  });

  // ========== 格式菜单 ==========
  let 格式菜单 = null;
  function 显示格式菜单(锚点, 编辑区) {
    if (格式菜单) { 格式菜单.remove(); 格式菜单 = null; return; }
    格式菜单 = document.createElement('div');
    格式菜单.className = '浮动格式菜单';
    格式菜单.innerHTML = `
      <button data-cmd="bold" title="加粗"><b>B</b></button>
      <button data-cmd="italic" title="斜体"><i>I</i></button>
      <button data-cmd="underline" title="下划线"><u>U</u></button>
      <button data-cmd="strikeThrough" title="删除线"><s>S</s></button>
    `;
    const rect = 锚点.getBoundingClientRect();
    格式菜单.style.position = 'fixed';
    格式菜单.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    格式菜单.style.left = (rect.left - 20) + 'px';
    document.body.appendChild(格式菜单);

    格式菜单.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cmd]');
      if (!btn) return;
      编辑区.focus();
      document.execCommand(btn.dataset.cmd, false, null);
    });

    // 点外部关闭
    const 关闭 = (e) => {
      if (!格式菜单.contains(e.target) && e.target !== 锚点) {
        格式菜单.remove(); 格式菜单 = null;
        document.removeEventListener('click', 关闭);
      }
    };
    setTimeout(() => document.addEventListener('click', 关闭), 0);
  }

  // 暴露给鸿蒙返回手势
  window.关闭格式菜单 = function() { if (格式菜单) { 格式菜单.remove(); 格式菜单 = null; } };

  // ========== 待办事项 ==========
  function 插入待办项(编辑区, 初始文本 = null, 截止时间 = null) {
    编辑区.focus();
    
    const sel = window.getSelection();
    let 待办文本 = 初始文本;
    let 剩余文本 = '';
    let 有选区 = false;
    let range = null;
    
    if (!待办文本 && sel.rangeCount > 0 && !sel.isCollapsed) {
      有选区 = true;
      range = sel.getRangeAt(0);
      待办文本 = sel.toString().trim() || '待办事项';
      
      // 获取选区结束位置到文本节点末尾的剩余文字
      const endNode = range.endContainer;
      if (endNode.nodeType === 3) {
        剩余文本 = endNode.textContent.slice(range.endOffset);
      }
    }
    if (!待办文本) 待办文本 = '待办事项';
    
    // 创建待办DOM节点
    const todoDiv = document.createElement('div');
    todoDiv.className = 'todo-item';
    todoDiv.dataset.todo = 'true';
    // 内联onclick处理checkbox切换，同时触发data变更事件
    const deadlineAttr = 截止时间 ? ` data-deadline="${截止时间}"` : '';
    const deadlineDisplay = '';
    todoDiv.innerHTML = `\
<input type="checkbox" class="todo-checkbox" contenteditable="false"\
  onclick="this.parentElement.dataset.completed=this.checked;this.parentElement.classList.toggle('completed',this.checked);this.parentElement.dispatchEvent(new CustomEvent('todochange',{bubbles:true}))"><span class="todo-text">${待办文本}</span>\
${deadlineDisplay}`;
    if (截止时间) todoDiv.dataset.deadline = 截止时间;
    
    if (有选区 && range) {
      // 有选区：用DOM操作精确控制位置
      range.deleteContents();
      range.insertNode(todoDiv);
      
      // insertNode会分裂文本节点，剩余文字在todoDiv的nextSibling中
      // 把它包装进div，让它换行显示
      if (剩余文本) {
        let next = todoDiv.nextSibling;
        if (next && next.nodeType === 3) {
          // 裸文本节点 → 包进div
          const wrapper = document.createElement('div');
          next.parentNode.insertBefore(wrapper, next);
          wrapper.appendChild(next);
        }
      }
      
      // 光标移到待办文字末尾
      const todoText = todoDiv.querySelector('.todo-text');
      const newRange = document.createRange();
      newRange.setStart(todoText, todoText.childNodes.length);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      // 无选区：用insertHTML在光标位置插入
      const 转义 = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      document.execCommand('insertHTML', false, `<div class="todo-item" data-todo="true"><input type="checkbox" class="todo-checkbox" contenteditable="false" onclick="this.parentElement.dataset.completed=this.checked;this.parentElement.classList.toggle('completed',this.checked);this.parentElement.dispatchEvent(new CustomEvent('todochange',{bubbles:true}))"><span class="todo-text">${转义(待办文本)}</span></div>`);
    }
  }

  // ========== 待办项交互增强 ==========
  function 初始化待办交互(编辑区) {
    if (!编辑区) return;

    // 1. 监听回车键：在待办项中回车 → 分割文本并创建新待办
    编辑区.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      
      // 检查当前是否在待办项中
      let node = sel.anchorNode;
      let todoItem = null;
      while (node && node !== 编辑区) {
        if (node.nodeType === 1 && node.classList?.contains('todo-item')) {
          todoItem = node;
          break;
        }
        node = node.parentNode;
      }
      
      if (todoItem) {
        e.preventDefault();
        
        const range = sel.getRangeAt(0);
        const todoText = todoItem.querySelector('.todo-text');
        
        // 获取光标前后的文本
        let beforeText = '';
        let afterText = '';
        
        if (range.startContainer.nodeType === 3) {
          // 文本节点：分割
          const textNode = range.startContainer;
          const offset = range.startOffset;
          beforeText = textNode.textContent.slice(0, offset);
          afterText = textNode.textContent.slice(offset);
        } else if (todoText) {
          // 非文本节点：取当前待办的全部文本作为"前面"，后面为空
          beforeText = todoText.textContent;
          afterText = '';
        }
        
        // 更新当前待办的文本（只保留光标前的内容）
        if (todoText) {
          todoText.textContent = beforeText || '待办事项';
        }
        
        // 创建新待办DOM元素
        const newTodo = document.createElement('div');
        newTodo.className = 'todo-item';
        newTodo.dataset.todo = 'true';
        newTodo.innerHTML = `<input type="checkbox" class="todo-checkbox" contenteditable="false" onclick="this.parentElement.dataset.completed=this.checked;this.parentElement.classList.toggle('completed',this.checked);this.parentElement.dispatchEvent(new CustomEvent('todochange',{bubbles:true}))"><span class="todo-text">${afterText || '待办事项'}</span>`;
        
        // 在当前待办后面插入新待办
        todoItem.parentNode.insertBefore(newTodo, todoItem.nextSibling);
        
        // 移动光标到新待办的文字开头
        const newTextSpan = newTodo.querySelector('.todo-text');
        const newRange = document.createRange();
        newRange.setStart(newTextSpan.firstChild || newTextSpan, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    });

    // 2. 监听退格键：删完文字后继续退格 → 整个待办行消失
    编辑区.addEventListener('keydown', (e) => {
      if (e.key !== 'Backspace') return;
      
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      
      // 找到当前待办项
      let node = sel.anchorNode;
      let todoItem = null;
      while (node && node !== 编辑区) {
        if (node.nodeType === 1 && node.classList?.contains('todo-item')) {
          todoItem = node;
          break;
        }
        node = node.parentNode;
      }
      if (!todoItem) return;
      
      const todoText = todoItem.querySelector('.todo-text');
      if (!todoText) return;
      
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return;
      
      // 判断光标在待办文字中的位置
      let cursorOffset = -1;
      try {
        const testRange = document.createRange();
        testRange.setStart(todoText, 0);
        testRange.setEnd(range.startContainer, range.startOffset);
        cursorOffset = testRange.toString().length;
      } catch (err) {
        console.log('[退格调试] Range创建失败:', err.message, 'startContainer:', range.startContainer?.nodeName, range.startOffset);
        return;
      }
      
      const textContent = todoText.textContent;
      
      if (textContent.length === 0 || cursorOffset === 0) {
        // 空待办 或 光标在开头 → 删除整个待办行
        e.preventDefault();
        todoItem.remove();
      } else if (textContent.length === 1) {
        // 只剩1个字 → 手动删掉，保留空待办（用户可能要输入新内容）
        e.preventDefault();
        todoText.textContent = '';
        // 光标留在空待办中
        const newRange = document.createRange();
        newRange.setStart(todoText, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } else {
        // 多个字 → 允许浏览器默认退格
      }
    });

    // 3. 双击 checkbox → 整个待办行消失
    编辑区.addEventListener('dblclick', (e) => {
      if (!e.target.classList.contains('todo-checkbox')) return;
      const todoItem = e.target.closest('.todo-item');
      if (todoItem) todoItem.remove();
    });

    // 4. 单击 checkbox 切换完成状态
    编辑区.addEventListener('click', (e) => {
      if (e.target.classList.contains('todo-checkbox')) {
        const todoItem = e.target.closest('.todo-item');
        if (todoItem) {
          todoItem.dataset.completed = e.target.checked;
          todoItem.classList.toggle('completed', e.target.checked);
        }
      }
    });

    // 5. 右键 checkbox → 弹出截止时间设置浮层
    编辑区.addEventListener('contextmenu', (e) => {
      if (!e.target.classList.contains('todo-checkbox')) return;
      e.preventDefault();
      显示截止浮层(e.target.closest('.todo-item'), e);
    });

    // 6. 长按 checkbox（移动端）→ 弹出截止时间设置浮层
    let 长按计时器 = null;
    编辑区.addEventListener('pointerdown', (e) => {
      if (!e.target.classList.contains('todo-checkbox')) return;
      长按计时器 = setTimeout(() => {
        长按计时器 = null;
        显示截止浮层(e.target.closest('.todo-item'), e);
        e.preventDefault();
      }, 600);
    });
    编辑区.addEventListener('pointerup', () => { if (长按计时器) { clearTimeout(长按计时器); 长按计时器 = null; } });
    编辑区.addEventListener('pointerleave', () => { if (长按计时器) { clearTimeout(长按计时器); 长按计时器 = null; } });
  }

  // ========== 待办截止时间浮层 ==========
  let _截止浮层 = null;
  function 显示截止浮层(todoItem, event) {
    移除截止浮层();

    const 浮层 = document.createElement('div');
    浮层.className = '截止浮层';
    浮层.style.position = 'fixed';
    浮层.style.left = Math.min(event.clientX, window.innerWidth - 220) + 'px';
    浮层.style.top = Math.min(event.clientY, window.innerHeight - 140) + 'px';
    浮层.style.zIndex = 99999;
    浮层.style.background = 'var(--浮层背景, #fff)';
    浮层.style.border = '1px solid var(--边框色, #ddd)';
    浮层.style.borderRadius = '10px';
    浮层.style.padding = '10px';
    浮层.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    浮层.style.fontSize = '14px';
    浮层.style.minWidth = '200px';

    const 当前截止 = todoItem.dataset.deadline || '';
    const 仅日期 = 当前截止.length <= 10;
    const curDate = 仅日期 ? 当前截止 : 当前截止.slice(0, 10);
    const curTime = 仅日期 ? '' : 当前截止.slice(11, 16);

    // 日期选择
    const 日期组 = document.createElement('div');
    日期组.style.marginBottom = '6px';
    const 日期标签 = document.createElement('div');
    日期标签.textContent = '截止日期';
    日期标签.style.fontSize = '12px';
    日期标签.style.color = '#888';
    日期标签.style.marginBottom = '4px';
    const 日期输入 = document.createElement('input');
    日期输入.type = 'date';
    日期输入.value = curDate || '';
    日期输入.style.width = '100%';
    日期输入.style.padding = '4px 6px';
    日期输入.style.border = '1px solid #ccc';
    日期输入.style.borderRadius = '6px';
    日期输入.style.boxSizing = 'border-box';
    日期组.appendChild(日期标签);
    日期组.appendChild(日期输入);
    浮层.appendChild(日期组);

    // 时间选择
    const 时间组 = document.createElement('div');
    时间组.style.marginBottom = '8px';
    const 时间标签 = document.createElement('div');
    时间标签.textContent = '截止时间（可选）';
    时间标签.style.fontSize = '12px';
    时间标签.style.color = '#888';
    时间标签.style.marginBottom = '4px';
    const 时间输入 = document.createElement('input');
    时间输入.type = 'time';
    时间输入.value = curTime || '';
    时间输入.style.width = '100%';
    时间输入.style.padding = '4px 6px';
    时间输入.style.border = '1px solid #ccc';
    时间输入.style.borderRadius = '6px';
    时间输入.style.boxSizing = 'border-box';
    时间组.appendChild(时间标签);
    时间组.appendChild(时间输入);
    浮层.appendChild(时间组);

    // 按钮组
    const 按钮组 = document.createElement('div');
    按钮组.style.display = 'flex';
    按钮组.style.gap = '6px';
    按钮组.style.justifyContent = 'flex-end';

    const 取消按钮 = document.createElement('button');
    取消按钮.textContent = '取消';
    取消按钮.style.cssText = 'padding:5px 12px;border:1px solid #ddd;border-radius:6px;background:#f8f8f8;cursor:pointer;font-size:13px';
    取消按钮.onclick = () => 移除截止浮层();

    const 清除按钮 = document.createElement('button');
    清除按钮.textContent = '清除';
    清除按钮.style.cssText = 'padding:5px 12px;border:1px solid #e74c3c;border-radius:6px;background:#fff;color:#e74c3c;cursor:pointer;font-size:13px';
    清除按钮.onclick = () => {
      delete todoItem.dataset.deadline;
      const ds = todoItem.querySelector('.todo-deadline');
      if (ds) ds.remove();
      移除截止浮层();
      触发待办变更();
    };

    const 确定按钮 = document.createElement('button');
    确定按钮.textContent = '确定';
    确定按钮.style.cssText = 'padding:5px 12px;border:none;border-radius:6px;background:var(--主题色,#4a90d9);color:#fff;cursor:pointer;font-size:13px';
    确定按钮.onclick = () => {
      const d = 日期输入.value;
      const t = 时间输入.value;
      if (!d) { 移除截止浮层(); return; }
      const deadline = t ? d + 'T' + t : d;
      todoItem.dataset.deadline = deadline;
      更新待办截止显示(todoItem);
      移除截止浮层();
      触发待办变更();
    };

    按钮组.appendChild(取消按钮);
    按钮组.appendChild(清除按钮);
    按钮组.appendChild(确定按钮);
    浮层.appendChild(按钮组);

    document.body.appendChild(浮层);
    _截止浮层 = 浮层;

    // 点击浮层外部关闭
    setTimeout(() => {
      const 关闭 = (e) => {
        if (!浮层.contains(e.target)) {
          移除截止浮层();
          document.removeEventListener('click', 关闭, true);
        }
      };
      document.addEventListener('click', 关闭, true);
    }, 0);
  }

  function 移除截止浮层() {
    if (_截止浮层) {
      _截止浮层.remove();
      _截止浮层 = null;
    }
  }

  function 更新待办截止显示(todoItem) {
    let ds = todoItem.querySelector('.todo-deadline');
    if (!ds) {
      ds = document.createElement('span');
      ds.className = 'todo-deadline';
      todoItem.appendChild(ds);
    }
    const d = todoItem.dataset.deadline;
    if (d) {
      const dateOnly = d.slice(0, 10);
      const timeOnly = d.length > 10 ? d.slice(11, 16) : '';
      ds.textContent = ' ⏰ ' + dateOnly + (timeOnly ? ' ' + timeOnly : '');
      ds.style.display = '';
      // 过期检查
      const isOverdue = !todoItem.dataset.completed && new Date(d) < new Date();
      ds.style.color = isOverdue ? '#e74c3c' : 'var(--文字色,#333)';
    } else {
      ds.style.display = 'none';
    }
  }

  function 触发待办变更() {
    // 通知编辑器内容已变更，触发保存
    const 编辑区 = document.querySelector('.编辑内容区');
    if (编辑区) {
      编辑区.dispatchEvent(new CustomEvent('todochange', { bubbles: true }));
    }
  }

  // ========== 插入图片（带压缩和预览） ==========
  function 插入图片(编辑区) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // 显示压缩提示
      const 提示元素 = document.createElement('div');
      提示元素.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:10px 20px;border-radius:8px;font-size:14px;z-index:10000;';
      提示元素.textContent = '正在压缩图片...';
      document.body.appendChild(提示元素);

      try {
        // 压缩图片
        const 压缩后的Base64 = await 压缩图片文件(file, 800, 0.8);
        编辑区.focus();

        // 生成唯一ID用于预览
        const 图片ID = 'img_' + Date.now();

        const imgHTML = `<img src="${压缩后的Base64}" style="max-width:100%;border-radius:6px;margin:4px 0;cursor:pointer;" class="编辑区图片" data-img-id="${图片ID}" onclick="window.打开图片预览(this)" />`;
        document.execCommand('insertHTML', false, imgHTML);

        提示元素.textContent = '✅ 图片插入成功';
        setTimeout(() => 提示元素.remove(), 1500);
      } catch (错误) {
        console.error('图片插入失败:', 错误);
        提示元素.textContent = '❌ 图片插入失败';
        setTimeout(() => 提示元素.remove(), 2000);
      }
    };
    input.click();
  }

  // ========== 图片压缩函数 ==========
  async function 压缩图片文件(file, 最大宽度 = 800, 质量 = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 如果图片太大，等比例缩小
          if (width > 最大宽度) {
            height = (最大宽度 / width) * height;
            width = 最大宽度;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // 输出压缩后的base64
          const 压缩后的数据 = canvas.toDataURL('image/jpeg', 质量);
          resolve(压缩后的数据);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ========== 打开图片预览 ==========
  window.打开图片预览 = function(imgElement) {
    const 图片URL = imgElement.src;
    const 预览容器 = document.createElement('div');
    预览容器.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    预览容器.onclick = () => 预览容器.remove();

    const 预览图片 = document.createElement('img');
    预览图片.src = 图片URL;
    预览图片.style.cssText = 'max-width:95%;max-height:95%;object-fit:contain;border-radius:8px;';

    // 添加下载按钮
    const 下载按钮 = document.createElement('button');
    下载按钮.textContent = '⬇️ 下载图片';
    下载按钮.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:#3498db;color:white;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-size:14px;';
    下载按钮.onclick = (e) => {
      e.stopPropagation();
      下载图片(图片URL, '备忘录图片_' + Date.now() + '.jpg');
    };

    // 添加关闭按钮
    const 关闭按钮 = document.createElement('button');
    关闭按钮.textContent = '✕';
    关闭按钮.style.cssText = 'position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.2);color:white;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:20px;';
    关闭按钮.onclick = (e) => {
      e.stopPropagation();
      预览容器.remove();
    };

    预览容器.appendChild(预览图片);
    预览容器.appendChild(下载按钮);
    预览容器.appendChild(关闭按钮);
    document.body.appendChild(预览容器);
  };

  // ========== 下载图片函数 ==========
  function 下载图片(base64数据, 文件名) {
    // 走统一下载入口（鸿蒙原生优先）
    if (window.nativeBridge && window.nativeBridge.saveFile) {
      const parts = base64数据.split(',');
      const base64 = parts[1] || parts[0];
      window.nativeBridge.saveFile(文件名, base64).then(res => {
        const 结果 = JSON.parse(res);
        if (!结果.success) {
          console.warn('[下载图片] 保存未完成:', 结果.error);
        }
      }).catch(e => {
        console.warn('[下载图片] 原生保存异常:', e);
      });
      return;
    }
    const link = document.createElement('a');
    link.href = base64数据;
    link.download = 文件名;
    link.click();
  }

  // ========== 插入附件 ==========
  function 插入附件(编辑区) {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        编辑区.focus();

        // 获取文件类型图标
        const 文件图标 = 获取文件图标(file.name);

        // 生成唯一ID用于下载
        const 附件ID = 'attach_' + Date.now();

        const 附件HTML = `<div class="attachment-item" contenteditable="false" data-attachment-id="${附件ID}" data-file-name="${file.name}" data-file-size="${file.size}" data-file-data="${ev.target.result}" onclick="window.处理附件点击(this)">
          <span class="attach-icon">${文件图标}</span>
          <span class="attach-name">${file.name}</span>
          <span class="attach-size">(${(file.size/1024).toFixed(1)}KB)</span>
        </div>`;
        document.execCommand('insertHTML', false, 附件HTML);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // ========== 获取文件图标 ==========
  function 获取文件图标(文件名) {
    const 扩展名 = 文件名.split('.').pop().toLowerCase();
    const 图标映射 = {
      'pdf': '📄',
      'doc': '📝', 'docx': '📝',
      'xls': '📊', 'xlsx': '📊',
      'ppt': '📽️', 'pptx': '📽️',
      'txt': '📃',
      'zip': '🗜️', 'rar': '🗜️', '7z': '🗜️',
      'mp3': '🎵', 'wav': '🎵', 'ogg': '🎵',
      'mp4': '🎬', 'avi': '🎬', 'mov': '🎬',
      'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
      'html': '🌐', 'css': '🎨', 'js': '💻'
    };
    return 图标映射[扩展名] || '📎';
  }

  // ========== 处理附件点击 ==========
  window.处理附件点击 = function(附件元素) {
    const 文件名 = 附件元素.dataset.fileName;
    const 文件数据 = 附件元素.dataset.fileData;
    const 文件大小 = parseInt(附件元素.dataset.fileSize);

    // 创建操作菜单
    const 菜单容器 = document.createElement('div');
    菜单容器.style.cssText = 'position:absolute;background:white;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:99999;min-width:160px;overflow:hidden;';

    // 获取点击位置
    const 位置 = 附件元素.getBoundingClientRect();
    菜单容器.style.left = 位置.left + 'px';
    菜单容器.style.top = (位置.bottom + 5) + 'px';

    菜单容器.innerHTML = `
      <div class="附件菜单项" onclick="window.下载单个附件('${附件元素.dataset.attachmentId}')" style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:14px;">
        <span>⬇️</span>
        <span>下载文件</span>
      </div>
      <div class="附件菜单项" onclick="window.删除单个附件('${附件元素.dataset.attachmentId}')" style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:14px;color:#e74c3c;">
        <span>删除</span>
        <span>删除附件</span>
      </div>
      <div style="padding:10px 16px;font-size:12px;color:#999;border-top:1px solid #eee;">
        ${文件名} (${(文件大小/1024).toFixed(1)}KB)
      </div>
    `;

    // 点击外部关闭菜单
    const 关闭菜单 = (e) => {
      if (!菜单容器.contains(e.target)) {
        菜单容器.remove();
        document.removeEventListener('click', 关闭菜单);
      }
    };
    setTimeout(() => document.addEventListener('click', 关闭菜单), 0);

    document.body.appendChild(菜单容器);
  };

  // ========== 下载单个附件 ==========
  window.下载单个附件 = function(附件ID) {
    const 附件元素 = document.querySelector(`[data-attachment-id="${附件ID}"]`);
    if (!附件元素) return;

    const 文件名 = 附件元素.dataset.fileName;
    const 文件数据 = 附件元素.dataset.fileData;

    // 走统一下载入口（鸿蒙原生优先）
    if (window.nativeBridge && window.nativeBridge.saveFile) {
      const parts = 文件数据.split(',');
      const base64 = parts[1] || 文件数据;
      window.nativeBridge.saveFile(文件名, base64).then(res => {
        const 结果 = JSON.parse(res);
        if (!结果.success) {
          console.warn('[下载附件] 保存未完成:', 结果.error);
        }
      }).catch(e => {
        console.warn('[下载附件] 原生保存异常:', e);
      });
      return;
    }
    const link = document.createElement('a');
    link.href = 文件数据;
    link.download = 文件名;
    link.click();
  };

  // ========== 删除单个附件 ==========
  window.删除单个附件 = function(附件ID) {
    const 附件元素 = document.querySelector(`[data-attachment-id="${附件ID}"]`);
    if (附件元素) {
      附件元素.remove();
    }
  };

  // ========== AI辅助编辑菜单 ==========
  let AI菜单 = null;
  let AI保存的选区 = null;

  function 显示AI辅助菜单(锚点, 编辑区) {
    // 保存当前选区
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && !sel.isCollapsed) {
      AI保存的选区 = sel.getRangeAt(0).cloneRange();
    } else {
      window._显示提示('请先选中要处理的文字','info');
      return;
    }

    if (AI菜单) { AI菜单.remove(); AI菜单 = null; return; }

    AI菜单 = document.createElement('div');
    AI菜单.className = 'ai辅助菜单';
    AI菜单.style.cssText = 'position:fixed;background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:99999;min-width:200px;overflow:hidden;';

    AI菜单.innerHTML = `
      <div class="ai菜单项" data-action="优化" style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:14px;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="width:20px;"></div>
        <div style="font-weight:500;">优化表达</div>
      </div>
      <div class="ai菜单项" data-action="扩写" style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:14px;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="width:20px;"></div>
        <div style="font-weight:500;">扩写内容</div>
      </div>
      <div class="ai菜单项" data-action="缩写" style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:14px;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="width:20px;"></div>
        <div style="font-weight:500;">缩写概括</div>
      </div>
      <div class="ai菜单项" data-action="润色" style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:14px;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="width:20px;"></div>
        <div style="font-weight:500;">润色文章</div>
      </div>
      <div class="ai菜单项" data-action="翻译中文" style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:14px;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="width:20px;"></div>
        <div style="font-weight:500;">翻译为中文</div>
      </div>
      <div class="ai菜单项" data-action="翻译英文" style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:14px;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="width:20px;"></div>
        <div style="font-weight:500;">翻译为英文</div>
      </div>
    `;

    const rect = 锚点.getBoundingClientRect();
    const 菜单宽度 = 220; // 菜单宽度
    const 菜单高度 = 200; // 菜单高度（进一步减小）
    
    // 计算位置，确保菜单在视口内
    let left = rect.left;
    let top = rect.top - 菜单高度 - 5;
    
    // 调整水平位置
    if (left + 菜单宽度 > window.innerWidth) {
      left = window.innerWidth - 菜单宽度 - 10;
    }
    if (left < 10) {
      left = 10;
    }
    
    // 调整垂直位置
    if (top < 10) {
      // 显示在按钮下方
      top = rect.bottom + 5;
      // 确保底部不超出视口
      if (top + 菜单高度 > window.innerHeight) {
        top = window.innerHeight - 菜单高度 - 10;
      }
    }
    
    // 强制设置菜单高度，确保所有内容显示
    AI菜单.style.height = 菜单高度 + 'px';
    AI菜单.style.overflowY = 'auto';
    
    AI菜单.style.left = left + 'px';
    AI菜单.style.top = top + 'px';

    document.body.appendChild(AI菜单);

    // 菜单项点击事件
    AI菜单.querySelectorAll('.ai菜单项').forEach(项 => {
      项.addEventListener('click', (e) => {
        const 操作类型 = 项.dataset.action;
        AI菜单.remove();
        AI菜单 = null;
        执行AI辅助编辑(操作类型, 编辑区);
      });
    });

    // 点外部关闭
    const 关闭 = (e) => {
      if (AI菜单 && !AI菜单.contains(e.target) && e.target !== 锚点) {
        AI菜单.remove(); AI菜单 = null;
        document.removeEventListener('click', 关闭);
      }
    };
    setTimeout(() => document.addEventListener('click', 关闭), 0);
  }

  // 暴露给鸿蒙返回手势
  window.关闭AI菜单 = function() { if (AI菜单) { AI菜单.remove(); AI菜单 = null; } };

  // ========== 执行AI辅助编辑 ==========
  async function 执行AI辅助编辑(操作类型, 编辑区) {
    if (!AI保存的选区) {
      window._显示提示('请先选中要处理的文字','info');
      return;
    }

    // 获取选中的文本
    const 选中文本 = AI保存的选区.toString().trim();
    if (!选中文本) {
      window._显示提示('请先选中要处理的文字','info');
      return;
    }

    // 恢复选区
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(AI保存的选区);

    // 显示处理中提示
    const 提示元素 = document.createElement('div');
    提示元素.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(102,126,234,0.95);color:white;padding:12px 24px;border-radius:8px;font-size:14px;z-index:10000;';
    提示元素.innerHTML = `AI正在${操作类型}...<br><span style="font-size:12px;opacity:0.8;">请稍候</span>`;
    document.body.appendChild(提示元素);

    try {
      // 构建AI请求
      const 操作提示 = {
        '优化': `请优化以下文字的表达，使其更加准确、流畅、专业。只需返回优化后的文字，不要解释：\n\n${选中文本}`,
        '扩写': `请扩写以下内容，增加更多细节和描写，使内容更加丰富。只需返回扩写后的文字，不要解释：\n\n${选中文本}`,
        '缩写': `请精简概括以下内容，保留核心信息，去除冗余。只需返回缩写后的文字，不要解释：\n\n${选中文本}`,
        '润色': `请润色以下文章，提升文采和可读性。只需返回润色后的文字，不要解释：\n\n${选中文本}`,
        '翻译中文': `请将以下内容翻译成中文，保持原意，通顺流畅。只需返回翻译后的文字，不要解释：\n\n${选中文本}`,
        '翻译英文': `Please translate the following text into English, keeping the meaning accurate and fluent. Only return the translated text, no explanation:\n\n${选中文本}`
      };

      const 系统提示词 = window.获取当前系统提示词 ? window.获取当前系统提示词() : '你是一个专业的文字编辑助手。';
      const 消息列表 = [
        { role: 'system', content: 系统提示词 },
        { role: 'user', content: 操作提示[操作类型] || `请处理以下文字：\n\n${选中文本}` }
      ];

      const 结果 = await window.调用API(消息列表, 0, null, 3);
      const AI回复 = typeof 结果 === 'string' ? 结果 : (结果.content || '');

      // 去除AI回复中的多余解释，只保留纯文字
      let 处理后文本 = AI回复.trim();

      // 移除常见的解释性前缀
      const 前缀列表 = ['优化后：', '扩写后：', '缩写后：', '润色后：', '翻译后：', '以下是优化后的文字：', '以下是扩写后的内容：', '以下是缩写后的内容：', '以下是润色后的文章：', '以下是翻译结果：', 'Optimized:', 'Expanded:', 'Summarized:', 'Polished:', 'Translation:'];
      for (const 前缀 of 前缀列表) {
        if (处理后文本.startsWith(前缀)) {
          处理后文本 = 处理后文本.substring(前缀.length).trim();
        }
      }

      // 用处理后的文本替换选中文本
      sel.removeAllRanges();
      sel.addRange(AI保存的选区);
      document.execCommand('insertText', false, 处理后文本);

      提示元素.innerHTML = `✅ ${操作类型}完成！`;
      setTimeout(() => 提示元素.remove(), 2000);

    } catch (错误) {
      console.error('AI辅助编辑失败:', 错误);
      提示元素.innerHTML = `❌ ${操作类型}失败<br><span style="font-size:12px;">${错误.message || '请检查API配置'}</span>`;
      setTimeout(() => 提示元素.remove(), 3000);
    }
  }

  // ========== 选区工具条 ==========
  const 选区工具条 = document.getElementById('选区工具条');
  const 颜色面板 = document.getElementById('颜色面板');

  // 初始化待办项交互（回车创建新待办、删除checkbox变普通文字）
  初始化待办交互(编辑内容区);

  if (选区工具条 && 编辑内容区) {
    // 保存选区（点击工具条按钮前需要记住选区）
    let 保存的选区 = null;

    function 保存当前选区() {
      const sel = window.getSelection();
      if (sel.rangeCount > 0 && !sel.isCollapsed) {
        保存的选区 = sel.getRangeAt(0).cloneRange();
      }
    }

    function 恢复选区() {
      if (保存的选区) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(保存的选区);
      }
    }

    // 选区变化时显示/隐藏工具条
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        选区工具条.style.display = 'none';
        if (颜色面板) 颜色面板.style.display = 'none';
        return;
      }
      // 确保选区在编辑内容区内
      const range = sel.getRangeAt(0);
      if (!编辑内容区.contains(range.commonAncestorContainer)) {
        选区工具条.style.display = 'none';
        return;
      }
      保存当前选区();
      // 定位工具条到选区上方
      const rect = range.getBoundingClientRect();
      const 条宽 = 选区工具条.offsetWidth || 200;
      let left = rect.left + rect.width / 2 - 条宽 / 2;
      let top = rect.top - 44;
      // 边界修正
      if (left < 8) left = 8;
      if (left + 条宽 > window.innerWidth - 8) left = window.innerWidth - 条宽 - 8;
      if (top < 8) top = rect.bottom + 8;
      选区工具条.style.left = left + 'px';
      选区工具条.style.top = top + 'px';
      选区工具条.style.display = 'flex';
    });

    // 点击编辑区外隐藏工具条
    document.addEventListener('mousedown', (e) => {
      if (!选区工具条.contains(e.target) && e.target !== 编辑内容区) {
        选区工具条.style.display = 'none';
        if (颜色面板) 颜色面板.style.display = 'none';
      }
    });

    // 暴露给鸿蒙返回手势
    window.隐藏选区工具条 = function() { 选区工具条.style.display = 'none'; };

    // 工具条按钮事件委托
    选区工具条.addEventListener('click', (e) => {
      const 按钮 = e.target.closest('[data-action]');
      if (!按钮) return;
      e.preventDefault();
      恢复选区();

      switch (按钮.dataset.action) {
        case 'bold':
          document.execCommand('bold', false, null);
          break;
        case 'color':
          if (颜色面板) {
            颜色面板.style.display = 颜色面板.style.display === 'none' ? 'flex' : 'none';
          }
          break;
      }
      保存当前选区();
    });

    // 颜色面板事件
    if (颜色面板) {
      颜色面板.addEventListener('click', (e) => {
        const 按钮 = e.target.closest('[data-color]');
        if (!按钮) return;
        e.preventDefault();
        e.stopPropagation();
        恢复选区();
        let color = 按钮.dataset.color;
        if (color === 'theme') {
          // 读取当前主题色
          color = getComputedStyle(document.documentElement).getPropertyValue('--主题色').trim() || '#667eea';
        }
        document.execCommand('foreColor', false, color);
        颜色面板.style.display = 'none';
        保存当前选区();
      });
    }
  }

  // ========== 字号抽屉 ==========
  const 字号抽屉 = document.getElementById('字号抽屉');
  const 抽屉滑块 = document.getElementById('抽屉字号滑块');
  const 抽屉显示 = document.getElementById('抽屉字号显示');
  const 关闭按钮 = document.getElementById('关闭字号抽屉');
  let 抽屉遮罩 = null;
  let 抽屉保存的选区 = null;
  let 缓存的字号元素 = null; // 缓存第一次创建的元素，后续直接修改

  function 显示字号抽屉() {
    if (!字号抽屉) return;
    // 保存当前选区
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      抽屉保存的选区 = sel.getRangeAt(0).cloneRange();
    }
    // 重置缓存
    缓存的字号元素 = null;
    // 创建遮罩
    if (!抽屉遮罩) {
      抽屉遮罩 = document.createElement('div');
      抽屉遮罩.className = '抽屉遮罩';
      document.body.appendChild(抽屉遮罩);
      抽屉遮罩.addEventListener('click', () => {
        隐藏字号抽屉();
      });
    }
    字号抽屉.style.display = 'block';
    requestAnimationFrame(() => {
      字号抽屉.classList.add('显示');
      抽屉遮罩.classList.add('显示');
    });
  }

  function 隐藏字号抽屉() {
    if (!字号抽屉) return;
    字号抽屉.classList.remove('显示');
    if (抽屉遮罩) 抽屉遮罩.classList.remove('显示');
    setTimeout(() => {
      字号抽屉.style.display = 'none';
    }, 250);
    抽屉保存的选区 = null;
    缓存的字号元素 = null;
  }

  // 暴露给鸿蒙返回手势
  window.隐藏字号抽屉 = 隐藏字号抽屉;

  if (关闭按钮) {
    关闭按钮.addEventListener('click', () => {
      隐藏字号抽屉();
    });
  }

  if (抽屉滑块 && 抽屉显示) {
    抽屉滑块.addEventListener('input', (e) => {
      const size = parseInt(e.target.value);
      抽屉显示.textContent = size + 'px';
      
      const 编辑区 = document.getElementById('编辑内容');
      if (!编辑区) return;

      // 如果已有缓存的元素，直接修改字号
      if (缓存的字号元素 && 缓存的字号元素.length > 0) {
        缓存的字号元素.forEach(span => {
          span.style.fontSize = size + 'px';
        });
        return;
      }

      // 第一次拖动：恢复选区并创建字号元素
      if (抽屉保存的选区) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(抽屉保存的选区);
      }
      编辑区.focus();
      
      // 使用 execCommand + 替换精确字号
      document.execCommand('fontSize', false, '7');
      const fonts = 编辑区.querySelectorAll('font[size="7"]');
      if (fonts.length > 0) {
        // 将所有 font 替换为 span
        fonts.forEach(f => {
          const span = document.createElement('span');
          span.style.fontSize = size + 'px';
          span.setAttribute('data-temp-size', 'true');
          span.innerHTML = f.innerHTML;
          f.parentNode.replaceChild(span, f);
        });
        // 缓存所有带临时标记的元素
        缓存的字号元素 = 编辑区.querySelectorAll('span[data-temp-size="true"]');
      }
    });
  }

  // ========== contenteditable 保存适配 ==========
  // 覆写原 textarea 的 .value 为 .innerHTML
  // 编辑内容区内容变化时触发 input 事件（与 textarea 兼容）
  if (编辑内容区) {
    编辑内容区.addEventListener('input', () => {
      // 触发原有的 input 事件处理（如果有的话）
    });
  }

  // 备忘录更多菜单（右上角）
  const 更多按钮 = document.getElementById('备忘录更多按钮');
  const 全局浮动菜单 = document.getElementById('全局浮动菜单');
  if (更多按钮 && 全局浮动菜单) {
    更多按钮.addEventListener('click', (e) => {
      e.stopPropagation();
      // 根据当前视图动态更新菜单内容
      更新全局浮动菜单内容();
      全局浮动菜单.classList.toggle('显示');
    });
    document.addEventListener('click', (e) => {
      if (!更多按钮.contains(e.target) && !全局浮动菜单.contains(e.target)) {
        全局浮动菜单.classList.remove('显示');
      }
    });
    全局浮动菜单.addEventListener('click', (e) => e.stopPropagation());
    
    // 使用事件委托处理菜单项点击
    全局浮动菜单.addEventListener('click', async (e) => {
      // 排序选项（平铺在菜单内）
      const 排序选项 = e.target.closest('.排序选项');
      if (排序选项 && 排序选项.dataset.sort) {
        备忘录排序方式 = 排序选项.dataset.sort;
        localStorage.setItem('备忘录排序方式', 备忘录排序方式);
        当前日期筛选 = null; // 退出日期筛选模式
        if (window._设置当前日期筛选) window._设置当前日期筛选(null);
        if (window.渲染备忘录列表) window.渲染备忘录列表();
        if (window.渲染文件夹树) window.渲染文件夹树();
        全局浮动菜单.classList.remove('显示');
        return;
      }
      
      // 年份项：展开/收起该年的月份
      const 年份项 = e.target.closest('.日期年份项');
      if (年份项) {
        const 年份 = 年份项.dataset.year;
        日期分组菜单已展开 = 日期分组菜单已展开 === 年份 ? null : 年份;
        更新全局浮动菜单内容();
        return;
      }
      
      // 月份项：进入日期筛选模式
      const 月份项 = e.target.closest('.日期月份项');
      if (月份项) {
        const year = 月份项.dataset.year;
        const month = 月份项.dataset.month;
        当前日期筛选 = { year, month };
        if (window._设置当前文件夹) {
          window._设置当前文件夹('__date-group__');
        }
        if (window.渲染备忘录列表) window.渲染备忘录列表();
        if (window.渲染文件夹树) window.渲染文件夹树();
        全局浮动菜单.classList.remove('显示');
        return;
      }
      
      const 菜单项 = e.target.closest('.菜单项');
      if (!菜单项) return;
      
      // 分组标题和分隔线不处理点击
      if (菜单项.classList.contains('菜单分组标题') || 菜单项.classList.contains('菜单分隔线')) return;
      
      const action = 菜单项.dataset.action;
      if (!action) return;
      
      const 当前筛选 = window._当前筛选 ? window._当前筛选() : 'all';
      
      switch (action) {
        case 'toggle-sort':
          排序菜单已展开 = !排序菜单已展开;
          更新全局浮动菜单内容();
          return;
          
        case 'clear-trash': {
          const 回收站列表 = window.备忘录管理器?.获取回收站列表?.() || [];
          if (回收站列表.length === 0) {
            window._显示提示('回收站已经是空的','info');
          } else if (await window._自定义确认(`确定要永久删除 ${回收站列表.length} 条备忘录吗？此操作不可撤销。`)) {
            try {
              const 结果 = await window.备忘录管理器.清空回收站();
              window._显示提示(`已清空回收站，永久删除了 ${结果.删除数量} 条备忘录`,'success');
            } catch (错误) {
              window._显示提示('清空回收站失败: ' + 错误.message,'error');
            }
          }
          全局浮动菜单.classList.remove('显示');
          break;
        }
          
        case 'restore-all': {
          const 回收站列表 = window.备忘录管理器?.获取回收站列表?.() || [];
          if (回收站列表.length === 0) {
            window._显示提示('回收站中没有可恢复的备忘录','info');
          } else if (await window._自定义确认(`确定要恢复 ${回收站列表.length} 条备忘录吗？`)) {
            try {
              let 恢复数量 = 0;
              for (const 备忘录 of 回收站列表) {
                await window.备忘录管理器.恢复备忘录(备忘录.id);
                恢复数量++;
              }
              window._显示提示(`已恢复 ${恢复数量} 条备忘录`,'success');
            } catch (错误) {
              window._显示提示('恢复失败: ' + 错误.message,'error');
            }
          }
          全局浮动菜单.classList.remove('显示');
          break;
        }
          
        case 'toggle-date-group':
          日期分组菜单已展开 = !日期分组菜单已展开;
          更新全局浮动菜单内容();
          return;

        case 'toggle-export-group':
          // 导出分组展开/收起
          if (导出分组菜单已展开 === false) {
            导出分组菜单已展开 = null; // 收起
          } else {
            导出分组菜单已展开 = false; // 打开（折叠状态）
          }
          更新全局浮动菜单内容();
          return;

        case 'multiselect':
          if (window.多选状态?.是否启用) {
            window.退出多选模式();
          } else {
            window.进入多选模式();
          }
          全局浮动菜单.classList.remove('显示');
          return;

        case 'clear-date-filter':
          当前日期筛选 = null;
          if (window._设置当前日期筛选) window._设置当前日期筛选(null);
          if (window._设置当前文件夹) window._设置当前文件夹('全部');
          if (window._设置当前筛选) window._设置当前筛选('all');
          console.log('[清除日期] 日期=' + (window._当前日期筛选 ? window._当前日期筛选() : 'null') + ' | 文件夹=' + (window._当前文件夹 ? window._当前文件夹() : '全部'));
          if (window.渲染备忘录列表) window.渲染备忘录列表();
          if (window.渲染文件夹树) window.渲染文件夹树();
          if (window.渲染筛选按钮) window.渲染筛选按钮();
          全局浮动菜单.classList.remove('显示');
          return;

        case 'expand-export-year': {
          // 点击导出年份展开月份
          const 年份 = e.target.closest('[data-export-year]')?.dataset.exportYear;
          if (年份) {
            if (导出分组菜单已展开 === false) {
              导出分组菜单已展开 = 年份; // 折叠状态 → 展开该年
            } else {
              导出分组菜单已展开 = 导出分组菜单已展开 === 年份 ? false : 年份; // 切换展开/折叠
            }
            更新全局浮动菜单内容();
          }
          return;
        }

        case 'expand-export-month': {
          // 点击导出月份，先确认再导出
          console.log('[导出] 点击月份检测');
          const 年份项 = e.target.closest('[data-export-year]');
          const 月份项 = e.target.closest('[data-export-month]');
          const 年份 = 年份项?.dataset.exportYear || 月份项?.dataset.exportYear;
          const 月份 = 月份项?.dataset.exportMonth;
          console.log('[导出] 年份=' + 年份 + ' 月份=' + 月份);
          if (年份 && 月份) {
            // 先获取该月备忘录数量
            const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
            const 该月数量 = 数据源.filter(m => {
              if (m.已删除) return false;
              const d = new Date(m.日期 || m.更新时间);
              const 月份Str = String(d.getMonth() + 1).padStart(2, '0');
              return d.getFullYear().toString() === String(年份) && 月份Str === String(月份).padStart(2, '0');
            }).length;
            
            // 显示导出选项卡片
            const 选择 = await window._显示导出选择对话框(`导出${年份}年${月份}月`, 该月数量);
            if (!选择) {
              console.log('[导出] 用户取消');
            } else if (选择 === 'zip') {
              console.log('[导出] 用户选择ZIP');
              await window._导出指定年月为ZIP?.(年份, 月份);
            } else {
              console.log('[导出] 用户选择JSON，调用导出函数');
              window.导出指定年月?.(年份, 月份);
            }
            全局浮动菜单.classList.remove('显示');
          } else {
            console.log('[导出] 年份或月份为空，跳过');
          }
          return;
        }

        case 'clear-ai-filter':
          // 清除 AI 临时筛选，恢复原始状态
          if (window._设置AI临时筛选) {
            window._设置AI临时筛选(null);
            if (window._设置当前文件夹) window._设置当前文件夹('全部');
            if (window._设置当前筛选) window._设置当前筛选('all');
            if (window._设置当前日期筛选) window._设置当前日期筛选(null);
            if (window._设置当前搜索关键词) window._设置当前搜索关键词('');
          }
          return;

        case 'export':
          window.导出当前列表?.();
          全局浮动菜单.classList.remove('显示');
          break;
          
        case 'ai-organize': {
          全局浮动菜单.classList.remove('显示');
          window.显示整理确认卡片();
          return;
        }

        case 'settings': {
          const 浮层 = document.getElementById('设置浮层');
          if (浮层) 浮层.style.display = 'flex';
          全局浮动菜单.classList.remove('显示');
          break;
        }
      }
    });
  }
};

// 排序/分组状态
let 备忘录排序方式原始 = localStorage.getItem('备忘录排序方式') || '最近修改';
// 兼容旧值
const 旧值映射 = { '最近修改': '编辑时间', '最早创建': '创建时间', '标题 A→Z': '编辑时间' };
let 备忘录排序方式 = 旧值映射[备忘录排序方式原始] || 备忘录排序方式原始;
localStorage.setItem('备忘录排序方式', 备忘录排序方式);
let 备忘录是否分组 = localStorage.getItem('备忘录是否分组') === 'true';

const 排序选项列表 = [
  { key: '编辑时间' },
  { key: '创建时间' },
];

// 排序展开状态
let 排序菜单已展开 = false;

// 日期分组树展开状态
let 日期分组菜单已展开 = false;
// 导出菜单展开状态
let 导出分组菜单已展开 = null; // null=收起, false=打开(折叠), '2026'=展开该年, '2026-04'=展开该月
// 当前日期筛选 { year: '2026', month: '04' } 或 null
let 当前日期筛选 = null;

// 获取有备忘录的年月集合
function 获取有备忘录的年月() {
  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  const 正常备忘录 = 数据源.filter(m => !m.已删除);
  const 年月Set = new Set();
  正常备忘录.forEach(m => {
    const d = new Date(m.日期 || m.更新时间);
    if (!isNaN(d)) {
      const y = d.getFullYear().toString();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      年月Set.add(y + '-' + mo);
    }
  });
  return 年月Set;
}

// 生成日期分组树HTML（年份→月份）
function 生成日期分组树HTML(已展开年份) {
  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  const 正常备忘录 = 数据源.filter(m => !m.已删除);
  const 年月Set = 获取有备忘录的年月();
  
  // 收集各年的月份
  const 年份月份 = {};
  年月Set.forEach(ym => {
    const [y, mo] = ym.split('-');
    if (!年份月份[y]) 年份月份[y] = [];
    年份月份[y].push(mo);
  });
  
  // 排序年份（最新在前）
  const 年份列表 = Object.keys(年份月份).sort((a, b) => Number(b) - Number(a));
  let html = '';
  年份列表.forEach(年份 => {
    const 月份列表 = 年份月份[年份].sort((a, b) => Number(b) - Number(a));
    const 年份已展开 = 已展开年份 === 年份;
    html += `<div class="菜单项 日期年份项${年份已展开 ? ' 展开' : ''}" data-year="${年份}">
      <span class="菜单文本">${年份}年</span>
      <span class="展开箭头">${年份已展开 ? '▾' : '▸'}</span>
    </div>`;
    if (年份已展开) {
      月份列表.forEach(月 => {
        const 该月备忘录 = 正常备忘录.filter(m => {
          const d = new Date(m.日期 || m.更新时间);
          return d.getFullYear().toString() === 年份 && String(d.getMonth() + 1).padStart(2, '0') === 月;
        });
        const 月名称 = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'][parseInt(月) - 1];
        html += `<div class="菜单项 日期月份项" data-year="${年份}" data-month="${月}">
          <span class="菜单文本">${月名称} (${该月备忘录.length})</span>
        </div>`;
      });
    }
  });
  
  if (年份列表.length === 0) {
    html = `<div class="菜单项" style="color:var(--文字副色);cursor:default;"><span class="菜单文本">暂无备忘录</span></div>`;
  }
  return html;
}

// 生成导出年份分组树HTML（年份→月份，长按/右键触发导出选项）
function 生成导出分组树HTML(已展开值) {
  // 使用全部备忘录（无视文件夹筛选）
  const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
  const 正常备忘录 = 数据源.filter(m => !m.已删除);
  const 年月Set = 获取有备忘录的年月();
  
  // 收集各年的月份
  const 年份月份 = {};
  年月Set.forEach(ym => {
    const [y, mo] = ym.split('-');
    if (!年份月份[y]) 年份月份[y] = [];
    年份月份[y].push(mo);
  });
  
  // 排序年份（最新在前）
  const 年份列表 = Object.keys(年份月份).sort((a, b) => Number(b) - Number(a));
  let html = '';
  
  年份列表.forEach(年份 => {
    const 月份列表 = 年份月份[年份].sort((a, b) => Number(b) - Number(a));
    const 年份已展开 = 已展开值 === 年份 || 已展开值 === `${年份}-${月份列表[0]}`;
    const 该年备忘录 = 正常备忘录.filter(m => {
      const d = new Date(m.日期 || m.更新时间);
      return d.getFullYear().toString() === 年份;
    });
    
    html += `<div class="菜单项 导出年份项${年份已展开 ? ' 展开' : ''}" data-action="expand-export-year" data-export-year="${年份}" oncontextmenu="window._导出分组右键(event, '${年份}', null)">
      <span class="菜单文本">${年份}年 (${该年备忘录.length})</span>
      <span class="展开箭头">${年份已展开 ? '▾' : '▸'}</span>
    </div>`;
    if (年份已展开) {
      月份列表.forEach(月 => {
        const 该月备忘录 = 正常备忘录.filter(m => {
          const d = new Date(m.日期 || m.更新时间);
          return d.getFullYear().toString() === 年份 && String(d.getMonth() + 1).padStart(2, '0') === 月;
        });
        const 月名称 = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'][parseInt(月) - 1];
        html += `<div class="菜单项 导出月份项" data-action="expand-export-month" data-export-year="${年份}" data-export-month="${月}" oncontextmenu="window._导出分组右键(event, '${年份}', '${月}')">
          <span class="菜单文本">${月名称} (${该月备忘录.length})</span>
        </div>`;
      });
    }
  });
  
  if (年份列表.length === 0) {
    html = `<div class="菜单项" style="color:var(--文字副色);cursor:default;"><span class="菜单文本">暂无备忘录</span></div>`;
  }
  return html;
}

// 导出分组右键处理（触发导出选项）
window._导出分组右键 = async function(e, 年份, 月份) {
  e.preventDefault();
  e.stopPropagation();
  
  const 年月 = 月份 ? `${年份}-${月份}` : 年份;
  const 选择 = await window._显示导出选择对话框(`导出${年月}`, 0);
  if (!选择) {
    console.log('[导出] 用户取消');
  } else if (选择 === 'zip') {
    if (月份) {
      await window._导出指定年月为ZIP?.(年份, 月份);
    } else {
      await window._导出指定年份为ZIP?.(年份);
    }
  } else {
    if (月份) {
      window.导出指定年月?.(年份, 月份);
    } else {
      window.导出指定年份?.(年份);
    }
  }
  
  // 关闭菜单
  const 菜单 = document.getElementById('全局浮动菜单');
  if (菜单) 菜单.classList.remove('显示');
};

// 根据当前视图更新全局浮动菜单内容
function 更新全局浮动菜单内容() {
  const 菜单 = document.getElementById('全局浮动菜单');
  if (!菜单) return;
  
  const 当前筛选 = window._当前筛选 ? window._当前筛选() : 'all';
  const 回收站列表 = window.备忘录管理器?.获取回收站列表?.() || [];
  const 回收站数量 = 回收站列表.length;
  const 多选启用 = window.多选状态?.是否启用 || false;
  
  if (当前筛选 === 'deleted') {
    菜单.innerHTML = `
      <div class="菜单项" data-action="multiselect">
        <span class="菜单文本">${多选启用 ? '退出多选' : '多选'}</span>
      </div>
      <div class="菜单项" data-action="clear-trash">
        <span class="菜单文本">清空回收站</span>
        <span class="菜单计数">${回收站数量}</span>
      </div>
      <div class="菜单项" data-action="restore-all">
        <span class="菜单文本">恢复全部</span>
      </div>
    `;
  } else {
    const 展开class = 排序菜单已展开 ? ' 展开' : '';
    菜单.innerHTML = `
      <div class="菜单项" data-action="multiselect">
        <span class="菜单文本">${多选启用 ? '退出多选' : '多选'}</span>
      </div>
      <div class="菜单项 排序触发器" data-action="toggle-sort${展开class ? '' : ''}">
        <span class="菜单文本">排序${排序菜单已展开 ? ' ▾' : ' ▸'}</span>
      </div>
      <div class="排序选项列表${展开class}">
        ${排序选项列表.map(选项 =>
          `<div class="菜单项 排序选项" data-sort="${选项.key}">
            <span class="菜单文本">${选项.key === 备忘录排序方式 ? '✓ ' : '  '}${选项.key}</span>
          </div>`
        ).join('')}
      </div>
      <div class="菜单项 菜单分隔线"></div>
      <div class="菜单项" data-action="toggle-date-group">
        <span class="菜单文本">按日期筛选${日期分组菜单已展开 ? ' ▾' : ' ▸'}</span>
      </div>
      ${日期分组菜单已展开 ? `<div class="日期分组树">${生成日期分组树HTML(日期分组菜单已展开)}</div>` : ''}
      ${当前日期筛选 ? `<div class="菜单项" data-action="clear-date-filter" style="color:var(--文字副色);">
        <span class="菜单文本">✕ 清除日期筛选</span>
      </div>` : ''}
      <div class="菜单项 菜单分隔线"></div>
      <div class="菜单项 导出触发器" data-action="toggle-export-group">
        <span class="菜单文本">导出数据${导出分组菜单已展开 !== null ? ' ▾' : ' ▸'}</span>
      </div>
      ${导出分组菜单已展开 !== null ? `<div class="导出分组树">${生成导出分组树HTML(导出分组菜单已展开 === false ? null : 导出分组菜单已展开)}</div>` : ''}
      <div class="菜单项 菜单分隔线"></div>
      <div class="菜单项" data-action="ai-organize">
        <span class="菜单文本">AI整理</span>
      </div>
      <div class="菜单项" data-action="settings">
        <span class="菜单文本">设置</span>
      </div>
    `;
  }
}

// ========== 多选模式功能 ==========

// 进入多选模式
window.进入多选模式 = function() {
  const 当前筛选 = window._当前筛选 ? window._当前筛选() : 'all';
  window.多选状态?.启用(当前筛选);
  显示多选操作栏();
  if (window.渲染备忘录列表) window.渲染备忘录列表();
};

// 退出多选模式
window.退出多选模式 = function() {
  window.多选状态?.退出();
  隐藏多选操作栏();
  if (window.渲染备忘录列表) window.渲染备忘录列表();
};

// 显示多选操作栏
function 显示多选操作栏() {
  let 操作栏 = document.getElementById('多选操作栏');
  if (!操作栏) {
    操作栏 = document.createElement('div');
    操作栏.id = '多选操作栏';
    操作栏.className = '多选操作栏';
    document.body.appendChild(操作栏);
  }
  更新多选操作栏内容();
  操作栏.classList.add('显示');
}

// 隐藏多选操作栏
function 隐藏多选操作栏() {
  const 操作栏 = document.getElementById('多选操作栏');
  if (操作栏) 操作栏.classList.remove('显示');
}

// 更新多选操作栏内容
function 更新多选操作栏内容() {
  const 操作栏 = document.getElementById('多选操作栏');
  if (!操作栏) return;
  
  const 当前筛选 = window._当前筛选 ? window._当前筛选() : 'all';
  const 选中数量 = window.多选状态?.获取数量() || 0;
  const 是回收站视图 = 当前筛选 === 'deleted';
  
  // 根据视图显示不同的批量操作按钮
  const 操作按钮 = 是回收站视图 ? `
    <button class="多选按钮" data-action="restore-selected" ${选中数量 === 0 ? 'disabled' : ''}>
      ↩️ 恢复 (${选中数量})
    </button>
    <button class="多选按钮 危险" data-action="permanent-delete-selected" ${选中数量 === 0 ? 'disabled' : ''}>
      彻底删除 (${选中数量})
    </button>
  ` : `
    <button class="多选按钮" data-action="favorite-selected" ${选中数量 === 0 ? 'disabled' : ''}>
      收藏 (${选中数量})
    </button>
    <button class="多选按钮" data-action="move-selected" ${选中数量 === 0 ? 'disabled' : ''}>
      移动 (${选中数量})
    </button>
    <button class="多选按钮 危险" data-action="delete-selected" ${选中数量 === 0 ? 'disabled' : ''}>
      删除 (${选中数量})
    </button>
    <button class="多选按钮" data-action="export-selected" ${选中数量 === 0 ? 'disabled' : ''}>
      导出 (${选中数量})
    </button>
  `;
  
  操作栏.innerHTML = `
    <div class="多选操作栏内容">
      <div class="多选左侧">
        <button class="多选按钮" data-action="select-all">全选</button>
        <button class="多选按钮" data-action="select-none">取消</button>
        <button class="多选按钮" data-action="select-inverse">反选</button>
      </div>
      <div class="多选右侧">
        ${操作按钮}
        <button class="多选按钮 次要" data-action="exit-multiselect">完成</button>
      </div>
    </div>
  `;
  
  // 绑定按钮事件
  操作栏.querySelectorAll('.多选按钮').forEach(按钮 => {
    按钮.addEventListener('click', 处理多选操作);
  });
}

// 处理多选操作
async function 处理多选操作(e) {
  const 按钮 = e.currentTarget;
  const action = 按钮.dataset.action;
  const 当前筛选 = window._当前筛选 ? window._当前筛选() : 'all';
  const 是回收站视图 = 当前筛选 === 'deleted';
  
  // 获取当前可见的备忘录ID列表
  const 获取可见ID列表 = () => {
    const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
    let 筛选后的备忘录 = 数据源;
    
    if (是回收站视图) {
      筛选后的备忘录 = 筛选后的备忘录.filter(m => m.已删除 === true);
    } else {
      筛选后的备忘录 = 筛选后的备忘录.filter(m => !m.已删除);
    }
    
    return 筛选后的备忘录.map(m => m.id);
  };
  
  switch (action) {
    case 'select-all':
      window.多选状态?.全选(获取可见ID列表());
      break;
    case 'select-none':
      window.多选状态?.取消全选();
      break;
    case 'select-inverse':
      window.多选状态?.反选(获取可见ID列表());
      break;
    case 'exit-multiselect':
      window.退出多选模式();
      return;
    case 'favorite-selected':
      await 批量收藏();
      window.退出多选模式();
      return;
    case 'move-selected':
      await 批量移动();
      // 批量移动完成后退出多选（内部已处理UI更新）
      return;
    case 'delete-selected':
      await 批量删除();
      window.退出多选模式();
      return;
    case 'restore-selected':
      await 批量恢复();
      window.退出多选模式();
      return;
    case 'permanent-delete-selected':
      await 批量永久删除();
      window.退出多选模式();
      return;
    case 'export-selected':
      window.导出选中?.();
      window.退出多选模式();
      return;
  }
  
  // 更新UI（仅全选/取消/反选走到这里）
  if (window.渲染备忘录列表) window.渲染备忘录列表();
  if (window.渲染文件夹树) window.渲染文件夹树();
  更新多选操作栏内容();
}

// 批量收藏
async function 批量收藏() {
  const 选中列表 = window.多选状态?.获取选中列表() || [];
  if (选中列表.length === 0) return;
  
  let 成功数量 = 0;
  for (const id of 选中列表) {
    try {
      const 备忘录 = (window._备忘录数据源 || window._备忘录数据 || []).find(m => m.id === id);
      if (备忘录) {
        await window.备忘录管理器?.updateMemo(id, { 收藏: !备忘录.收藏 });
        成功数量++;
      }
    } catch (e) {
      console.error('收藏失败:', id, e);
    }
  }
  window._显示提示(`已处理 ${成功数量}/${选中列表.length} 条`,'success');
  window.多选状态?.清空();
}

// 批量移动 - 使用下拉菜单选择文件夹
async function 批量移动() {
  const 选中列表 = window.多选状态?.获取选中列表() || [];
  if (选中列表.length === 0) {
    return;
  }
  
  // 获取所有文件夹
  const 文件夹树 = window._获取文件夹树 ? window._获取文件夹树() : [];
  const 所有文件夹 = [];
  function 收集文件夹(节点列表) {
    节点列表.forEach(节点 => {
      所有文件夹.push(节点.名称);
      if (节点.子文件夹) 收集文件夹(节点.子文件夹);
    });
  }
  收集文件夹(文件夹树);
  
  if (所有文件夹.length === 0) {
    window._显示提示('没有可用的文件夹','info');
    return;
  }
  
  // 创建下拉菜单（类似编辑页面的文件夹选择）
  let 下拉菜单 = document.getElementById('批量移动文件夹菜单');
  if (!下拉菜单) {
    下拉菜单 = document.createElement('div');
    下拉菜单.id = '批量移动文件夹菜单';
    下拉菜单.className = '文件夹下拉菜单';
    document.body.appendChild(下拉菜单);
  }
  
  // 构建文件夹选项HTML
  let html = 所有文件夹.map(名称 => `
    <div class="文件夹选项" data-folder="${名称}">
      ${名称}
    </div>
  `).join('');
  
  // 添加分隔线和"新建文件夹"选项
  html += `
    <div style="border-top: 1px solid #e5e7eb; margin: 4px 0;"></div>
    <div class="文件夹选项 新建文件夹选项" data-action="create-folder">
      <i class="fa fa-plus-circle text-green-500 mr-1"></i> 新建文件夹
    </div>
  `;
  
  下拉菜单.innerHTML = html;
  
  // 定位菜单（显示在多选操作栏上方居中）
  const 操作栏 = document.getElementById('多选操作栏');
  if (操作栏) {
    const 操作栏位置 = 操作栏.getBoundingClientRect();
    
    // 计算菜单位置：显示在操作栏上方，距离底部至少 80px
    const 菜单底部距离 = window.innerHeight - 操作栏位置.top + 8;
    const 菜单顶部距离 = 操作栏位置.top - 320; // 预留320px高度
    
    // 如果上方空间不够，显示在操作栏下方
    const 显示在上方 = 菜单顶部距离 > 50;
    
    下拉菜单.style.position = 'fixed';
    if (显示在上方) {
      下拉菜单.style.bottom = 菜单底部距离 + 'px';
      下拉菜单.style.top = 'auto';
    } else {
      下拉菜单.style.top = (操作栏位置.bottom + 8) + 'px';
      下拉菜单.style.bottom = 'auto';
    }
    下拉菜单.style.left = '50%';
    下拉菜单.style.transform = 'translateX(-50%)';
    下拉菜单.style.zIndex = '99999';
    下拉菜单.style.background = 'white';
    下拉菜单.style.border = '1px solid #ccc';
    下拉菜单.style.borderRadius = '12px';
    下拉菜单.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    下拉菜单.style.width = '280px';
    下拉菜单.style.padding = '8px 0';
    下拉菜单.style.maxHeight = '280px';
    下拉菜单.style.overflowY = 'auto';
    下拉菜单.classList.add('显示');
  }
  
  // 返回Promise等待用户选择
  return new Promise((resolve) => {
    // 绑定文件夹选择事件
    const 文件夹选项 = 下拉菜单.querySelectorAll('.文件夹选项:not(.新建文件夹选项)');
    文件夹选项.forEach(选项 => {
      选项.addEventListener('click', async (optEvent) => {
        optEvent.stopPropagation();
        const 目标文件夹 = 选项.dataset.folder;
        下拉菜单.classList.remove('显示');
        
        // 执行移动
        let 成功数量 = 0;
        for (const id of 选中列表) {
          try {
            await window.备忘录管理器?.updateMemo(id, { 文件夹: 目标文件夹 });
            成功数量++;
          } catch (e) {
            console.error('移动失败:', id, e);
          }
        }
        window._显示提示(`已移动 ${成功数量} 条到「${目标文件夹}」`,'success');
        window.多选状态?.清空();
        if (window.渲染备忘录列表) window.渲染备忘录列表();
        if (window.渲染文件夹树) window.渲染文件夹树();
        window.退出多选模式();
        resolve();
      });
    });
    
    // 绑定"新建文件夹"事件
    const 新建文件夹选项 = 下拉菜单.querySelector('.新建文件夹选项');
    if (新建文件夹选项) {
      新建文件夹选项.addEventListener('click', async (optEvent) => {
        optEvent.stopPropagation();
        // 用自定义对话框替代 prompt()（鸿蒙 WebView 屏蔽 prompt）
        let 文件夹名称;
        if (window._自定义输入) {
          文件夹名称 = await window._自定义输入('请输入新文件夹名称：');
        } else {
          文件夹名称 = await window._自定义输入('请输入新文件夹名称：');
        }
        if (文件夹名称 && 文件夹名称.trim()) {
          if (window._创建文件夹) {
            const 成功 = window._创建文件夹(文件夹名称.trim(), null);
            if (成功) {
              window._显示提示(`文件夹「${文件夹名称.trim()}」创建成功，请重新选择`,'success');
              if (window.渲染文件夹树) window.渲染文件夹树();
            } else {
              window._显示提示('文件夹已存在或创建失败','error');
            }
          }
        }
        下拉菜单.classList.remove('显示');
        resolve();
      });
    }
    
    // 点击外部关闭菜单
    const 关闭菜单 = (e) => {
      if (!下拉菜单.contains(e.target)) {
        下拉菜单.classList.remove('显示');
        document.removeEventListener('click', 关闭菜单);
        resolve();
      }
    };
    
    // 延迟绑定，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', 关闭菜单);
    }, 100);
    
    下拉菜单.addEventListener('click', (e) => e.stopPropagation());
  });
  
  // 清除AI筛选按钮 - 使用事件委托更可靠
  document.addEventListener('click', (e) => {
    const 清除按钮 = e.target.closest('#清除AI筛选, .清除AI筛选按钮');
    if (清除按钮) {
      console.log('[调试] 清除AI筛选按钮被点击（事件委托）');
      e.preventDefault();
      e.stopPropagation();
      // 视觉反馈
      清除按钮.style.transform = 'scale(0.9)';
      setTimeout(() => 清除按钮.style.transform = '', 100);
      if (window._设置AI临时筛选) {
        window._设置AI临时筛选(null);
        if (window._设置当前文件夹) window._设置当前文件夹('全部');
        if (window._设置当前筛选) window._设置当前筛选('all');
        if (window._设置当前日期筛选) window._设置当前日期筛选(null);
        if (window._设置当前搜索关键词) window._设置当前搜索关键词('');
      } else {
        console.error('[调试] window._设置AI临时筛选 不存在！');
      }
    }
  });
}

// 批量删除（软删除）
async function 批量删除() {
  const 选中列表 = window.多选状态?.获取选中列表() || [];
  if (选中列表.length === 0) return;
  
  if (!await window._自定义确认(`确定要将 ${选中列表.length} 条备忘录移入回收站吗？`)) return;
  
  let 成功数量 = 0;
  for (const id of 选中列表) {
    try {
      await window.备忘录管理器?.deleteMemo(id);
      成功数量++;
    } catch (e) {
      console.error('删除失败:', id, e);
    }
  }
  window._显示提示(`已将 ${成功数量} 条移入回收站`,'success');
  window.多选状态?.清空();
}

// 批量恢复
async function 批量恢复() {
  const 选中列表 = window.多选状态?.获取选中列表() || [];
  if (选中列表.length === 0) return;
  
  let 成功数量 = 0;
  for (const id of 选中列表) {
    try {
      await window.备忘录管理器?.恢复备忘录(id);
      成功数量++;
    } catch (e) {
      console.error('恢复失败:', id, e);
    }
  }
  window._显示提示(`已恢复 ${成功数量} 条`,'success');
  window.多选状态?.清空();
}

// 批量永久删除
async function 批量永久删除() {
  const 选中列表 = window.多选状态?.获取选中列表() || [];
  if (选中列表.length === 0) return;
  
  if (!await window._自定义确认(`确定要永久删除 ${选中列表.length} 条备忘录吗？此操作不可撤销！`)) return;
  
  let 成功数量 = 0;
  for (const id of 选中列表) {
    try {
      await window.备忘录管理器?.永久删除备忘录(id);
      成功数量++;
    } catch (e) {
      console.error('永久删除失败:', id, e);
    }
  }
  window._显示提示(`已永久删除 ${成功数量} 条`,'success');
  window.多选状态?.清空();
}


// 导出备忘录数据（转发到导出功能.js）
function 导出备忘录数据() {
  window.导出当前列表?.();
}

// 更新多选UI（供状态管理器调用）
// AI 工具：批量选择备忘录
window._批量选择备忘录 = function(选择条件, 选择模式) {
  if (!window.备忘录管理器) return { 选中数量: 0 };
  const 所有 = window.备忘录管理器.getAllMemos() || [];
  let 过滤后 = [];
  if (选择模式 === '全选') {
    过滤后 = 所有;
  } else if (选择条件?.关键词 || 选择条件?.标签 || 选择条件?.文件夹) {
    const 关键词 = 选择条件.关键词 || '';
    const 标签 = 选择条件.标签 || '';
    const 文件夹 = 选择条件.文件夹 || '';
    过滤后 = 所有.filter(m => {
      if (文件夹 && m.文件夹 !== 文件夹) return false;
      if (标签 && (!m.标签 || !m.标签.includes(标签))) return false;
      if (关键词 && !m.标题.includes(关键词) && !(m.内容 || '').includes(关键词)) return false;
      return true;
    });
  } else {
    过滤后 = 所有;
  }
  if (window.多选状态) {
    window.多选状态.启用();
    过滤后.forEach(m => window.多选状态.切换选中(m.id));
  }
  return { 选中数量: 过滤后.length };
};

// AI 工具：批量操作备忘录
window._批量操作备忘录 = async function(操作类型, 目标文件夹) {
  const 选中列表 = window.多选状态?.获取选中列表() || [];
  if (选中列表.length === 0) return { 处理数量: 0 };
  let 成功 = 0;
  const manager = window.备忘录管理器;
  if (!manager) return { 处理数量: 0 };
  for (const id of 选中列表) {
    try {
      if (操作类型 === '删除') { await manager.deleteMemo(id); 成功++; }
      else if (操作类型 === '永久删除') { await manager.永久删除备忘录(id); 成功++; }
      else if (操作类型 === '恢复') { await manager.恢复备忘录(id); 成功++; }
      else if (操作类型 === '移动' && 目标文件夹) { await manager.updateMemo(id, { 文件夹: 目标文件夹 }); 成功++; }
      else if (操作类型 === '收藏') { await manager.updateMemo(id, { 收藏: true }); 成功++; }
      else if (操作类型 === '取消收藏') { await manager.updateMemo(id, { 收藏: false }); 成功++; }
      else if (操作类型 === '清空') {
        const 回收站 = manager.获取回收站列表?.() || [];
        for (const m of 回收站) { await manager.永久删除备忘录(m.id); 成功++; }
      }
    } catch(e) { /* 跳过单条失败 */ }
  }
  window.多选状态?.清空();
  if (window.渲染备忘录列表) window.渲染备忘录列表();
  if (window.渲染文件夹树) window.渲染文件夹树();
  return { 处理数量: 成功 };
};

window.更新多选UI = function() {
  更新多选操作栏内容();
  if (window.渲染备忘录列表) window.渲染备忘录列表();
}

window.更新已选标签数 = 更新已选标签数;