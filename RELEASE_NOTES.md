# 🚀 Universal Downloader v1.3.1 (全能下载器旗舰正式版)

> **Next-Gen Liquid Glass Multi-Protocol Media & Stream Workstation**
> 专为极致性能与极简美学打造的 Windows & Android 全协议下载与媒体工作站。

---

## 🌟 v1.3.1 关键突破与统一正式证书加固 (Universal Master Grade)

### 1. 🔐 引入永久统一签名证书 (Permanent Release Keystore)
- **解决“未安装应用”根因**：
  - 过去 CI 自动构建使用随机临时 Debug 签名，导致手机覆盖安装不同构建时触发 Android 系统签名冲突（`INSTALL_FAILED_UPDATE_INCOMPATIBLE` / “未安装应用”）；
  - `v1.3.1` 引入了**永久统一签名密钥库 (`universal_release.keystore`)**，所有后续版本签名完全一致，**支持无缝 1 键一键在线 OTA 覆盖升级**！

> [!TIP]
> **升级提示**：如果您手机上目前安装的是带有旧版临时签名的早期测试版，请先在手机上**卸载旧版应用**，并下载安装 `v1.3.1` 官方正式版。从 `v1.3.1` 起，后续所有更新均可直接在应用内无缝一键覆盖安装！

### 2. 🛡️ 彻底修复 Twitter Embed 假数据流污染与 1.1 KB 错误
- 彻底拦截并剔除 `Tweet.html` 网页本身被误当成视频直链的逻辑缺陷；
- 严禁任何包含 `embed`、`.html` 或网页地址的数据流进入下载队列；
- 修正标题自动命名算法，彻底消除“Twitter Embed”这类无效默认命名；
- 下载器内置双重真实性校验，一旦发现下载内容为 HTML 文本或小于 50KB 的鉴权网页，立即自动销毁并报错，**绝不将假文件保存为 MP4，彻底告别 00:00 无法播放的损坏文件**。

### 3. 🎬 Instagram 官方 GraphQL 直连解算矩阵 (Doc ID 10015901848480474 Engine)
- 直接打通官方 GraphQL API 通道，**200ms 内极速返回 100% 原始高清 MP4 真实视频直链**、原生封面与帖子正文；
- 无需经过复杂网页渲染，无论是否登录均可直接秒级捕获。

---

## 📦 官方安装包列表与直接下载 (严格纯净 3 款正式包)

| 平台 | 安装包名称 | 文件大小 | 说明 | 直链下载地址 |
| :--- | :--- | :--- | :--- | :--- |
| **📱 Android 手机端** | `Universal-Downloader-v1.3.1-Android.apk` | **6.45 MB** | 永久统一签名证书 · 彻底根除假文件/1.1KB错误 · 原生OTA升级 | [📥 点击下载 Android APK](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.3.1/Universal-Downloader-v1.3.1-Android.apk) |
| **💻 Windows 安装版** | `Universal-Downloader-Setup-1.3.1.exe` | **74.99 MB** | 一键安装，全协议支持，自动关联磁力与种子协议 | [📥 点击下载 Setup.exe](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.3.1/Universal-Downloader-Setup-1.3.1.exe) |
| **🗜️ Windows 便携版** | `Universal-Downloader-v1.3.1-Windows-Portable.zip` | **109.26 MB** | 解压即用，纯净便携 | [📥 点击下载 Portable.zip](https://github.com/WoeKen/Universal-Downloader/releases/download/v1.3.1/Universal-Downloader-v1.3.1-Windows-Portable.zip) |

---

## 💬 商务合作与技术支持

- 🟢 **WhatsApp**：`+1 (249) 897-8869`
- 🔵 **Telegram**：`@woeken318`
- 🔴 **Gmail 邮箱**：`songfx.shop318318@gmail.com`
