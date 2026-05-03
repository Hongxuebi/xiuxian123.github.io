/**
 * 记忆库面板 - 渲染和管理 AI 记忆
 * 依赖：AI记忆管理器.js, 智能体管理.js
 */

// 当前标签
let 当前标签 = 'memories';

/**
 * 渲染整个记忆库面板
 */
window.渲染记忆库面板 = async function() {
  const 智能体ID = (window.当前智能体ID && window.当前智能体ID()) || 'default';
  const 配置 = window.获取当前智能体配置 && window.获取当前智能体配置();
  
  // 1. 更新智能体信息卡
  await 更新智能体信息卡(智能体ID, 配置);
  
  // 2. 根据当前标签渲染内容
  if (当前标签 === 'memories') {
    await 渲染记忆列表();
  } else {
    await 渲染智能体详情(智能体ID, 配置);
  }
};

/**
 * 更新智能体信息卡
 */
async function 更新智能体信息卡(智能体ID, 配置) {
  const 头像 = document.getElementById('记忆库智能体头像');
  const 名称 = document.getElementById('记忆库智能体名称');
  const 签名 = document.getElementById('记忆库智能体签名');
  const 元信息 = document.getElementById('记忆库智能体元信息');
  
  if (头像) 头像.textContent = 配置?.icon || '🤖';
  if (名称) 名称.textContent = 配置?.name || 智能体ID;
  if (签名) {
    const 身份 = 配置?.plugin?.core_identity || '';
    签名.textContent = 身份.length > 40 ? 身份.slice(0, 40) + '…' : 身份;
  }
  if (元信息) {
    const 现在 = new Date();
    const 创建 = 配置?.created_at ? new Date(配置.created_at) : 现在;
    const 天数 = Math.floor((现在 - 创建) / 86400000);
    元信息.textContent = `ID: ${智能体ID === 'default' ? '主人' : 智能体ID} · 已创建 ${天数} 天`;
  }
}

/**
 * 渲染记忆列表
 */
async function 渲染记忆列表() {
  const 容器 = document.getElementById('记忆库列表区');
  if (!容器) return;
  
  const 管理器 = window.AI记忆管理器;
  if (!管理器) {
    容器.innerHTML = '<div class="记忆库列表空状态"><p>记忆系统未初始化</p></div>';
    return;
  }
  
  try {
    const 所有记忆 = await 管理器.获取所有记忆();
    
    if (!所有记忆 || 所有记忆.length === 0) {
      容器.innerHTML = '<div class="记忆库列表空状态"><p>暂无记忆，开始对话后 AI 会自动记录</p></div>';
      return;
    }
    
    // 按类型和时间分组
    let html = '<div class="记忆库-列表">';
    
    for (const 记忆 of 所有记忆) {
      // 确保记忆内容不包含破坏 HTML 的字符
      const 内容 = (记忆.内容 || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const 类型 = 记忆.类型 || 'fact';
      const 重要性 = 记忆.重要性 || 5;
      const 时间 = 记忆.时间戳 ? 格式化时间(记忆.时间戳) : '';
      
      // 类型标签颜色
      const 类型标签 = {
        'fact': '<span class="记忆库-标签-类型 类型事实">事实</span>',
        'event': '<span class="记忆库-标签-类型 类型事件">事件</span>',
        'preference': '<span class="记忆库-标签-类型 类型偏好">偏好</span>',
        'reminder': '<span class="记忆库-标签-类型 类型提醒">提醒</span>'
      }[类型] || '<span class="记忆库-标签-类型">其他</span>';
      
      // 重要性星级
      let 星级 = '';
      for (let i = 0; i < 重要性; i++) 星级 += '★';
      for (let i = 重要性; i < 10; i++) 星级 += '☆';
      
      html += `
        <div class="记忆库-记忆项" data-id="${记忆.id}">
          <div class="记忆库-记忆-头部">
            ${类型标签}
            <span class="记忆库-记忆-重要性">${星级}</span>
            <span class="记忆库-记忆-时间">${时间}</span>
          </div>
          <div class="记忆库-记忆-内容">${内容}</div>
          <div class="记忆库-记忆-操作">
            <button class="记忆库-删除按钮" data-id="${记忆.id}" title="删除记忆">🗑️</button>
          </div>
        </div>`;
    }
    
    html += '</div>';
    容器.innerHTML = html;
    
    // 绑定删除事件
    容器.querySelectorAll('.记忆库-删除按钮').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(e.target.dataset.id);
        if (isNaN(id)) return;
        if (confirm('确定要删除这条记忆吗？')) {
          await 管理器.删除(id);
          await 渲染记忆列表();
        }
      });
    });
    
  } catch (错误) {
    console.error('渲染记忆列表失败', 错误);
    容器.innerHTML = '<div class="记忆库列表空状态"><p>加载记忆失败</p></div>';
  }
}

