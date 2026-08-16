# 🚀 Universal Downloader v1.2.1 (全能下载器旗舰正式版)

> **Next-Gen Liquid Glass Multi-Protocol Media & Stream Workstation**
> 专为极致性能与极简美学打造的 Windows & Android 全协议下载与媒体工作站。

---

## 🌟 v1.2.1 关键修复与升级要点

### 1. 🎯 彻底修复底部底栏（设置/无线投递/联系作者）独立弹窗响应
- **修复 DOM 标签层级**：彻底重构 `index.html` 模态层架构，杜绝模态面板被误判为播放器子节点的问题；
- **全屏模态管理器**：新增 `openModal` / `closeModal` 统一生命周期管理，点击「设置」、「无线投递」、「联系作者」**100% 独立秒弹**，无需依赖下载或播放器状态；
- **双重顶级事件捕获**：集成 Capture Phase 全局穿透与防事件冒泡拦截，任何机型与触摸手势均可精准触发展开。

### 2. ⚡ 4 模态自由透析引擎 (4-Mode Dialysis Engine)
- **⚡ [智能自适应]**：智能识别链接格式，根据源流属性自动分流到无水印视频、无损音频或通用文件下载；
- **🎬 [视频 (MP4)]**：100% 强制提取 1080P/4K 最高分辨率原画视频源流，杜绝误存音频；
- **🎵 [音频 (MP3)]**：提取 320kbps 纯净音乐母带，自动匹配原声专辑封面并生成动态黑胶唱片界面；
- **📦 [应用/文件]**：支持 APK 安装包、PDF/Word 文档、ZIP/RAR 压缩包等全格式直链下载，智能解析 `Content-Disposition` 文件名与 MIME 类型。

### 3. 🎬 双轨混合流式播放器 & 硬件解码直通
- **突破 Chromium WebView 沙盒限制**：在 Android 原生层引入 `shouldInterceptRequest` 虚拟媒体流管道，解决 `file://` 本地跨域被拦截导致播放器黑屏报错的痛点；
- **系统硬件播放器直通**：播放器面板与任务卡片新增 **【🎬 系统播放器】** / **【🎵 系统音乐】** 一键直通按钮，调用系统底层硬件硬解，支持 HDR、杜比全景声、画中画（PiP）及后台熄屏播放；
- **智能容灾拉起**：内置 HTML5 播放器遇特殊编码异常时，自动无缝唤起系统播放器。

---

## 📦 官方安装包列表与直接下载 (严格纯净 3 款正式包)

| 平台 | 安装包名称 | 文件大小 | 说明 | 直链下载地址 |
| :--- | :--- | :--- | :--- | :--- |
| **📱 Android 手机端** | `Universal-Downloader-v1.2.1-Android.apk` | **6.45 MB** | 修复设置与全部底栏独立弹窗、4 模态透析、硬件播放直通 | [📥 点击下载 Android APK](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.2.1/Universal-Downloader-v1.2.1-Android.apk) |
| **💻 Windows 安装版** | `Universal-Downloader-Setup-1.2.1.exe` | **74.99 MB** | 一键安装，全协议支持，自动关联磁力与种子协议 | [📥 点击下载 Setup.exe](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.2.1/Universal-Downloader-Setup-1.2.1.exe) |
| **🗜️ Windows 便携版** | `Universal-Downloader-v1.2.1-Windows-Portable.zip` | **109.26 MB** | 解压即用，纯净便携 | [📥 点击下载 Portable.zip](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.2.1/Universal-Downloader-v1.2.1-Windows-Portable.zip) |

---

## 💬 商务合作与技术支持

- 🟢 **WhatsApp**：`+1 (249) 897-8869`
- 🔵 **Telegram**：`@woeken318`
- 🔴 **Gmail 邮箱**：`songfx.shop318318@gmail.com`
