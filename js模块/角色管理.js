// 角色管理.js — Live2D 视觉角色 × 智能体 AI 灵魂 双层解耦
//
// 职责：
//   1. 管理可用的 Live2D 角色列表（Haru、Mark 等）
//   2. 角色 ↔ 智能体关联（agent.json.live2dModelId）
//   3. 角色切换（加载/卸载 Live2D 模型）
//   4. 角色配置持久化（localStorage）
//
// 依赖：智能体管理.js（agent.json）、LIVE2D核心.js（懒加载）

(function() {
  'use strict';

  // ========== 可用角色定义 ==========
  // 当前只支持 Haru 和 Mark（从 doubaodadianhua 搬入的模型文件）
  const CHARACTERS = {
    'haru': {
      id: 'haru',
      name: 'Haru',
      displayName: '小春',
      modelPath: 'Haru/Haru.model3.json',
      expressions: ['F01','F02','F03','F04','F05','F06','F07','F08'],
      defaultExpression: 'F01',
      accentColor: '#3b82f6',
    },
    'hiyori': {
      id: 'hiyori',
      name: 'Hiyori',
      displayName: 'Hiyori',
      modelPath: 'Hiyori/Hiyori.model3.json',
      expressions: ['F01','F02','F03','F04','F05','F06','F07','F08'],
      defaultExpression: 'F01',
      accentColor: '#8b5cf6',
    },
    'mark': {
      id: 'mark',
      name: 'Mark',
      displayName: '马克',
      modelPath: 'Mark/Mark.model3.json',
      expressions: ['F01','F02','F03','F04','F05','F06','F07','F08'],
      defaultExpression: 'F01',
      accentColor: '#22c55e',
    },
    'natori': {
      id: 'natori',
      name: 'Natori',
      displayName: 'Natori',
      modelPath: 'Natori/Natori.model3.json',
      expressions: ['F01','F02','F03','F04','F05','F06','F07','F08'],
      defaultExpression: 'Normal',
      accentColor: '#ec4899',
    },
    'mao': {
      id: 'mao',
      name: 'Mao',
      displayName: 'Mao',
      modelPath: 'Mao/Mao.model3.json',
      expressions: ['exp_01','exp_02','exp_03','exp_04','exp_05'],
      defaultExpression: 'exp_01',
      accentColor: '#f472b6',
    },
    'gothic': {
      id: 'gothic',
      name: '哥特少女',
      displayName: '哥特少女',
      modelPath: 'characters/ゴシック少女/model03/model03.model3.json',
      expressions: [],
      defaultExpression: '',
      accentColor: '#d946ef',
    },
    'rattan': {
      id: 'rattan',
      name: '白藤',
      displayName: '白藤',
      modelPath: 'Rattan/Rattan.model3.json',
      expressions: [],
      defaultExpression: '',
      accentColor: '#c084fc',
    }
  };

  // 当前选中的角色 ID
  let _currentCharacterId = 'haru';

  // 角色显示名称覆盖（来自 localStorage，用户可重命名）
  let _customNames = {};
  try {
    _customNames = JSON.parse(localStorage.getItem('liuyunji_charNames') || '{}');
  } catch(e) {}

  // Live2D 实例引用（由 LIVE2D核心.js 设置）
  let _live2dInstance = null;

  // 当前是否通话模式
  let _inCallMode = false;

  // ========== 公共 API ==========

  /**
   * 获取所有可用角色列表
   */
  function getAvailableCharacters() {
    return Object.values(CHARACTERS).map(function(c) {
      return {
        id: c.id,
        name: c.name,
        displayName: getCharacterDisplayName(c.id),
        isCurrent: c.id === _currentCharacterId
      };
    });
  }

  /**
   * 获取当前角色 ID
   */
  function getCurrentCharacterId() {
    return _currentCharacterId;
  }

  /**
   * 获取当前角色显示名称
   */
  function getCurrentDisplayName() {
    return getCharacterDisplayName(_currentCharacterId);
  }

  /**
   * 获取角色显示名称（含用户自定义）
   */
  function getCharacterDisplayName(charId) {
    const char = CHARACTERS[charId];
    if (!char) return charId;
    return _customNames[charId] || char.displayName || char.name;
  }

  /**
   * 获取当前角色数据
   */
  function getCurrentCharacter() {
    const char = CHARACTERS[_currentCharacterId];
    if (!char) return null;
    return {
      id: char.id,
      name: char.name,
      displayName: getCharacterDisplayName(char.id),
      modelPath: char.modelPath,
      expressions: char.expressions || [],
      defaultExpression: char.defaultExpression || 'F01'
    };
  }

  /**
   * 切换角色
   * @param {string} charId - 角色 ID (haru/mark)
   */
  function switchCharacter(charId) {
    const char = CHARACTERS[charId];
    if (!char) {
      console.warn('[角色管理] 未知角色:', charId);
      return false;
    }

    const oldId = _currentCharacterId;
    _currentCharacterId = charId;

    console.log('[角色管理] 切换角色:', oldId, '→', charId);

    // 通知 UI
    _dispatchChange('switch', { oldId: oldId, newId: charId });

    // 如果有 Live2D 实例，切换模型
    if (_live2dInstance && typeof _live2dInstance.loadCharacter === 'function') {
      _live2dInstance.loadCharacter(char);
    }

    // 保存到 localStorage
    try {
      localStorage.setItem('liuyunji_currentChar', charId);
    } catch(e) {}

    return true;
  }

  /**
   * 重命名角色
   * @param {string} charId - 角色 ID
   * @param {string} newName - 新名称
   */
  function renameCharacter(charId, newName) {
    if (!CHARACTERS[charId]) return false;
    if (!newName || !newName.trim()) return false;

    _customNames[charId] = newName.trim().slice(0, 20);

    try {
      localStorage.setItem('liuyunji_charNames', JSON.stringify(_customNames));
    } catch(e) {}

    _dispatchChange('rename', { id: charId, name: _customNames[charId] });
    return true;
  }

  /**
   * 恢复角色默认名称
   */
  function resetCharacterName(charId) {
    delete _customNames[charId];
    try {
      localStorage.setItem('liuyunji_charNames', JSON.stringify(_customNames));
    } catch(e) {}
    _dispatchChange('rename', { id: charId, name: getCharacterDisplayName(charId) });
  }

  /**
   * 获取与当前智能体关联的角色 ID
   * 从 agent.json 的 live2dModelId 字段读取
   */
  function getAgentCharacterId() {
    try {
      const agentConfig = window.获取当前智能体配置 ? window.获取当前智能体配置() : null;
      if (agentConfig && agentConfig.live2dModelId) {
        return agentConfig.live2dModelId;
      }
    } catch(e) {}
    return null;
  }

  /**
   * 设置智能体关联的角色
   * 写入 agent.json 的 live2dModelId 字段
   */
  async function setAgentCharacter(charId) {
    if (!CHARACTERS[charId] && charId !== null) return false;
    
    try {
      const 存储 = window.获取存储 ? window.获取存储() : null;
      if (!存储) return false;

      const 智能体ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
      const 配置路径 = `agents/${智能体ID}/agent.json`;
      
      let 配置 = {};
      try {
        const 内容 = await 存储.读文件(配置路径);
        配置 = JSON.parse(内容);
      } catch(e) {
        配置 = {};
      }

      配置.live2dModelId = charId;
      配置.updated_at = new Date().toISOString();

      await 存储.写文件(配置路径, JSON.stringify(配置, null, 2));
      return true;
    } catch(e) {
      console.error('[角色管理] 设置智能体角色失败:', e);
      return false;
    }
  }

  /**
   * 检查指定角色是否有模型文件
   */
  function hasModel(charId) {
    return !!CHARACTERS[charId];
  }

  /**
   * 进入通话模式时，根据智能体配置自动选择角色
   */
  function autoSelectForCall() {
    const agentCharId = getAgentCharacterId();
    if (agentCharId && hasModel(agentCharId)) {
      // 智能体已关联角色，自动切换
      if (_currentCharacterId !== agentCharId) {
        switchCharacter(agentCharId);
      }
    }
    // 否则保持当前角色不变
  }

  // ========== Live2D 实例管理 ==========

  /**
   * 设置 Live2D 实例引用（由 LIVE2D核心.js 调用）
   */
  function setLive2dInstance(instance) {
    _live2dInstance = instance;
  }

  /**
   * 获取 Live2D 实例引用
   */
  function getLive2dInstance() {
    return _live2dInstance;
  }

  // ========== 事件分派 ==========

  function _dispatchChange(type, data) {
    try {
      window.dispatchEvent(new CustomEvent('character-change', {
        detail: Object.assign({ type: type }, data || {})
      }));
    } catch(e) {}
  }

  // ========== 初始化 ==========

  // 从 localStorage 恢复上次选中的角色
  (function _init() {
    try {
      const saved = localStorage.getItem('liuyunji_currentChar');
      if (saved && CHARACTERS[saved]) {
        _currentCharacterId = saved;
      }
    } catch(e) {}
    console.log('[角色管理] 初始化完成，当前角色:', _currentCharacterId);
  })();

  // ========== 监听智能体切换 ==========
  window.addEventListener('智能体切换', function(e) {
    // 智能体切换后，检查是否需要自动切换角色
    const agentCharId = getAgentCharacterId();
    if (agentCharId && hasModel(agentCharId) && _currentCharacterId !== agentCharId) {
      // 非通话模式静默切换（通话模式中不自动切换，防止中断体验）
      if (!_inCallMode) {
        switchCharacter(agentCharId);
      }
    }
  });

  // 监听通话模式变化
  window.addEventListener('voicecall-statechange', function(e) {
    const detail = e.detail || {};
    if (detail.type === 'enter') {
      _inCallMode = true;
      autoSelectForCall();
    } else if (detail.type === 'exit') {
      _inCallMode = false;
    }
  });

  // ========== 暴露到 window ==========
  window.角色管理 = {
    CHARACTERS: CHARACTERS,
    getAvailableCharacters: getAvailableCharacters,
    getCurrentCharacterId: getCurrentCharacterId,
    getCurrentDisplayName: getCurrentDisplayName,
    getCharacterDisplayName: getCharacterDisplayName,
    getCurrentCharacter: getCurrentCharacter,
    switchCharacter: switchCharacter,
    renameCharacter: renameCharacter,
    resetCharacterName: resetCharacterName,
    getAgentCharacterId: getAgentCharacterId,
    setAgentCharacter: setAgentCharacter,
    hasModel: hasModel,
    autoSelectForCall: autoSelectForCall,
    setLive2dInstance: setLive2dInstance,
    getLive2dInstance: getLive2dInstance
  };

})();
