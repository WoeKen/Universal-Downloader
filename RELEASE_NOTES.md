# 🚀 Universal Downloader v1.2.3 (全能下载器旗舰正式版)

> **Next-Gen Liquid Glass Multi-Protocol Media & Stream Workstation**
> 专为极致性能与极简美学打造的 Windows & Android 全协议下载与媒体工作站。

---

## 🌟 v1.2.3 版本升级与更新机制强化

### 1. 🔄 原生双向动态版本绑定 (Zero Misleading Update)
- **接入 Android 原生版本反射 API**：移动端直接通过 `getAppVersion()` 获取系统安装包真实版本号，界面版本文字与比较基准保持绝对同步；
- **精准版本比对算法**：严格提取纯数字语义化版本（SemVer），比对逻辑绝不发生误触发；已是最新版本时即时弹出「🎉 当前已是最新版本」，不再反复弹出更新面板。

### 2. 🛡️ 双端 DOM 语法树 100% 严苛校验通过 (0 Mismatches / 0 Unclosed)
- **修复 Windows 客户端潜伏的标签未闭合**：彻底修复了 Windows 端 `src/index.html` 内部潜伏的一处 `<label>` 漏闭合错误，防止多弹窗相互覆盖；
- **Android 模态层与底层解耦**：所有弹窗（设置、投递、联系、播放器、更新）完全独立挂载在 Root DOM 下，独立生命周期管理。

### 3. ⚡ 真正的全格式多模态下载分类保护
- **彻底消除格式覆写 Bug**：修复了在下载 APK、PDF/Office 文档、ZIP/RAR 压缩包、高清图片时类型被强转为视频的问题，100% 保留真实文件格式与 MIME 属性；
- **全平台音频/视频按需透析**：Instagram、Twitter/X、YouTube、Bilibili、小红书、快手等平台全面支持自由选择 `[⚡ 智能自适应]` / `[🎬 极清视频 (MP4)]` / `[🎵 提取音频 (MP3)]`；
- **下载异常实时回调**：Java 原生下载层新增 `window.onNativeDownloadFailed` 异常捕获通道，遇到网络断开或鉴权失败时即时更新任务卡片状态，杜绝界面无限假死等待。

### 4. 🎬 视频流 Byte-Range (HTTP 206) 拖拽缓冲直通
- **本地流式代理支持 Range 协议**：在 Android 原生虚拟流代理（`/local-media`）中新增 `bytes=` Range 切片解析支持，实现本地大视频、超清无损音频在内部 HTML5 播放器中**任意拖动进度条毫秒级极速响应**，不卡顿、不重载；
- **全路径 FileProvider 容灾**：加入 `<root-path>` 兼容所有品牌机型非标准挂载目录与 SD 扩展卡。

---

## 📦 官方安装包列表与直接下载 (严格纯净 3 款正式包)

| 平台 | 安装包名称 | 文件大小 | 说明 | 直链下载地址 |
| :--- | :--- | :--- | :--- | :--- |
| **📱 Android 手机端** | `Universal-Downloader-v1.2.3-Android.apk` | **6.45 MB** | 动态原生版本校验、全格式保护、HTTP 206 拖拽直通 | [📥 点击下载 Android APK](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.2.3/Universal-Downloader-v1.2.3-Android.apk) |
| **💻 Windows 安装版** | `Universal-Downloader-Setup-1.2.3.exe` | **74.99 MB** | 一键安装，全协议支持，自动关联磁力与种子协议 | [📥 点击下载 Setup.exe](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.2.3/Universal-Downloader-Setup-1.2.3.exe) |
| **🗜️ Windows 便携版** | `Universal-Downloader-v1.2.3-Windows-Portable.zip` | **109.26 MB** | 解压即用，纯净便携 | [📥 点击下载 Portable.zip](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.2.3/Universal-Downloader-v1.2.3-Windows-Portable.zip) |

---

## 💬 商务合作与技术支持

- 🟢 **WhatsApp**：`+1 (249) 897-8869`
- 🔵 **Telegram**：`@woeken318`
- 🔴 **Gmail 邮箱**：`songfx.shop318318@gmail.com`
