# PhiMystra Android 版设计文档

## 概述

将现有 PhiMystra 桌面制谱器移植到 Android 平台。使用 Tauri 2 的 Android 支持，复用现有 React + TypeScript 代码，打包为 APK。

## 目标

- 用户在手机上选音频 → 分析 → 生成谱面 → 预览播放 → 导出 .pez → Android 分享菜单直接发给 Phira 导入
- 代码复用率 ~90%（音频分析、谱面生成、Canvas 渲染、Web Audio 播放、.pez 打包全部不变）

## 平台

- Android（API 24+ / Android 7.0+）
- 打包格式：APK
- 技术栈：Tauri 2 + React 18 + TypeScript（与桌面版相同）

## 改动范围

### 1. 分享到 Phira（新增功能）

生成 .pez 后通过 Android Share Intent 分享文件：

- **优先方案**：浏览器原生 `navigator.share({ files: [File] })` API
  - Android WebView 自 Chrome 75+ 支持
  - 需要用户手势触发（按钮点击）
  - 分享菜单中 Phira 会自动出现（前提：Phira 注册了 .pez/.zip MIME type）
- **降级方案**：如果 `navigator.share` 不支持文件分享，写 Tauri Rust 自定义命令
  - 在 `lib.rs` 中添加 `#[tauri::command]` 函数
  - 使用 Android JNI 创建 `ACTION_SEND` Intent
  - 通过 `tauri::Window::emit` 回传结果

**流程**：
```
生成谱面 → exportPez() 编译到 Uint8Array
→ 创建 Blob + File 对象
→ navigator.share({ files: [pezFile], title: "导入谱面到 Phira" })
→ Android 弹出分享菜单 → 用户选 Phira → Phira 直接导入
```

### 2. 桌面 API 替换

| 桌面版 | 移动版 | 实现方式 |
|--------|--------|----------|
| 拖拽导入音频 | 点击选文件 | 已有 `<input type="file">`，拖拽区改为提示点击 |
| `save()` + `writeFile()` 导出 .pez | `navigator.share()` 分享 | 移除 Tauri dialog/fs 导出路径 |
| `open()` 选背景图 | `<input type="file" accept="image/*">` | 替换 BackgroundImporter 的 Tauri 调用 |
| ⚙️ 设置面板检查更新 | 隐藏更新检查 | 移动端通过应用商店/重新下载更新 |
| `openUrl()` 打开下载链接 | 不需要 | 移动端无桌面版更新流程 |

### 3. UI 响应式适配

**全局样式**：
- 移除 `maxWidth: 900px`，改为 `width: 100%` + `padding: 16px`
- 按钮最小高度 44px（Android 触控标准）
- 字体适配 `rem` 单位

**预览播放横屏**：
- 进入预览播放时，通过 CSS `@media (orientation: portrait)` 提示用户旋转手机
- 或通过 Tauri Android API 设置 `setRequestedOrientation(LANDSCAPE)`
- Canvas 宽度从固定 800px 改为 `100%` + `aspect-ratio: 3/2`

**设置面板**：
- 桌面版：`position: fixed; top: 60px; right: 24px`（小弹窗）
- 移动版：全屏 modal（`position: fixed; inset: 0`）

**信息编辑器**：
- 桌面版：2 列 flex 布局（输入框 + 信息面板）
- 移动版：单列堆叠

### 4. Tauri Android 配置

**环境要求**：
- Android SDK (API 33+)
- Android NDK
- JDK 17
- Rust target: `aarch64-linux-android` + `armv7-linux-androideabi` + `i686-linux-android` + `x86_64-linux-android`

**Tauri 配置**：
- `tauri.conf.json` 已有 `bundle.android` 配置段
- 添加 `capabilities/mobile.json`，权限与桌面版相同（dialog + fs + http）
- `lib.rs` 注册 Android 生命周期插件

**构建流程**：
```bash
cd 源代码
npx tauri android init
npx tauri android build  # 生成 APK
```

### 5. 不变的部分（直接复用）

以下模块 100% 复用，零修改：

- `src/modules/audioAnalysis/` — 音频解码 + 节奏检测（纯 JS DSP）
- `src/modules/chartEngine/` — 谱面生成器（noteGenerator + difficultyParams）
- `src/modules/phiraEngine/renderer.ts` — Canvas 2D 渲染（Phigros 1350×900 逻辑空间）
- `src/modules/phiraEngine/previewEngine.ts` — Web Audio 播放引擎
- `src/modules/phiraEngine/eventParser.ts` — RPE 事件解析
- `src/modules/pezExporter/` — .pez zip 打包（fflate）
- `src/types/rpe.ts` — RPE 类型定义
- `public/` — 贴图和音效资源

## 平台检测策略

```typescript
// 使用 Tauri 的平台检测
import { platform } from '@tauri-apps/plugin-os'

const isMobile = platform() === 'android' || platform() === 'ios'

// 根据平台选择导出方式
if (isMobile) {
  // navigator.share() 分享
} else {
  // save() + writeFile() 桌面导出
}
```

## 测试策略

1. **本地验证**：先在桌面浏览器模拟移动端视口测试 UI
2. **APK 测试**：构建 APK 安装到手机，测试完整流程
3. **Phira 分享测试**：确认分享菜单中 Phira 出现且能导入

## 风险与应对

| 风险 | 可能性 | 应对 |
|------|--------|------|
| `navigator.share` 不支持文件 | 中 | 降级到 Rust 自定义 Intent 命令 |
| 音频分析在低端手机上慢 | 中 | 添加进度提示，考虑 Web Worker |
| Canvas 渲染在手机上卡顿 | 低 | Phigros 坐标空间已优化，Canvas 2D 性能足够 |
| Phira 未注册 .pez MIME type | 低 | 用户仍可通过「保存文件」手动导入 |
| Tauri Android 构建环境复杂 | 高 | 需要 Android SDK + NDK，构建时间较长 |