/**
 * 渲染智能体详情
 */
async function 渲染智能体详情(智能体ID, 配置) {
  const 容器 = document.getElementById('记忆库详情区');
  if (!容器) return;
  
  if (!配置) {
    容器.innerHTML = '<div class="记忆库-详情空白"><p>未加载智能体配置</p></div>';
    return;
  }
  
  const 插件 = 配置.plugin || {};
  const 权限 = 配置.memo_access || { mode: 'all', folders: [] };
  
  容器.style.display = 'block';
  容器.innerHTML = `
    <div class="记忆库-详情-卡">
      <h3 class="记忆库-详情-标题">智能体配置</h3>
      
      <div class="记忆库-详情-字段">
        <label>ID</label>
        <span class="记忆库-详情-值">${智能体ID}</span>
      </div>
      
      <div class="记忆库-详情-字段">
        <label>名称</label>
        <span class="记忆库-详情-值 可编辑" data-field="name">${escHtml(配置.name || '')}</span>
      </div>
      
      <div class="记忆库-详情-字段">
        <label>头像</label>
        <span class="记忆库-详情-值 可编辑" data-field="icon">${escHtml(配置.icon || '🤖')}</span>
      </div>
      
      <div class="记忆库-详情-字段 字段多行">
        <label>核心身份</label>
        <span class="记忆库-详情-值 可编辑" data-field="core_identity">${escHtml(插件.core_identity || '无')}</span>
      </div>
      
      <div class="记忆库-详情-字段 字段多行">
        <label>语气要求</label>
        <span class="记忆库-详情-值 可编辑" data-field="tone">${escHtml(插件.tone_requirement || '无')}</span>
      </div>
      
      <div class="记忆库-详情-字段 字段多行">
        <label>输出规则</label>
        <span class="记忆库-详情-值 可编辑" data-field="output_rules">${(插件.output_rules || []).join('\n') || '无'}</span>
      </div>
      
      <div class="记忆库-详情-字段 字段多行">
        <label>禁忌规则</label>
        <span class="记忆库-详情-值 可编辑" data-field="taboo_rules">${(插件.taboo_rules || []).join('\n') || '无'}</span>
      </div>
      
      <div class="记忆库-详情-字段">
        <label>备忘录权限</label>
        <span class="记忆库-详情-值">${权限模式文本(权限)}</span>
      </div>
      
      <div class="记忆库-详情-字段 字段多行">
        <label>系统提示词</label>
        <div class="记忆库-详情-提示词框 可编辑" data-field="system_prompt" id="记忆库提示词框">${escHtml(配置.system_prompt || '无')}</div>
        <div class="记忆库-详情-提示">双击编辑完整提示词</div>
      </div>
    </div>
  `;
  
  // ===== 编辑弹窗（统一入口，替换原生 prompt）=====
  async function 弹出编辑框(字段, 旧值) {
    return new Promise((resolve) => {
      const 遮罩 = document.createElement('div');
      遮罩.className = '记忆库编辑遮罩';
      遮罩.innerHTML = `
        <div class="记忆库编辑弹窗">
          <div class="记忆库编辑弹窗-头部">
            <span>编辑${字段}</span>
            <button class="记忆库编辑弹窗-关闭">✕</button>
          </div>
          <textarea class="记忆库编辑弹窗-文本域" spellcheck="false">${escHtml(旧值)}</textarea>
          <div class="记忆库编辑弹窗-底部">
            <button class="记忆库编辑弹窗-取消">取消</button>
            <button class="记忆库编辑弹窗-确认">保存</button>
          </div>
        </div>
      `;
      document.body.appendChild(遮罩);
      
      const 文本域 = 遮罩.querySelector('.记忆库编辑弹窗-文本域');
      const 关闭按钮 = 遮罩.querySelector('.记忆库编辑弹窗-关闭');
      const 取消按钮 = 遮罩.querySelector('.记忆库编辑弹窗-取消');
      const 确认按钮 = 遮罩.querySelector('.记忆库编辑弹窗-确认');
      
      文本域.focus();
      // 光标移到最后
      文本域.setSelectionRange(文本域.value.length, 文本域.value.length);
      
      function 关闭(结果) {
        document.body.removeChild(遮罩);
        resolve(结果);
      }
      
      关闭按钮.onclick = () => 关闭(null);
      取消按钮.onclick = () => 关闭(null);
      确认按钮.onclick = () => 关闭(文本域.value);
      遮罩.addEventListener('click', (e) => { if (e.target === 遮罩) 关闭(null); });
      文本域.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') 关闭(null);
        if (e.key === 'Enter' && e.ctrlKey) 关闭(文本域.value);
      });
    });
  }

  // 绑定可编辑字段的点击编辑
  容器.querySelectorAll('.可编辑').forEach(el => {
    el.addEventListener('dblclick', async () => {
      const 字段 = el.dataset.field;
      const 旧值 = (function() {
        if (字段 === 'output_rules') return (配置?.plugin?.output_rules || []).join('\n');
        if (字段 === 'taboo_rules') return (配置?.plugin?.taboo_rules || []).join('\n');
        if (字段 === 'system_prompt') return (配置?.system_prompt || '');
        return el.textContent;
      })();
      
      const 新值 = await 弹出编辑框(字段, 旧值);
      if (新值 === null || 新值 === 旧值) return;
      
      try {
        if (字段 === 'name') {
          const 当前配置 = { ...配置, name: 新值 };
          await 保存智能体配置(当前配置);
        } else if (字段 === 'icon') {
          const 当前配置 = { ...配置, icon: 新值 };
          await 保存智能体配置(当前配置);
        } else if (字段 === 'core_identity') {
          const 插件配置 = { ...配置.plugin, core_identity: 新值 };
          const 当前配置 = { ...配置, plugin: 插件配置 };
          await 保存智能体配置(当前配置);
        } else if (字段 === 'tone') {
          const 插件配置 = { ...配置.plugin, tone_requirement: 新值 };
          const 当前配置 = { ...配置, plugin: 插件配置 };
          await 保存智能体配置(当前配置);
        } else if (字段 === 'output_rules' || 字段 === 'taboo_rules') {
          const 规则列表 = 新值.split('\n').map(s => s.trim()).filter(Boolean);
          const 插件配置 = { ...配置.plugin, [字段 === 'taboo_rules' ? 'taboo_rules' : 'output_rules']: 规则列表 };
          const 当前配置 = { ...配置, plugin: 插件配置 };
          await 保存智能体配置(当前配置);
        } else if (字段 === 'system_prompt') {
          const 存储 = window.获取存储 && window.获取存储();
          if (存储) {
            const 智能体ID2 = (window.当前智能体ID && window.当前智能体ID()) || 'default';
            await 存储.写文件(`agents/${智能体ID2}/system.md`, 新值);
            if (window.加载智能体) await window.加载智能体(智能体ID2);
          }
        }
        
        el.textContent = 字段 === 'system_prompt' ? escHtml(新值) : 新值;
        await 更新智能体信息卡(智能体ID, window.获取当前智能体配置?.() || 配置);
      } catch (错误) {
        alert('保存失败: ' + 错误.message);
      }
    });
  });
}

