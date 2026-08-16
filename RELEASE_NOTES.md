# 🚀 Universal Downloader v1.2.6 (全能下载器旗舰正式版)

> **Next-Gen Liquid Glass Multi-Protocol Media & Stream Workstation**
> 专为极致性能与极简美学打造的 Windows & Android 全协议下载与媒体工作站。

---

## 🌟 v1.2.6 关键突破与全面加固

### 1. 🎬 Instagram / Reels 全新直连透析引擎 (Embed Direct Stream Engine)
- **彻底突破 Instagram 鉴权拦截与风控**：重构了 Instagram 媒体解析通道，利用免登录的 Embed 原始流透析架构，直接提取 Instagram CDN 上的真实 100% 原始画质 MP4 视频流（支持短视频 Reels、主贴视频与快拍）；
- **双端双保险回退**：Android 原生多线程请求与 Web 纯前端 Fetch 双引擎无缝回退，保障在各种网络环境下 100% 秒解出真实直链并下载。

### 2. 🚀 原生 OTA 升级通道打通 (Zero-Click In-App Install)
- **原生多线程下载与安装器直拉**：在 Android 原生层实现了 `downloadAndInstallApk(apkUrl)` 原生引擎，点击「立即极速下载并安装新版本」即可在后台高速拉取新版 APK，并在下载完毕后**自动拉起系统安装器（Package Installer）**，支持极速覆盖升级；
- **自适应网络降级保障**：在遇到非标准系统限制时，自动降级唤起系统默认浏览器进行直链极速下载，绝不发生点击无响应。

### 3. 💎 升级弹窗与全站 UI 奢华级视觉重构 (Ultra Liquid Glass Aesthetics)
- **全新升级面板排版**：采用双版本对比徽章卡片、霓虹荧光微光动效、沉浸式版本升级日志滚动视窗；
- **全站按钮与模态框加固**：重构所有操作按钮（主要升级按钮、辅助取消按钮、设置动作按钮），配备流畅的高斯模糊底色、3D 渐变按压反馈（Micro-interactions）与触觉马达振动，彻底告别粗糙界面。

### 4. 🎯 彻底修复下载完成文件大小显示「0 B / 计算中...」
- **原生文件尺寸精准回传**：在 Android 原生下载线程完成时，通过 `targetFile.length()` 获取真实的磁盘物理字节数并即时回传给前端，确保任务卡片 100% 准确展示最终文件大小（如 `15.8 MB`、`1.2 GB`）；
- **动态文件尺寸恢复引擎**：新增 `@JavascriptInterface public long getFileSize(String filePath)` 原生接口，即使面对历史任务或极速秒下任务，前端也会自动探针物理文件并实时恢复精确大小，告别「0 B / 计算中...」。

---

## 📦 官方安装包列表与直接下载 (严格纯净 3 款正式包)

| 平台 | 安装包名称 | 文件大小 | 说明 | 直链下载地址 |
| :--- | :--- | :--- | :--- | :--- |
| **📱 Android 手机端** | `Universal-Downloader-v1.2.6-Android.apk` | **6.45 MB** | Instagram Reels 突破透析、原生 OTA 升级、全站奢华 UI | [📥 点击下载 Android APK](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.2.6/Universal-Downloader-v1.2.6-Android.apk) |
| **💻 Windows 安装版** | `Universal-Downloader-Setup-1.2.6.exe` | **74.99 MB** | 一键安装，全协议支持，自动关联磁力与种子协议 | [📥 点击下载 Setup.exe](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.2.6/Universal-Downloader-Setup-1.2.6.exe) |
| **🗜️ Windows 便携版** | `Universal-Downloader-v1.2.6-Windows-Portable.zip` | **109.26 MB** | 解压即用，纯净便携 | [📥 点击下载 Portable.zip](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.2.6/Universal-Downloader-v1.2.6-Windows-Portable.zip) |

---

## 💬 商务合作与技术支持

- 🟢 **WhatsApp**：`+1 (249) 897-8869`
- 🔵 **Telegram**：`@woeken318`
- 🔴 **Gmail 邮箱**：`songfx.shop318318@gmail.com`
