# 🚀 Universal Downloader v1.3.3 (全能下载器旗舰正式版)

> **Next-Gen Liquid Glass Multi-Protocol Media & Stream Workstation**
> 专为极致性能与极简美学打造的 Windows & Android 全协议下载与媒体工作站。

---

## 🌟 v1.3.3 关键突破与 Scoped Storage 双重安全落盘架构 (Universal Master Grade)

### 1. 🛡️ 彻底攻克 Android 10-14 `EACCES (Permission denied)` 存储权限拦截
- **根因根治**：
  - 针对部分机型（Android 10/11/12/13/14）的分区存储（Scoped Storage）限制，实现了**动态存储目录降级与双重安全保障管道 (`getSafeDownloadDirectory`)**；
  - 即使公共 Downloads 目录被系统权限拦截，也会自动无缝切换至高权限私有存储目录并触发 `MediaScanner`，保证**100% 成功落盘并同步至系统相册**；
  - 启动时主动申请媒体读写权限，并在 Manifest 中开启 `requestLegacyExternalStorage`。

### 2. 🔤 超强安全文件名清理器 (Bulletproof Sanitizer)
- 全面清洗特殊字符、Markdown 符号、控制字符与换行符，严格限制文件名在安全长度内，彻底消除 `NAME_TOO_LONG` 与文件系统创建失败问题。

### 3. 🎬 内建原生本地流媒体中继通道 (Native Local-Media Stream Relay)
- 弹窗内置 HTML5 播放器与系统硬件播放器无缝直调，支持 4K/1080P 极清点播。

---

## 📦 官方安装包列表与直接下载 (严格纯净 3 款正式包)

| 平台 | 安装包名称 | 文件大小 | 说明 | 直链下载地址 |
| :--- | :--- | :--- | :--- | :--- |
| **📱 Android 手机端** | `Universal-Downloader-v1.3.3-Android.apk` | **4.59 MB** | 彻底攻克EACCES权限拦截 · 永久统一签名证书 · 原生OTA覆盖升级 | [📥 点击下载 Android APK](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.3.3/Universal-Downloader-v1.3.3-Android.apk) |
| **💻 Windows 安装版** | `Universal-Downloader-Setup-1.3.3.exe` | **74.99 MB** | 一键安装，全协议支持，自动关联磁力与种子协议 | [📥 点击下载 Setup.exe](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.3.3/Universal-Downloader-Setup-1.3.3.exe) |
| **🗜️ Windows 便携版** | `Universal-Downloader-v1.3.3-Windows-Portable.zip` | **109.26 MB** | 解压即用，纯净便携 | [📥 点击下载 Portable.zip](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.3.3/Universal-Downloader-v1.3.3-Windows-Portable.zip) |

---

## 💬 商务合作与技术支持

- 🟢 **WhatsApp**：`+1 (249) 897-8869`
- 🔵 **Telegram**：`@woeken318`
- 🔴 **Gmail 邮箱**：`songfx.shop318318@gmail.com`
