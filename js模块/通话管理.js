// 通话管理.js — 语音通话状态机
//
// 职责：
//   1. 管理通话状态（空闲/说话/聆听/等待AI）
//   2. 协调 TTS-ASR桥接.js 与 对话管理.js
//   3. 自动对话循环（模式切换）
//   4. 通话 UI 控制
//
// 依赖：TTS_ASR桥接、对话管理.js（window.发送消息）

(function() {
  'use strict';

  // ========== 通话状态 ==========
  const STATE = {
    IDLE: 'idle',           // 空闲
    SPEAKING: 'speaking',   // TTS 正在朗读
    LISTENING: 'listening', // ASR 正在聆听
    WAITING: 'waiting',     // 等待 AI 回复
    RINGING: 'ringing'      // 来电振铃（预留）
  };

  let _currentState = STATE.IDLE;

  // 自动对话模式
  let _autoMode = false;    // 自动对话模式开启
  let _isLocked = false;    // 锁定持续录音

  // 自动对话定时器
  let _autoRecTimer = null;

  // 通话中标记（用于 API调用.js 分流）
  let _inVoiceCall = false;

  // 待朗读的 AI 回复文本
  let _pendingSpeakText = '';

  // 上一次识别结果（用于自动模式发送）
  let _lastAsrText = '';

  // ========== 公共方法 ==========

  /**
   * 获取当前通话状态
   */
  function getState() {
    return _currentState;
  }

  /**
   * 是否处于通话模式（供 API调用.js 等模块判断）
   */
  function isInVoiceCall() {
    return _inVoiceCall;
  }

  /**
   * 是否开启自动对话模式
   */
  function isAutoMode() {
    return _autoMode;
  }

  /**
   * 进入通话模式
   * @param {boolean} autoStart - 是否自动开始聆听
   */
  function enterCallMode(autoStart) {
    if (_inVoiceCall) return;
    _inVoiceCall = true;
    _currentState = STATE.IDLE;
    
    console.log('[通话管理] 进入通话模式');

    // 绑定 TTS/ASR 事件
    _bindEvents();

    // 通知 UI
    _dispatchStateChange('enter');

    if (autoStart) {
      toggleAutoMode(true);
    }
  }

  /**
   * 退出通话模式
   */
  function exitCallMode() {
    if (!_inVoiceCall) return;
    _inVoiceCall = false;
    _autoMode = false;
    _isLocked = false;
    
    // 清理
    _clearAutoTimer();
    window.TTS_ASR桥接.stopSpeak();
    window.TTS_ASR桥接.stopListening();

    // 解绑事件
    _unbindEvents();

    _currentState = STATE.IDLE;
    
    console.log('[通话管理] 退出通话模式');
    _dispatchStateChange('exit');
  }

  /**
   * 开始说话（用户输入文本后调用，或自动模式 ASR 识别后调用）
   * @param {string} text - 要发送给 AI 的文本
   */
  function sendVoiceMessage(text) {
    if (!_inVoiceCall) return;
    if (!text || !text.trim()) return;

    _currentState = STATE.WAITING;
    _dispatchStateChange('waiting');

    console.log('[通话管理] 发送语音消息:', text.slice(0, 50));

    // 调用流云记的发送消息函数（对话管理.js）
    if (typeof window.发送消息 === 'function') {
      window.发送消息(text);
    } else {
      console.error('[通话管理] window.发送消息 不存在');
    }
  }

  /**
   * AI 回复到达时，朗读回复
   * 此方法由对话面板.js 或 API调用.js 在收到 AI 回复后调用
   * @param {string} text - AI 回复文本
   */
  function onAiReply(text) {
    if (!_inVoiceCall) return;
    if (!text || !text.trim()) return;

    // 清理 AI 回复文本（去除 markdown 标记、工具调用痕迹等）
    const cleanText = _cleanAiText(text);
    if (!cleanText) return;

    _pendingSpeakText = cleanText;
    
    // 开始朗读
    _currentState = STATE.SPEAKING;
    _dispatchStateChange('speaking');
    
    window.TTS_ASR桥接.speak(cleanText, 1.0, 1.0);
    console.log('[通话管理] 开始朗读 AI 回复:', cleanText.slice(0, 50));
  }

  /**
   * 打断当前朗读（用户点击打断）
   */
  function interruptTts() {
    _clearAutoTimer();
    window.TTS_ASR桥接.stopSpeak();
    _currentState = STATE.IDLE;
    _dispatchStateChange('idle');
    console.log('[通话管理] 打断朗读');
  }

  /**
   * 切换自动对话模式
   */
  function toggleAutoMode(force) {
    _autoMode = typeof force === 'boolean' ? force : !_autoMode;
    console.log('[通话管理] 自动对话模式:', _autoMode ? '开启' : '关闭');
    _dispatchStateChange('autoModeChange');
    
    if (_autoMode && _currentState === STATE.IDLE) {
      _startListening();
    }
    if (!_autoMode) {
      _clearAutoTimer();
    }
  }

  /**
   * 锁定持续录音
   */
  function toggleLock() {
    _isLocked = !_isLocked;
    console.log('[通话管理] 锁定录音:', _isLocked);
    _dispatchStateChange('lockChange');
  }

  /**
   * 手动开始聆听
   */
  function startManualListen() {
    if (_currentState === STATE.LISTENING) return;
    _startListening();
  }

  /**
   * 手动停止聆听并发送
   */
  function stopManualListen() {
    if (_currentState !== STATE.LISTENING) return;
    window.TTS_ASR桥接.stopListening();
  }

  // ========== 内部方法 ==========

  function _startListening() {
    _clearAutoTimer();
    _lastAsrText = '';
    _currentState = STATE.LISTENING;
    _dispatchStateChange('listening');
    window.TTS_ASR桥接.startListening();
  }

  function _clearAutoTimer() {
    if (_autoRecTimer) {
      clearTimeout(_autoRecTimer);
      _autoRecTimer = null;
    }
  }

  /**
   * 清理由 Markdown 标记和工具调用痕迹
   */
  function _cleanAiText(text) {
    if (!text) return '';
    
    // 去除工具调用相关标记
    let cleaned = text
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
      .replace(/<\|tool_calls_section_begin\|>[\s\S]*?<\|tool_calls_section_end\|>/g, '')
      .replace(/<\|tool_calls_section_begin\|>[\s\S]*$/, '')
      .replace(/<\|user_query_section_begin\|>[\s\S]*?<\|user_query_section_end\|>/g, '')
      // 去除 markdown 标记
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // 限制朗读长度（30字口语化，同豆宝策略）
    if (cleaned.length > 120) {
      cleaned = cleaned.slice(0, 120) + '…';
    }
    
    return cleaned;
  }

  function _dispatchStateChange(type) {
    const detail = {
      type: type,
      state: _currentState,
      autoMode: _autoMode,
      isLocked: _isLocked,
      inCall: _inVoiceCall
    };
    // 触发自定义事件，供 UI 模块监听
    try {
      window.dispatchEvent(new CustomEvent('voicecall-statechange', { detail: detail }));
    } catch(e) {}
  }

  // ========== TTS/ASR 事件处理 ==========

  function _onTtsStart() {
    _currentState = STATE.SPEAKING;
    _dispatchStateChange('speaking');
  }

  function _onTtsComplete() {
    console.log('[通话管理] TTS 完成');
    _currentState = STATE.IDLE;
    _dispatchStateChange('idle');

    // 自动对话模式：TTS 播完自动开始聆听
    if (_autoMode && _inVoiceCall) {
      _autoRecTimer = setTimeout(function() {
        if (_autoMode && _inVoiceCall && _currentState === STATE.IDLE) {
          _startListening();
        }
      }, 800); // 800ms 停顿后自动聆听
    }
  }

  function _onTtsStop() {
    _currentState = STATE.IDLE;
    _dispatchStateChange('idle');
  }

  function _onTtsError(data) {
    console.error('[通话管理] TTS 错误:', data.message);
    _currentState = STATE.IDLE;
    _dispatchStateChange('idle');
  }

  function _onTtsData(data) {
    // 嘴型电平数据 — 转发给 Live2D 模块
    try {
      window.dispatchEvent(new CustomEvent('voicecall-mouthlevel', { detail: { level: data.level } }));
    } catch(e) {}
  }

  function _onAsrStart() {
    _currentState = STATE.LISTENING;
    _dispatchStateChange('listening');
  }

  function _onAsrResult(data) {
    const text = (data.text || '').trim();
    console.log('[通话管理] ASR 识别:', text);
    _lastAsrText = text;
    
    try {
      window.dispatchEvent(new CustomEvent('voicecall-asrresult', { detail: { text: text } }));
    } catch(e) {}

    // 自动对话模式：识别到有效文本后自动发送
    if (text && _autoMode && _inVoiceCall) {
      _clearAutoTimer();
      sendVoiceMessage(text);
    }
  }

  function _onAsrComplete() {
    console.log('[通话管理] ASR 完成');
    _currentState = STATE.IDLE;
    _dispatchStateChange('idle');

    // 非自动模式：识别完成后发送
    if (!_autoMode && _lastAsrText && _inVoiceCall && !_isLocked) {
      sendVoiceMessage(_lastAsrText);
      _lastAsrText = '';
    }
  }

  function _onAsrError(data) {
    console.error('[通话管理] ASR 错误:', data.message);
    _currentState = STATE.IDLE;
    _dispatchStateChange('idle');
    
    try {
      window.dispatchEvent(new CustomEvent('voicecall-asrerror', { detail: { message: data.message } }));
    } catch(e) {}
  }

  function _onAudioLevel(data) {
    // 音量电平 — 转发给 UI
    try {
      window.dispatchEvent(new CustomEvent('voicecall-audiolevel', { detail: { size: data.size } }));
    } catch(e) {}
  }

  let _eventsBound = false;

  function _bindEvents() {
    if (_eventsBound) return;
    _eventsBound = true;
    
    window.TTS_ASR桥接.on('ttsStart', _onTtsStart);
    window.TTS_ASR桥接.on('ttsComplete', _onTtsComplete);
    window.TTS_ASR桥接.on('ttsStop', _onTtsStop);
    window.TTS_ASR桥接.on('ttsError', _onTtsError);
    window.TTS_ASR桥接.on('ttsData', _onTtsData);
    window.TTS_ASR桥接.on('asrStart', _onAsrStart);
    window.TTS_ASR桥接.on('asrResult', _onAsrResult);
    window.TTS_ASR桥接.on('asrComplete', _onAsrComplete);
    window.TTS_ASR桥接.on('asrError', _onAsrError);
    window.TTS_ASR桥接.on('audioLevel', _onAudioLevel);
  }

  function _unbindEvents() {
    if (!_eventsBound) return;
    _eventsBound = false;
    
    window.TTS_ASR桥接.off('ttsStart', _onTtsStart);
    window.TTS_ASR桥接.off('ttsComplete', _onTtsComplete);
    window.TTS_ASR桥接.off('ttsStop', _onTtsStop);
    window.TTS_ASR桥接.off('ttsError', _onTtsError);
    window.TTS_ASR桥接.off('ttsData', _onTtsData);
    window.TTS_ASR桥接.off('asrStart', _onAsrStart);
    window.TTS_ASR桥接.off('asrResult', _onAsrResult);
    window.TTS_ASR桥接.off('asrComplete', _onAsrComplete);
    window.TTS_ASR桥接.off('asrError', _onAsrError);
    window.TTS_ASR桥接.off('audioLevel', _onAudioLevel);
  }

  // ========== 暴露到 window ==========
  window.通话管理 = {
    STATE: STATE,
    getState: getState,
    isInVoiceCall: isInVoiceCall,
    isAutoMode: isAutoMode,
    enterCallMode: enterCallMode,
    exitCallMode: exitCallMode,
    sendVoiceMessage: sendVoiceMessage,
    onAiReply: onAiReply,
    interruptTts: interruptTts,
    toggleAutoMode: toggleAutoMode,
    toggleLock: toggleLock,
    startManualListen: startManualListen,
    stopManualListen: stopManualListen
  };

  console.log('[通话管理] 模块初始化完成');

})();
