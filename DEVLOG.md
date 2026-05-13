# love-helper 开发日志

## v7.1.0 — 通话浮层布局修复（2026-05-13）

### 问题现象

通话浮层中 Live2D canvas 框太小——love-helper 的 container 尺寸为 **1108×371**，而豆包打电话同为 **420×541**，高度差 **170px**，模型显示区域被严重压缩。

### 排查过程

#### 第一次尝试：chat-toggle-btn（21:00）

怀疑 `chat-toggle-btn` 作为 `position:relative` 的 flex 子元素，占用了 hero-area 的空间。

**修复**：改为 `position:absolute`，定位到 action-bar 上方。  
**结果**：❌ 无效，container 高度仍是 371px。

#### 第二次排查：发现真凶（21:05）

用户通过页面定位工具发现浮层中有一个 **`button#renameReset`（"恢复默认名字"）**，这是豆包打电话里没有的元素。

顺藤摸瓜，发现通话浮层（`#语音通话浮层`）作为 flex 容器，直接包含了 3 个不该出现的子元素：

| 元素 | 位置（行号） | 原状态 | 问题 |
|------|-------------|--------|------|
| `chat-toggle-btn` | ~851 | `position:relative`，参与 flex 布局 | 占高度 |
| `rename-btns` | 882-885 | 裸 `<div>`，flex 子元素，默认可见 | 占高度（取消/保存按钮） |
| `renameReset` | 886 | 裸 `<button>`，flex 子元素，默认可见 | 占高度 |

对比豆包打电话：重命名功能在 `renamePanel`（`display:none; position:absolute`），默认不占布局空间。

**根因确认**：这 3 个元素合计吃掉约 170px 高度，导致 hero-area 的 flex:1 分配到的空间只有 371px 而非预期的 ~541px。

### 修复方案

将 3 个元素全部改为 `position:absolute` + 默认 `display:none`，和豆包打电话一致，只在需要时通过 JS 显示。

#### 修改 1：`chat-toggle-btn`（之前已改，本次确认）

```css
/* 修改前 */
.chat-toggle-btn { position:relative; ... }

/* 修改后 */
.chat-toggle-btn {
  position:absolute;
  left:0; right:0;
  bottom:calc(var(--action-bar-height, 92px) + env(safe-area-inset-bottom, 0) + 4px);
  display:flex; align-items:center; justify-content:center;
  pointer-events:auto;
}
```

#### 修改 2：`rename-btns`（取消/保存按钮）

```html
<!-- 修改前：裸 flex 子元素 -->
<div class="rename-btns">
  <button class="rename-cancel" id="renameCancel">取消</button>
  <button class="rename-save" id="renameSave">保存</button>
</div>

<!-- 修改后：absolute 定位，默认隐藏 -->
<div class="rename-btns" style="display:none;position:absolute;z-index:30;
  left:0;right:0;
  bottom:calc(var(--action-bar-height, 92px) + env(safe-area-inset-bottom, 0) + 60px);
  padding:8px 24px;gap:10px;justify-content:center;
  background:rgba(10,10,15,0.9);backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);border-radius:14px;
  border:1px solid rgba(255,255,255,0.06);">
  ...
</div>
```

#### 修改 3：`renameReset`（恢复默认名字）

```html
<!-- 修改前：裸 flex 子元素 -->
<button class="rename-reset" id="renameReset">恢复默认名字</button>

<!-- 修改后：absolute 定位，默认隐藏 -->
<button class="rename-reset" id="renameReset"
  style="display:none;position:absolute;z-index:29;
    left:50%;transform:translateX(-50%);
    bottom:calc(var(--action-bar-height, 92px) + env(safe-area-inset-bottom, 0) + 16px);
    font-size:11px;color:rgba(255,255,255,0.3);cursor:pointer;
    padding:4px 16px;background:rgba(255,255,255,0.04);
    border-radius:20px;border:1px solid rgba(255,255,255,0.06);">
  恢复默认名字</button>
```

### JS 兼容性确认

检查 `showRenamePanel()` / `hideRenamePanel()` 函数，它们操作的是 `$('renamePanel')`（行 932，独立的 absolute 面板），**不受本次修改影响**。

`rename-btns` 和 `renameReset` 的显示/隐藏由各自的 JS 逻辑控制（长按角色卡片触发），改为 `display:none` 默认隐藏后，只有 JS 显式设置 `style.display` 时才会显示，行为正确。

### 验证步骤

1. 重启 debug-server（`pkill -f "node debug-server.js"` 然后重新启动）
2. 浏览器访问 `http://localhost:3777/`
3. F12 控制台，点击"语"按钮进入通话模式
4. 观察 `[DIAG] loadModel: container size=1108x???` 中的高度值
5. **预期**：高度从 371px 提升到接近 541px（豆包水平）

### Git 记录