/**
 * 保存智能体配置到文件
 */
async function 保存智能体配置(新配置) {
  const 存储 = window.获取存储 && window.获取存储();
  if (!存储) throw new Error('存储未初始化');
  
  const 智能体ID = (window.当前智能体ID && window.当前智能体ID()) || 'default';
  const 路径 = `agents/${智能体ID}/agent.json`;
  
  // 读取现有配置，合并更新
  let 现有 = {};
  try {
    if (await 存储.文件存在(路径)) {
      const 内容 = await 存储.读文件(路径);
      现有 = JSON.parse(内容);
    }
  } catch(e) { /* 忽略 */ }
  
  const 最终 = { ...现有, ...新配置, updated_at: new Date().toISOString() };
  await 存储.写文件(路径, JSON.stringify(最终, null, 2));
  
  // 重新加载智能体
  if (window.切换智能体) {
    await window.加载智能体(智能体ID);
  }
}

/**
 * 权限模式文本
 */
function 权限模式文本(权限) {
  if (!权限) return '无权限设置';
  if (权限.mode === 'all') return '✅ 全部备忘录';
  if (权限.mode === 'none') return '❌ 无权查看';
  if (权限.mode === 'folder_list' && 权限.folders?.length > 0) {
    return `📁 ${权限.folders.join(', ')}`;
  }
  return '❌ 无权查看';
}

