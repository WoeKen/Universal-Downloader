const http = require('http');
const https = require('https');
const tls = require('tls');
const { URL } = require('url');

/**
 * Universal Downloader - Telegram Hyper-Engine
 * Multi-scenario public & channel batch media extractor for Telegram
 */

function createProxyAgent(proxyUrl) {
  if (!proxyUrl || proxyUrl === 'system') return undefined;
  try {
    const p = new URL(proxyUrl);
    const proxyHost = p.hostname;
    const proxyPort = Number(p.port);

    const agent = new https.Agent({ keepAlive: true });
    agent.createConnection = function (options, callback) {
      const connectReq = http.request({
        host: proxyHost,
        port: proxyPort,
        method: 'CONNECT',
        path: `${options.host}:${options.port || 443}`,
        headers: {
          Host: `${options.host}:${options.port || 443}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      connectReq.on('connect', (res, socket) => {
        if (res.statusCode === 200) {
          const tlsSocket = tls.connect({
            host: options.host,
            servername: options.servername || options.host,
            socket: socket
          }, () => {
            callback(null, tlsSocket);
          });
          tlsSocket.on('error', err => callback(err));
        } else {
          callback(new Error(`Proxy CONNECT error: HTTP ${res.statusCode}`));
        }
      });

      connectReq.on('error', err => callback(err));
      connectReq.end();
    };
    return agent;
  } catch (e) {
    return undefined;
  }
}

function parseTelegramUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    if (!['t.me', 'telegram.me', 'telegram.dog', 'web.telegram.org'].includes(host)) {
      return null;
    }
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;

    if (host === 'web.telegram.org') {
      return {
        channel: 'web',
        messageId: parts[parts.length - 1] || 'progressive',
        isPrivate: false,
        isProgressiveStream: true,
        isChannelRoot: false
      };
    }

    // e.g. /s/channel_name/123 or /channel_name/123
    let channel = '';
    let messageId = '';
    let isPrivate = false;

    if (parts[0] === 's' && parts.length >= 2) {
      channel = parts[1];
      messageId = parts[2] || '';
    } else if (parts[0] === 'c' && parts.length >= 3) {
      isPrivate = true;
      channel = parts[1];
      messageId = parts[2];
    } else {
      channel = parts[0];
      messageId = parts[1] || '';
    }

    return {
      channel,
      messageId,
      isPrivate,
      isChannelRoot: !messageId
    };
  } catch (e) {
    return null;
  }
}

function fetchText(targetUrl, proxyUrl = '') {
  return new Promise((resolve, reject) => {
    const agent = createProxyAgent(proxyUrl);
    const u = new URL(targetUrl);
    const client = u.protocol === 'https:' ? https : http;
    const req = client.get(targetUrl, {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redir = new URL(res.headers.location, targetUrl).href;
        return fetchText(redir, proxyUrl).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Telegram HTTP 响应错误 (${res.statusCode})`));
      }
      let html = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { html += chunk; });
      res.on('end', () => resolve(html));
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('连接 Telegram 超时，请检查代理设置'));
    });
  });
}

function parseSize(sizeStr) {
  if (!sizeStr) return 0;
  const match = sizeStr.trim().match(/^([\d.]+)\s*([KMGT]?B)$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const scale = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  }[unit] || 1;
  return Math.round(num * scale);
}

/**
 * Parse a single Telegram public post
 */
