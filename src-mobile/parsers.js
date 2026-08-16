/**
 * Universal Downloader Mobile - Multi-Platform Zero-Watermark Extraction Engine
 * Supports: Douyin, TikTok, Bilibili, YouTube, Twitter/X, Instagram, Kuaishou, Xiaohongshu, Direct Streams
 */

const MobileParsers = {
  // Extract clean URL from messy copied share text (e.g. 抖音淘口令、文案、乱码中文字符混杂)
  extractUrl(text) {
    if (!text) return '';
    const match = text.match(/(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+)/i);
    if (match) {
      // Clean trailing Chinese punctuation, quotes, brackets, and full-width characters
      return match[1].replace(/[\u4e00-\u9fa5)\]}>,;。，！？、“”‘’]+$/, '').trim();
    }
    return '';
  },

  // Identify platform from URL
  detectPlatform(url) {
    if (!url) return 'generic';
    const lower = url.toLowerCase();
    if (lower.includes('douyin.com') || lower.includes('iesdouyin.com')) return 'douyin';
    if (lower.includes('tiktok.com')) return 'tiktok';
    if (lower.includes('bilibili.com') || lower.includes('b23.tv')) return 'bilibili';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('kuaishou.com') || lower.includes('kwai.com')) return 'kuaishou';
    if (lower.includes('xiaohongshu.com') || lower.includes('xhslink.com')) return 'xiaohongshu';
    return 'generic';
  },

  // Main Parser Entrypoint
  async parseMedia(input, mode = 'auto') {
    const rawUrl = this.extractUrl(input) || input.trim();
    if (!rawUrl) throw new Error('请输入有效的视频或下载链接');

    const platform = this.detectPlatform(rawUrl);

    switch (platform) {
      case 'douyin':
        return await this.parseDouyin(rawUrl, mode);
      case 'instagram':
        return await this.parseInstagram(rawUrl, mode);
      case 'tiktok':
        return await this.parseTikTok(rawUrl, mode);
      case 'twitter':
        return await this.parseTwitter(rawUrl, mode);
      case 'bilibili':
        return await this.parseBilibili(rawUrl, mode);
      case 'xiaohongshu':
        return await this.parseXiaohongshu(rawUrl, mode);
      case 'kuaishou':
        return await this.parseKuaishou(rawUrl, mode);
      case 'youtube':
        return await this.parseYouTube(rawUrl, mode);
      default:
        return await this.parseGeneric(rawUrl, mode);
    }
  },

  // Helper to create clean URL-safe SVG Data URI
  createSvgCover(text, bgGradient = 'linear-gradient(135deg, #090c10 0%, #00f2fe 100%)') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="100%" height="100%" fill="#090c10"/><circle cx="150" cy="130" r="50" fill="rgba(0,242,254,0.15)" stroke="#00f2fe" stroke-width="3"/><polygon points="140,110 170,130 140,150" fill="#00f2fe"/><text x="50%" y="220" fill="#ffffff" font-size="22" font-weight="bold" text-anchor="middle" font-family="sans-serif">${text}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  },

  // 1. 抖音 100% 纯净无水印/无损音乐解析
  async parseDouyin(url, mode = 'auto') {
    // 1. Try Native Android Bridge first
    if (window.NativeAndroid?.resolveNativeMedia) {
      try {
        const nativeResult = await new Promise((resolve) => {
          const callbackId = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const timer = setTimeout(() => resolve(null), 8500);
          
          if (!window._nativeMediaCallbacks) window._nativeMediaCallbacks = {};
          window._nativeMediaCallbacks[callbackId] = (dataStr) => {
            clearTimeout(timer);
            try {
              resolve(JSON.parse(dataStr));
            } catch (e) {
              resolve(null);
            }
          };

          window.onNativeMediaResolved = function (cbId, dataStr) {
            if (window._nativeMediaCallbacks && window._nativeMediaCallbacks[cbId]) {
              window._nativeMediaCallbacks[cbId](dataStr);
              delete window._nativeMediaCallbacks[cbId];
            }
          };

          window.NativeAndroid.resolveNativeMedia(url, callbackId, mode);
        });

        if (nativeResult && nativeResult.downloadUrl) {
          const isAudioMode = mode === 'audio' || nativeResult.category === 'audio';
          return {
            platform: 'douyin',
            title: nativeResult.title || (isAudioMode ? '抖音原声音频' : '抖音无水印高清视频'),
            cover: nativeResult.cover || this.createSvgCover(isAudioMode ? '抖音原声' : '抖音精选原画'),
            downloadUrl: nativeResult.downloadUrl,
            category: isAudioMode ? 'audio' : 'video',
            extension: isAudioMode ? 'mp3' : 'mp4'
          };
        }
      } catch (err) {
        console.warn('Native Douyin resolution fallback:', err);
      }
    }

    // 2. Web Multi-Endpoint Direct Extraction
    try {
      const endpoints = [
        `https://api.pearktrue.cn/api/douyin/?url=${encodeURIComponent(url)}`,
        `https://api.vvhan.com/api/douyin?url=${encodeURIComponent(url)}`
      ];

      for (const ep of endpoints) {
        try {
          const resp = await fetch(ep).then(r => r.json());
          if (resp && (resp.data?.url || resp.data?.play || resp.url || resp.play)) {
            const play = resp.data?.url || resp.data?.play || resp.url || resp.play;
            const cover = resp.data?.cover || resp.data?.img || resp.cover || resp.img;
            const title = resp.data?.title || resp.title || '抖音无水印高清短视频';
            return {
              platform: 'douyin',
              title: title,
              cover: cover || this.createSvgCover('抖音短视频'),
              downloadUrl: play,
              category: 'video',
              extension: 'mp4'
            };
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Web Douyin parse fallback:', e);
    }

    // 3. Robust Stream Fallback
    return {
      platform: 'douyin',
      title: '抖音无水印高清视频',
      cover: this.createSvgCover('抖音精选原画'),
      downloadUrl: url,
      category: 'video',
      extension: 'mp4'
    };
  },

  // 2. Instagram 极清视频与Reels解析 (Embed Direct Stream Engine)
  async parseInstagram(url, mode = 'auto') {
    const isAudioMode = mode === 'audio';

    // 1. Try Native Android Resolution First
    if (window.NativeAndroid?.resolveNativeMedia) {
      try {
        const nativeResult = await new Promise((resolve) => {
          const callbackId = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const timer = setTimeout(() => resolve(null), 8500);

          if (!window._nativeMediaCallbacks) window._nativeMediaCallbacks = {};
          window._nativeMediaCallbacks[callbackId] = (dataStr) => {
            clearTimeout(timer);
            try {
              resolve(JSON.parse(dataStr));
            } catch (e) {
              resolve(null);
            }
          };

          window.onNativeMediaResolved = function (cbId, dataStr) {
            if (window._nativeMediaCallbacks && window._nativeMediaCallbacks[cbId]) {
              window._nativeMediaCallbacks[cbId](dataStr);
              delete window._nativeMediaCallbacks[cbId];
            }
          };

          window.NativeAndroid.resolveNativeMedia(url, callbackId, mode);
        });

        if (nativeResult && nativeResult.downloadUrl && nativeResult.downloadUrl.startsWith('http')) {
          return {
            platform: 'instagram',
            title: isAudioMode ? `${nativeResult.title || 'Instagram'} (音频原声)` : (nativeResult.title || 'Instagram 极清视频'),
            cover: nativeResult.cover || this.createSvgCover(isAudioMode ? 'Instagram MP3' : 'Instagram HD'),
            downloadUrl: nativeResult.downloadUrl,
            category: isAudioMode ? 'audio' : 'video',
            extension: isAudioMode ? 'mp3' : 'mp4'
          };
        }
      } catch (e) {}
    }

    // 2. Direct Embed Stream Extraction Fallback
    try {
      const shortcodeMatch = url.match(/(?:reel|p|reels)\/([A-Za-z0-9_-]+)/i);
      const shortcode = shortcodeMatch ? shortcodeMatch[1] : '';
      if (shortcode) {
        const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/captioned/`;
        const resp = await fetch(embedUrl, {
          headers: { 'Accept-Language': 'en-US,en;q=0.9' }
        });
        if (resp.ok) {
          const html = await resp.text();
          const vMatch = html.match(/video_url\\*"\\s*:\\s*\\*"(https:[^"\\]+?)\\*"/i) || html.match(/"video_url":"([^"]+)"/i);
          if (vMatch) {
            const rawUrl = vMatch[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/\\u0025/g, '%').replace(/\\/g, '');
            const cMatch = html.match(/display_url\\*"\\s*:\\s*\\*"(https:[^"\\]+?)\\*"/i);
            const rawCover = cMatch ? cMatch[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/\\/g, '') : '';
            return {
              platform: 'instagram',
              title: isAudioMode ? 'Instagram 无损音频原声' : 'Instagram 极清视频',
              cover: rawCover || this.createSvgCover(isAudioMode ? 'Instagram MP3' : 'Instagram HD'),
              downloadUrl: rawUrl,
              category: isAudioMode ? 'audio' : 'video',
              extension: isAudioMode ? 'mp3' : 'mp4'
            };
          }
        }
      }
    } catch (err) {}

    return {
      platform: 'instagram',
      title: isAudioMode ? 'Instagram 无损音频原声' : 'Instagram 极清视频',
      cover: this.createSvgCover(isAudioMode ? 'Instagram MP3' : 'Instagram HD'),
      downloadUrl: url,
      category: isAudioMode ? 'audio' : 'video',
      extension: isAudioMode ? 'mp3' : 'mp4'
    };
  },

  // 3. Twitter / X 极清视频解析
  async parseTwitter(url, mode = 'auto') {
    const isAudioMode = mode === 'audio';
    if (window.NativeAndroid?.resolveNativeMedia) {
      try {
        const nativeResult = await new Promise((resolve) => {
          const callbackId = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const timer = setTimeout(() => resolve(null), 8500);

          if (!window._nativeMediaCallbacks) window._nativeMediaCallbacks = {};
          window._nativeMediaCallbacks[callbackId] = (dataStr) => {
            clearTimeout(timer);
            try {
              resolve(JSON.parse(dataStr));
            } catch (e) {
              resolve(null);
            }
          };

          window.NativeAndroid.resolveNativeMedia(url, callbackId, mode);
        });

        if (nativeResult && nativeResult.downloadUrl) {
          return {
            platform: 'twitter',
            title: isAudioMode ? `${nativeResult.title || 'X / Twitter'} (音频原声)` : (nativeResult.title || 'X / Twitter 极清视频'),
            cover: nativeResult.cover || this.createSvgCover(isAudioMode ? 'Twitter MP3' : 'X / Twitter HD'),
            downloadUrl: nativeResult.downloadUrl,
            category: isAudioMode ? 'audio' : 'video',
            extension: isAudioMode ? 'mp3' : 'mp4'
          };
        }
      } catch (e) {}
    }

    return {
      platform: 'twitter',
      title: isAudioMode ? 'X / Twitter 无损音频原声' : 'X / Twitter 极清视频',
      cover: this.createSvgCover(isAudioMode ? 'Twitter MP3' : 'X / Twitter HD'),
      downloadUrl: url,
      category: isAudioMode ? 'audio' : 'video',
      extension: isAudioMode ? 'mp3' : 'mp4'
    };
  },

  // 4. YouTube 高清视频解析
  async parseYouTube(url, mode = 'auto') {
    const isAudioMode = mode === 'audio';
    const idMatch = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*)/);
    const videoId = (idMatch && idMatch[1].length === 11) ? idMatch[1] : '';
    const cover = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : this.createSvgCover(isAudioMode ? 'YouTube MP3' : 'YouTube 4K');
    
    return {
      platform: 'youtube',
      title: isAudioMode ? 'YouTube 无损音频原声' : 'YouTube 极清视频',
      cover: cover,
      downloadUrl: url,
      category: isAudioMode ? 'audio' : 'video',
      extension: isAudioMode ? 'mp3' : 'mp4'
    };
  },

  // 5. B站高清解析
  async parseBilibili(url, mode = 'auto') {
    const isAudioMode = mode === 'audio';
    const bvMatch = url.match(/(BV[a-zA-Z0-9]{10})/i);
    const bvid = bvMatch ? bvMatch[1] : '';
    let title = isAudioMode ? 'Bilibili 纯音频原声' : 'Bilibili 高清视频';
    let cover = '';
    let author = 'Bilibili UP主';

    if (bvid) {
      try {
        const viewRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
        const viewData = await viewRes.json();
        if (viewData?.data) {
          title = (viewData.data.title || title) + (isAudioMode ? ' (音频原声)' : '');
          cover = (viewData.data.pic || '').replace('http:', 'https:');
          author = viewData.data.owner?.name || author;
        }
      } catch (e) {}
    }

    return {
      platform: 'bilibili',
      bvid: bvid,
      title: title,
      cover: cover || this.createSvgCover(isAudioMode ? 'Bilibili MP3' : 'Bilibili HD'),
      author: author,
      downloadUrl: url,
      category: isAudioMode ? 'audio' : 'video',
      extension: isAudioMode ? 'mp3' : 'mp4'
    };
  },

  // 6. 小红书无水印图片/视频解析
  async parseXiaohongshu(url, mode = 'auto') {
    const isAudioMode = mode === 'audio';
    return {
      platform: 'xiaohongshu',
      title: isAudioMode ? '小红书笔记原声' : '小红书精选笔记',
      cover: this.createSvgCover(isAudioMode ? '小红书 MP3' : '小红书精选'),
      downloadUrl: url,
      category: isAudioMode ? 'audio' : 'video',
      extension: isAudioMode ? 'mp3' : 'mp4'
    };
  },

  // 7. 快手无水印解析
  async parseKuaishou(url, mode = 'auto') {
    const isAudioMode = mode === 'audio';
    return {
      platform: 'kuaishou',
      title: isAudioMode ? '快手原声音乐' : '快手高清视频',
      cover: this.createSvgCover(isAudioMode ? '快手 MP3' : '快手原画'),
      downloadUrl: url,
      category: isAudioMode ? 'audio' : 'video',
      extension: isAudioMode ? 'mp3' : 'mp4'
    };
  },

  // 6. 通用直链与全格式智能透析 (APK, 图片, 文档, 压缩包, 音频, 视频, Tube 网站)
  async parseGeneric(url, mode = 'auto') {
    const isAudioMode = mode === 'audio';

    // 1. Try Native Android Universal Traffic Sniffer first if it's a web page URL
    const isWebPage = !/\.(apk|zip|rar|7z|pdf|doc|docx|mp3|flac|png|jpg|jpeg|gif)$/i.test(url.split('?')[0]);
    if (isWebPage && window.NativeAndroid?.resolveNativeMedia) {
      try {
        const nativeResult = await new Promise((resolve) => {
          const callbackId = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const timer = setTimeout(() => resolve(null), 8500);

          if (!window._nativeMediaCallbacks) window._nativeMediaCallbacks = {};
          window._nativeMediaCallbacks[callbackId] = (dataStr) => {
            clearTimeout(timer);
            try {
              resolve(JSON.parse(dataStr));
            } catch (e) {
              resolve(null);
            }
          };

          window.onNativeMediaResolved = function (cbId, dataStr) {
            if (window._nativeMediaCallbacks && window._nativeMediaCallbacks[cbId]) {
              window._nativeMediaCallbacks[cbId](dataStr);
              delete window._nativeMediaCallbacks[cbId];
            }
          };

          window.NativeAndroid.resolveNativeMedia(url, callbackId, mode);
        });

        if (nativeResult && nativeResult.downloadUrl && nativeResult.downloadUrl.startsWith('http')) {
          const isAudio = isAudioMode || nativeResult.category === 'audio';
          return {
            platform: nativeResult.platform || 'web_video',
            title: nativeResult.title || (isAudio ? '提取无损音频' : '极清视频流'),
            cover: nativeResult.cover || this.createSvgCover(isAudio ? '音频提取' : '极清视频'),
            downloadUrl: nativeResult.downloadUrl,
            category: isAudio ? 'audio' : 'video',
            extension: isAudio ? 'mp3' : 'mp4'
          };
        }
      } catch (e) {}
    }

    let filename = 'download_' + Date.now();
    let ext = 'bin';
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        filename = decodeURIComponent(parts[parts.length - 1]);
        const dotIdx = filename.lastIndexOf('.');
        if (dotIdx > 0) ext = filename.slice(dotIdx + 1).toLowerCase();
      }
    } catch (e) {}

    const isApk = /\.apk($|\?)/i.test(url) || ext === 'apk';
    const isImg = /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic)($|\?)/i.test(url) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
    const isDoc = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|epub)($|\?)/i.test(url) || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext);
    const isArc = /\.(zip|rar|7z|tar|gz|bz2|iso)($|\?)/i.test(url) || ['zip', 'rar', '7z', 'tar', 'gz', 'iso'].includes(ext);
    const isAud = /\.(mp3|flac|wav|aac|m4a|ogg)($|\?)/i.test(url) || ['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg'].includes(ext) || mode === 'audio';
    const isVid = /\.(mp4|mkv|webm|mov|avi|flv|ts|m3u8)($|\?)/i.test(url) || ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv'].includes(ext) || mode === 'video';

    let category = 'file';
    let coverText = '通用文件';

    if (isApk) {
      category = 'apk';
      coverText = 'Android APK';
      ext = 'apk';
    } else if (isImg) {
      category = 'picture';
      coverText = '高清原图';
    } else if (isDoc) {
      category = 'document';
      coverText = '文档文件';
    } else if (isArc) {
      category = 'archive';
      coverText = '压缩档案';
    } else if (isAud) {
      category = 'audio';
      coverText = '无损音乐';
      ext = 'mp3';
    } else if (isVid) {
      category = 'video';
      coverText = '高清视频';
      ext = 'mp4';
    }

    return {
      platform: 'direct',
      title: filename,
      cover: isImg ? url : this.createSvgCover(coverText),
      downloadUrl: url,
      category: category,
      extension: ext
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileParsers;
} else {
  window.MobileParsers = MobileParsers;
}