/**
 * 格式化时间
 */
function 格式化时间(iso时间) {
  if (!iso时间) return '';
  const d = new Date(iso时间);
  const 月 = String(d.getMonth() + 1).padStart(2, '0');
  const 日 = String(d.getDate()).padStart(2, '0');
  const 时 = String(d.getHours()).padStart(2, '0');
  const 分 = String(d.getMinutes()).padStart(2, '0');
  return `${月}-${日} ${时}:${分}`;
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ========== 绑定事件 ==========

window.绑定记忆库面板 = function() {
  // 标签切换
  document.querySelectorAll('.记忆库-标签').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.记忆库-标签').forEach(t => t.classList.remove('激活'));
      tab.classList.add('激活');
      当前标签 = tab.dataset.tab;
      
      const 列表区 = document.getElementById('记忆库列表区');
      const 详情区 = document.getElementById('记忆库详情区');
      
      if (当前标签 === 'memories') {
        列表区.style.display = 'block';
        详情区.style.display = 'none';
        await 渲染记忆列表();
      } else {
        列表区.style.display = 'none';
        详情区.style.display = 'block';
        const 智能体ID = (window.当前智能体ID && window.当前智能体ID()) || 'default';
        const 配置 = window.获取当前智能体配置 && window.获取当前智能体配置();
        await 渲染智能体详情(智能体ID, 配置);
      }
    });
  });
  
  // 编辑智能体按钮
  const 编辑按钮 = document.getElementById('记忆库编辑智能体按钮');
  if (编辑按钮) {
    编辑按钮.addEventListener('click', () => {
      // 切换到智能体详情标签
      const 详情标签 = document.querySelector('.记忆库-标签[data-tab="details"]');
      if (详情标签) 详情标签.click();
    });
  }
  
  // 管理智能体按钮（❓）→ 弹出管理菜单
  const 管理按钮 = document.getElementById('记忆库管理智能体按钮');
  if (管理按钮) {
    管理按钮.addEventListener('click', async () => {
      const 智能体ID = (window.当前智能体ID && window.当前智能体ID()) || 'default';
      const 配置 = window.获取当前智能体配置 && window.获取当前智能体配置();
      const 名称 = 配置?.name || 智能体ID;
      
      if (智能体ID === 'default') {
        alert('默认智能体无法删除');
        return;
      }
      
      const 动作 = prompt(
        '「' + 名称 + '」管理\n\n' +
        '输入 1 并回车 → 重命名智能体\n' +
        '输入 2 并回车 → 删除该智能体（不可恢复）\n\n' +
        '取消 = 不做任何操作',
        ''
      );
      
      if (动作 === '1') {
        const 新名称 = prompt('输入新名称：', 名称);
        if (新名称 && 新名称.trim() && 新名称 !== 名称) {
          try {
            const 存储 = window.获取存储 && window.获取存储();
            if (存储) {
              const 路径 = 'agents/' + 智能体ID + '/agent.json';
              const 内容 = await 存储.读文件(路径);
              const 配置 = JSON.parse(内容);
              配置.name = 新名称.trim();
              配置.updated_at = new Date().toISOString();
              await 存储.写文件(路径, JSON.stringify(配置, null, 2));
              if (window.刷新智能体UI) await window.刷新智能体UI();
              if (window.渲染记忆库面板) await window.渲染记忆库面板();
              alert('重命名成功');
            }
          } catch (e) {
            alert('重命名失败：' + e.message);
          }
        }
      } else if (动作 === '2') {
        if (confirm('确认删除「' + 名称 + '」？此操作不可恢复！')) {
          if (confirm('再次确认：所有对话历史和记忆都将被清除。确定要删除「' + 名称 + '」吗？')) {
            if (window.删除智能体) {
              const 成功 = await window.删除智能体(智能体ID);
              if (成功 && window.刷新智能体UI) await window.刷新智能体UI();
            } else {
              alert('删除功能未就绪');
            }
          }
        }
      }
    });
  }
  
  // 监听智能体切换事件，自动刷新
  window.addEventListener('智能体切换', async () => {
    await window.渲染记忆库面板();
  });
  
  // 一键更新记忆按钮
  const 更新按钮 = document.getElementById('记忆库更新按钮');
  if (更新按钮) {
    更新按钮.addEventListener('click', async () => {
      更新按钮.textContent = '更新中…';
      更新按钮.disabled = true;
      try {
        await 一键更新记忆();
        await 渲染记忆列表();
      } catch (e) {
        console.error('一键更新失败', e);
      }
      更新按钮.textContent = '一键更新记忆';
      更新按钮.disabled = false;
    });
  }
};

