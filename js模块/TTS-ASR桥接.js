// TTS-ASR桥接.js — JS 端原生桥接模块
// 
// 职责：
//   1. 接收 Index.ets 通过 sendToWebView 发来的原生事件
//   2. 向上层模块（通话管理.js、角色管理.js）暴露 TTS/ASR API
//   3. 管理事件监听器注册/注销
//   4. 兼容豆宝内联脚本的 handleNativeEvent
//
// 依赖：__nativeBridge__ 已由 Index.ets 通过 javaScriptProxy 注入
//
// 事件路由：Index.ets → sendToWebView → _onNativeEvent → handleNativeEvent + _emit

(function() {
  'use strict';

  // ========== 事件监听器管理 ==========
  const _listeners = {};

  function on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  }

  function off(event, fn) {
    const list = _listeners[event];
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  }

  function _emit(event, data) {
    const list = _listeners[event];
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try { list[i](data); } catch(e) {
        console.error('[TTS-ASR桥接] 事件处理异常:', event, e);
      }
    }
  }

  // ========== 原生事件处理函数 ==========
  // 这是 Index.ets 的 sendToWebView 需要调用的入口
  // 同时转发给豆宝内联脚本的 handleNativeEvent

  function _onNativeEvent(msg, data) {
    // ★ 豆宝内联脚本兼容：转发给 handleNativeEvent
    // 豆宝的嘴型同步、TTS完成回调、ASR结果处理都在 handleNativeEvent 中
    if (typeof window.handleNativeEvent === 'function') {
      try { window.handleNativeEvent(msg, data); } catch(e) {
        console.error('[TTS-ASR桥接] handleNativeEvent 异常:', e);
      }
    }

    // 本模块事件分发
    switch (msg) {
      case 'onTtsStart':
        _emit('ttsStart', {});
        break;
      case 'onTtsComplete':
        _emit('ttsComplete', {});
        break;
      case 'onTtsStop':
        _emit('ttsStop', {});
        break;
      case 'onTtsError':
        _emit('ttsError', { message: data });
        break;
      case 'onTtsData':
        _emit('ttsData', { level: parseFloat(data) || 0 });
        break;
      case 'onAsrStart':
        _emit('asrStart', {});
        break;
      case 'onAsrResult':
        _emit('asrResult', { text: data });
        break;
      case 'onAsrComplete':
        _emit('asrComplete', {});
        break;
      case 'onAsrError':
        _emit('asrError', { message: data });
        break;
      case 'onAudioLevel':
        _emit('audioLevel', { size: parseInt(data) || 0 });
        break;
      default:
        console.log('[TTS-ASR桥接] 未知原生事件:', msg, data);
    }
  }

  // ========== 注册到 bridge 和 window（双保险） ==========
  // 鸿蒙 javaScriptProxy 代理对象可能被冻结，动态属性赋值可能静默失败
  // 所以同时注册到 window 上，让 sendToWebView 有多个查找路径

  const bridge = window.__nativeBridge__ || window.nativeBridge;
  let bridgeRegistered = false;
  
  if (bridge) {
    try {
      bridge._onNativeEvent = _onNativeEvent;
      // 验证赋值是否成功
      if (typeof bridge._onNativeEvent === 'function') {
        bridgeRegistered = true;
        console.log('[TTS-ASR桥接] ✅ bridge._onNativeEvent 注册成功');
      }
    } catch(e) {
      console.warn('[TTS-ASR桥接] bridge._onNativeEvent 赋值失败:', e.message);
    }
  }

  // 兜底：同时注册到 window，供 sendToWebView 查找
  window._nativeEventHandler = _onNativeEvent;
  console.log('[TTS-ASR桥接] window._nativeEventHandler 注册完成（兜底路径）');

  // 如果 bridge 注册失败，建议修改 sendToWebView 查找路径
  if (!bridgeRegistered) {
    console.warn('[TTS-ASR桥接] ⚠️ bridge 代理对象可能被冻结，sendToWebView 需要检查 window._nativeEventHandler');
  }

  // ========== 公共 API ==========

  function speak(text, pitch, speed) {
    const b = window.__nativeBridge__ || window.nativeBridge;
    if (!b || typeof b.ttsSpeak !== 'function') {
      console.warn('[TTS-ASR桥接] ttsSpeak 不可用');
      return;
    }
    b.ttsSpeak(text || '', pitch, speed);
  }

  function stopSpeak() {
    const b = window.__nativeBridge__ || window.nativeBridge;
    if (!b || typeof b.ttsStop !== 'function') return;
    b.ttsStop();
  }

  function startListening() {
    const b = window.__nativeBridge__ || window.nativeBridge;
    if (!b || typeof b.startAsr !== 'function') {
      console.warn('[TTS-ASR桥接] startAsr 不可用');
      return;
    }
    b.startAsr();
  }

  function stopListening() {
    const b = window.__nativeBridge__ || window.nativeBridge;
    if (!b || typeof b.stopAsr !== 'function') return;
    b.stopAsr();
  }

  function isTtsAvailable() {
    const b = window.__nativeBridge__ || window.nativeBridge;
    return !!(b && typeof b.ttsSpeak === 'function');
  }

  function isAsrAvailable() {
    const b = window.__nativeBridge__ || window.nativeBridge;
    return !!(b && typeof b.startAsr === 'function');
  }

  // ========== 暴露到 window ==========
  window.TTS_ASR桥接 = {
    on: on,
    off: off,
    speak: speak,
    stopSpeak: stopSpeak,
    startListening: startListening,
    stopListening: stopListening,
    isTtsAvailable: isTtsAvailable,
    isAsrAvailable: isAsrAvailable
  };

  console.log('[TTS-ASR桥接] 模块初始化完成', {
    ttsAvailable: isTtsAvailable(),
    asrAvailable: isAsrAvailable(),
    bridgeRegistered: bridgeRegistered
  });

})();