```
v7.0.9.1-diag-log          — 改前备份标签（container=1108x371）
v7.0.9.2-chat-toggle-absolute — chat-toggle-btn 改 absolute（未完成修复）
v7.1.0-call-overlay-layout-fix — 完整修复（3 个元素全部处理）
```

- Commit: `847cabe`
- Tag: `v7.1.0-call-overlay-layout-fix`
- 已推送到 `origin/main`

### 经验总结

1. **flex 布局高度"被吃"的经典排查路径**：
   - 先确认各 flex 子元素的 `display` 和 `position`
   - `position:relative` 的 direct children 会参与 flex 分配
   - `position:absolute` 会脱离文档流，不占空间

2. **豆包打电话是黄金参考**：
   - 任何布局差异，先对比豆包的 DOM 结构和 CSS
   - 豆包没有的就可能是love-helper 多余的元素

3. **`display:none` vs `position:absolute`**：
   - 元素需要随时显示 → `position:absolute`（脱离 flex，但不必每次改 display）
   - 元素默认不需要显示 → `display:none; position:absolute`（双保险）

---

## v7.1.1 ~ v7.2.2 — 后续快速迭代（2026-05-13 深夜）

### v7.1.1 — 启动 loading 遮罩优化
- 启动 loading 改为 1.2s 自动隐藏 + `.hidden` + z-index 降为 9999
- 防止遮罩遮挡通话浮层按钮

### v7.1.3 — status-bar CSS 排除规则
- 选择器 `.通话浮层:not(#通话验证浮层).status-bar > :not(.loading-overlay)`
- 防止 loading-overlay 因强制改 relative 而占用 flex 空间

### v7.1.5 ~ v7.1.8 — 顶部栏隐藏/恢复（4 轮迭代）
- 通话模式隐藏顶部栏 → 挂断后恢复显示
- 使用 `dataset.savedDisplay` + `<style>` 内联 CSS 方案
- v7.1.8 结束时挂断后子元素不可见未解决

### v7.1.9 — 顶部栏挂断后不可见根因修复
- 根因：`_returnToVerification()` 隐藏通话浮层但未恢复顶部栏
- 修复：在 `_returnToVerification()` 增加顶部栏恢复逻辑
- 同时修复了 love-helper 和 liuyunji 两处

### v7.2.0 — caption-area 气泡 position:absolute 权重覆盖修复
- 根因：`#语音通话浮层 > *:not(.call-bg):not(.input-panel):not(.loading-overlay) { position:relative; z-index:1; }`
  权重 0-1-0 覆盖了 `.caption-area { position:absolute }` 的 0-0-1
- 导致气泡不占 flex 空间却因 position:relative 挤占 hero-area 空间，画布高度减少 ~38px
- 修复：排除列表加 `:not(.caption-area):not(.chat-toggle-btn)`
- 两端同步标签：love-helper v7.2.0, liuyunji v0.9.14

### v7.2.1 — 通话对话气泡 CSS 变量化 + 通话记录滚动修复
- 气泡背景色从 rgba 硬编码改为引用 CSS 变量（`--助理消息背景`、`--用户消息背景` 等）
- 通话记录无法滚动修复：参考豆宝打通鸿蒙版 v1.4.13→v1.4.14 diff
  - `.chat-history-panel` 加 `display:flex;flex-direction:column`
  - `.chat-panel-header` 加 `flex-shrink:0`
  - `.chat-history-list` 从 `max-height` 改为 `flex:1;overflow-y:auto`
- 两端同步标签：love-helper v7.2.1, liuyunji v0.9.15

### v7.2.2 — 通话对话重复修复
- 问题：每条 AI 消息在 chatList 中重复 2 次
- 根因：对话管理.js 的 `添加通话对话` 和 `finishTtsUI` 的 `addChat('ai', lastAiText)` 各写一遍
- 修复：`finishTtsUI` 检测到通话浮层显示时跳过 `addChat`，由对话管理.js 统一负责
- 两端同步标签：love-helper v7.2.2, liuyunji v0.9.16

---

## 历史版本速查

| 版本 | 日期 | 核心改动 |
|------|------|---------|
| v7.0.5 | 2026-05-13 | toggleChatBtn 改为豆包风格 |
| v7.0.6 | 2026-05-13 | roleName 移入 status-bar |
| v7.0.7 | 2026-05-13 | 删除 roleTitle + callTimer |
| v7.0.8 | 2026-05-13 | applyFaceZoom 公式修复 |
| v7.0.9 | 2026-05-13 | loadModel 防重入锁 |
| **v7.1.0** | **2026-05-13** | **通话浮层布局修复（本文）** |
| v7.1.1 | 2026-05-13 | 启动 loading 遮罩优化 |
| v7.1.3 | 2026-05-13 | status-bar CSS 排除规则 |
| v7.1.5~7.1.8 | 2026-05-13 | 顶部栏隐藏/恢复（4 轮迭代） |
| v7.1.9 | 2026-05-13 | 顶部栏挂断后修复 |
| **v7.2.0** | **2026-05-13** | **caption-area 权重覆盖修复** |
| v7.2.1 | 2026-05-13 | 气泡 CSS 变量化 + 滚动修复 |
| v7.2.2 | 2026-05-13 | 通话对话重复修复 |