/**
 * 一键更新记忆 - 从当前对话中提取重要信息更新到记忆库
 */
async function 一键更新记忆() {
  const 管理器 = window.AI记忆管理器;
  if (!管理器) throw new Error('记忆系统未初始化');
  
  // 获取当前对话管理器中的对话历史
  const 对话管理器 = window.对话管理器;
  if (!对话管理器 || typeof 对话管理器.获取当前消息列表 !== 'function') {
    console.log('对话管理器未就绪，跳过一键更新');
    return;
  }
  
  const 消息列表 = await 对话管理器.获取当前消息列表();
  if (!消息列表 || 消息列表.length < 2) {
    console.log('对话历史太短，无需更新记忆');
    return;
  }
  
  // 提取用户消息中的关键信息
  const 用户消息 = 消息列表
    .filter(m => m.role === 'user')
    .slice(-10); // 最近10条
  
  // 只提取明显的个人信息和偏好
  const 个人信息模式 = /(?:我叫|我的名字是|我是|我的职业|我在|我住在|我的生日|我的爱好|我喜欢|我不喜欢|我讨厌|我经常|我每天)/g;
  
  let 新记忆数 = 0;
  for (const 消息 of 用户消息) {
    const 内容 = 消息.content || '';
    // 匹配含个人信息的句子
    const 句子们 = 内容.split(/[。！？\n]/);
    for (const 句子 of 句子们) {
      if (个人信息模式.test(句子) && 句子.length < 100) {
        // 检查是否已存在相似的记忆
        const 已有 = await 管理器.搜索(句子.slice(0, 20), 3);
        const 已存在 = 已有.some(m => m.内容.includes(句子.slice(0, 10)));
        if (!已存在) {
          await 管理器.记住(句子.trim(), 'fact', 6);
          新记忆数++;
        }
      }
    }
  }
  
  if (新记忆数 > 0) {
    console.log(`一键更新：提取了 ${新记忆数} 条新记忆`);
  }
}

// 自动初始化（延迟到 DOM 加载和 AI记忆管理器 就绪后）
document.addEventListener('DOMContentLoaded', () => {
  // 等所有模块初始化完成后绑定
  setTimeout(() => {
    if (window.绑定记忆库面板) {
      window.绑定记忆库面板();
    }
  }, 500);
});