async function sniffTelegramPost(rawUrl, proxyUrl = '') {
  const info = parseTelegramUrl(rawUrl);
  if (!info) throw new Error('无效的 Telegram 链接');

  // Case 1: Telegram Web Progressive Stream Direct Link
  if (info.isProgressiveStream || rawUrl.includes('/progressive/')) {
    const docId = rawUrl.split('/').pop() || 'media';
    return {
      title: `Telegram 直链流媒体 (${docId})`,
      thumbnail: '',
      duration: 0,
      durationStr: '流媒体直链',
      uploader: 'Telegram Web (渐进式流媒体)',
      size: 0,
      availableResolutions: [1080],
      streamUrl: rawUrl,
      cleanUrl: rawUrl,
      platform: 'TELEGRAM',
      isDirectStream: true
    };
  }

  if (info.isPrivate) {
    throw new Error(`这是 Telegram 私密群组/受限频道 (Chat ID: ${info.channel})。受 Telegram 权限保护，无法公开解析，请使用公开频道链接 (如 t.me/频道名/序号)`);
  }

  const webUrl = `https://t.me/s/${info.channel}/${info.messageId}`;
  let html = '';
  try {
    html = await fetchText(webUrl, proxyUrl);
  } catch (e) {
    html = await fetchText(`https://t.me/${info.channel}/${info.messageId}`, proxyUrl);
  }

  // Extract OpenGraph tags
  const ogImageMatch = html.match(/<meta property="og:image"[^>]+content="([^">]+)"/i) ||
                       html.match(/<meta name="twitter:image"[^>]+content="([^">]+)"/i);
  const ogTitleMatch = html.match(/<meta property="og:title"[^>]+content="([^">]+)"/i);
  const ogDescMatch = html.match(/<meta property="og:description"[^>]+content="([^">]+)"/i);

  // Extract channel name
  const channelMatch = html.match(/<div class="tgme_page_title"[^>]*><span>([^<]+)<\/span>/i) ||
                       html.match(/<div class="tgme_widget_message_owner_name"[^>]*><span[^>]*>([^<]+)<\/span>/i) ||
                       html.match(/<div class="tgme_channel_info_header_title"[^>]*>([^<]+)<\/div>/i);
  const uploader = (channelMatch ? channelMatch[1].trim() : '') || (ogTitleMatch ? ogTitleMatch[1].trim() : info.channel);

  // Extract video tag
  const videoSrcMatch = html.match(/<video[^>]+src="([^">]+)"/i);
  const videoThumbMatch = html.match(/class="tgme_widget_message_video_thumb"[^>]+style="background-image:url\('([^']+)'\)"/i) ||
                          html.match(/class="tgme_widget_message_photo_wrap"[^>]+style="background-image:url\('([^']+)'\)"/i) ||
                          html.match(/class="tgme_page_photo_image"[^>]+src="([^">]+)"/i);
  const durationMatch = html.match(/<time class="message_video_duration">([^<]+)<\/time>/i);
  const textMatch = html.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const docTitleMatch = html.match(/<div class="tgme_widget_message_document_title[^"]*"[^>]*>([^<]+)<\/div>/i);
  const docSizeMatch = html.match(/<div class="tgme_widget_message_document_extra[^"]*"[^>]*>([^<]+)<\/div>/i);

  let rawText = '';
  if (textMatch) {
    rawText = textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
  } else if (ogDescMatch) {
    rawText = ogDescMatch[1].trim();
  }

  const title = docTitleMatch ? docTitleMatch[1].trim() : (rawText.slice(0, 60) || (ogTitleMatch ? `${ogTitleMatch[1]} #${info.messageId}` : `Telegram Media #${info.messageId}`));
  const thumbnail = (videoThumbMatch ? videoThumbMatch[1] : '') || (ogImageMatch ? ogImageMatch[1] : '');
  const durationStr = durationMatch ? durationMatch[1].trim() : '';
  const streamUrl = videoSrcMatch ? videoSrcMatch[1] : '';
  const size = docSizeMatch ? parseSize(docSizeMatch[1]) : 0;

  return {
    title,
    thumbnail,
    duration: 0,
    durationStr,
    uploader: `${uploader} (Telegram)`,
    size,
    availableResolutions: streamUrl ? [1080, 720] : [],
    streamUrl,
    cleanUrl: rawUrl,
    platform: 'TELEGRAM'
  };
}

/**
 * Batch sniff recent media from an entire Telegram channel
 */
async function sniffTelegramChannel(rawUrl, proxyUrl = '') {
  const info = parseTelegramUrl(rawUrl);
  if (!info) throw new Error('无效的 Telegram 频道链接');

  const webUrl = `https://t.me/s/${info.channel}`;
  const html = await fetchText(webUrl, proxyUrl);

  const channelMatch = html.match(/<div class="tgme_channel_info_header_title"[^>]*><span[^>]*>([^<]+)<\/span>/i) ||
                       html.match(/<div class="tgme_page_title"[^>]*><span>([^<]+)<\/span>/i);
  const mainTitle = channelMatch ? `${channelMatch[1].trim()} - Telegram 频道最新合集` : `@${info.channel} 频道媒体合集`;

  // Split into message widgets
  const messageBlocks = html.split('<div class="tgme_widget_message ');
  const entries = [];

  for (let i = 1; i < messageBlocks.length; i++) {
    const block = messageBlocks[i];
    const dataPostMatch = block.match(/data-post="([^"]+)"/i);
    if (!dataPostMatch) continue;

    const postId = dataPostMatch[1]; // e.g. "channel_name/123"
    const postUrl = `https://t.me/${postId}`;
    const msgNum = postId.split('/')[1] || `${i}`;

    const videoSrcMatch = block.match(/<video[^>]+src="([^">]+)"/i);
    const videoThumbMatch = block.match(/style="background-image:url\('([^']+)'\)"/i);
    const durationMatch = block.match(/<time class="message_video_duration">([^<]+)<\/time>/i);
    const docTitleMatch = block.match(/<div class="tgme_widget_message_document_title[^"]*"[^>]*>([^<]+)<\/div>/i);
    const docSizeMatch = block.match(/<div class="tgme_widget_message_document_extra[^"]*"[^>]*>([^<]+)<\/div>/i);
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    // Only include if it has video, document, or media
    if (!videoSrcMatch && !docTitleMatch && !videoThumbMatch) continue;

    let textSnippet = '';
    if (textMatch) {
      textSnippet = textMatch[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
    }

    const title = docTitleMatch ? docTitleMatch[1].trim() : (textSnippet.slice(0, 50) || `Telegram Post #${msgNum}`);
    const size = docSizeMatch ? parseSize(docSizeMatch[1]) : 0;
    const durStr = durationMatch ? durationMatch[1].trim() : '';
    const thumb = videoThumbMatch ? videoThumbMatch[1] : '';

    entries.push({
      index: entries.length + 1,
      id: postId,
      title,
      url: postUrl,
      duration: 0,
      durationStr: durStr,
      size,
      thumbnail: thumb
    });
  }

  if (entries.length === 0) {
    throw new Error('未在 Telegram 频道公开页捕获到近期音视频或文件');
  }

  return {
    title: mainTitle,
    entries
  };
}

module.exports = {
  parseTelegramUrl,
  sniffTelegramPost,
  sniffTelegramChannel
};