---

## v7.2.4 ~ v7.2.5 — 通话对话记录面板覆盖 action-bar（2026-05-13）

### 问题现象
展开对话记录面板时，底部的 action-bar（通话按钮区域）被往上挤，而非被面板覆盖。

### 排查过程
1. **第一次尝试（v7.2.4）**：`.chat-history-panel` 去掉 `display:flex;flex-direction:column`，`.chat-history-list` 从 `flex:1` 改为 `max-height:calc(40vh-44px)` — ❌ 无效
2. **根因定位**：CSS 特异性覆盖
   - 第208行规则 `#语音通话浮层 > *:not(...一堆排除项) { position:relative; z-index:1; }`
   - 特异性 **(1, 5, 0)**（1个ID + 5个伪类）
   - `.chat-history-panel { position:absolute }` 特异性只有 **(0, 1, 0)**
   - → `position:relative` 覆盖了 `position:absolute`，面板参与 flex 布局

### 修复（v7.2.5）
在排除列表追加 4 个 absolute 定位元素：`:not(.chat-history-panel):not(.action-overlay):not(.rename-btns):not(.rename-reset)`
同时去掉 `.chat-history-panel` 的 `flex-direction:column`（不需要了），`.chat-history-list` 保持 `max-height + overflow-y:auto`。

## v7.2.6 — 锁定模式桌面端触发挂断修复（2026-05-13 深夜）

### 问题现象
桌面端点击 🔒（锁定模式）按钮时，不发送语音而是直接挂断。鸿蒙端正常。

### 根因：输入设备差异
同一元素 `#hangupBtn` 上有两个独立 `addEventListener`：
1. `_D.hb` 监听（滑动交互层，先注册）— 锁定模式下调 `_finishLk()` 解锁+发送语音
2. `$('hangupBtn')` 监听（通用挂断层，后注册）— 始终执行完整挂断

- **鸿蒙（触摸屏）**：touchstart → touchend → `_D.hb` touchend 触发 → `e.preventDefault()` **阻止浏览器合成 click** → `$('hangupBtn')` click 永远不触发 ✅
- **桌面（鼠标）**：mousedown → mouseup → 浏览器合成 click → `_D.hb` 没绑鼠标事件 → `$('hangupBtn')` click 直接触发 → 挂断 ❌

### 修复
在 `_D.hb` 上加 `mousedown` 监听器，和 touchend 同样的逻辑（`e.preventDefault()` 阻止后续 click 合成 + `_finishLk()` 解锁发送）。保持与 doubaodadianhua 鸿蒙版代码结构完全一致。

### 经验
- 触摸屏独占的行为（touch events）在桌面端不触发，需要补全 mouse 事件等价处理
- `stopPropagation` vs `stopImmediatePropagation`：前者只阻止冒泡，后者还阻止同元素后续监听器。但鸿蒙端正确方案是 touchend 的 `preventDefault()` 阻断 click 合成，比 `stopImmediatePropagation` 更干净

## 总结（05-13 完整日）

| 版本 | 改动要点 |
|------|---------|
| v7.1.9 | 顶部栏挂断后不可见修复（_returnToVerification 缺恢复顶部栏） |
| v7.2.0 | caption-area position:absolute 被 CSS 权重覆盖修复 |
| v7.2.1 | 气泡 CSS 变量化 + 通话记录 flex 滚动修复 |
| v7.2.2 | 通话对话重复修复（finishTtsUI 跳过 addChat） |
| v7.2.3 | 页面加载时提前播放招呼语修复 |
| v7.2.4~7.2.5 | 对话记录面板覆盖 action-bar 修复 |
| v7.2.6 | 锁定模式桌面端触发挂断修复（补 _D.hb mousedown） |

## v7.2.9 — 2026-05-14
### 智能体编辑面板 TTS 语音参数
- **智能体编辑面板.js**: Live2D 角色字段后追加"TTS 语音参数"字段，含音调(pitch 0.5-2.0)和语速(speed 0.5-2.0)滑块，滑动结束自动保存到智能体配置
- **智能体编辑面板-样式.css**: 追加 `.智能体编辑-tts参数`、`.tts-slider-row`、滑块样式
- **index.html**: `aiSpeak` TTS 参数读取改为优先从智能体配置(`获取当前智能体配置()`)取 `ttsPitch`/`ttsSpeed`，fallback 到 `loadTtsSettings(currentCharacterId)`
