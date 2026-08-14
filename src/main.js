const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, Notification, clipboard, screen, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');
const { spawn } = require('child_process');
const telegramEngine = require('./telegram-engine');

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { stream: true, bypassCSP: true, supportFetchAPI: true } }
]);

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
    const protoArg = commandLine.find(arg => arg && (arg.startsWith('all-download:') || arg.startsWith('universal-downloader:')));
    if (protoArg) {
      handleProtocolUrl(protoArg);
    }
  });
}

let win;
let floatingWin = null;
let tray = null;
let lastClipboardText = '';
const tasks = new Map();
let activeCount = 0;
let settings;
let runtimeToolsDir = '';
const domainCooldowns = new Map(); // site -> cooldown timestamp

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const tasksFile = () => path.join(app.getPath('userData'), 'tasks.json');
const clipboardHistoryFile = () => path.join(app.getPath('userData'), 'clipboard_history.json');
const trackersCacheFile = () => path.join(app.getPath('userData'), 'trackers.json');
const bundledTools = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'tools') : path.join(app.getAppPath(), 'tools');

// ==========================================================================
// 📋 Clipboard History & Memory Vault
// ==========================================================================
let clipboardHistory = [];

function loadClipboardHistory() {
  try {
    clipboardHistory = readJson(clipboardHistoryFile(), []);
    if (!Array.isArray(clipboardHistory)) clipboardHistory = [];
  } catch {
    clipboardHistory = [];
  }
}

function saveClipboardHistory() {
  try {
    writeJson(clipboardHistoryFile(), clipboardHistory.slice(0, 50));
  } catch {}
}

function recordClipboardHistory(url, title = '') {
  if (!url || typeof url !== 'string') return;
  const clean = url.trim();
  if (!clean || clean.length < 5) return;
  const site = siteForUrl(clean);
  const now = Date.now();
  const existingIdx = clipboardHistory.findIndex(h => h.url === clean);
  if (existingIdx >= 0) {
    clipboardHistory[existingIdx].time = now;
    clipboardHistory[existingIdx].count = (clipboardHistory[existingIdx].count || 1) + 1;
    if (title && !clipboardHistory[existingIdx].title) clipboardHistory[existingIdx].title = title;
    const item = clipboardHistory.splice(existingIdx, 1)[0];
    clipboardHistory.unshift(item);
  } else {
    clipboardHistory.unshift({
      id: 'clip_' + now + '_' + Math.random().toString(36).slice(2, 6),
      url: clean,
      title: title || '',
      site,
      time: now,
      count: 1
    });
    if (clipboardHistory.length > 50) clipboardHistory = clipboardHistory.slice(0, 50);
  }
  saveClipboardHistory();
  if (win && !win.isDestroyed()) {
    win.webContents.send('clipboard:history-updated', clipboardHistory);
  }
}

// ==========================================================================
// 🧲 Global Tier-1 Active BitTorrent Trackers Injector
// ==========================================================================
const defaultTrackers = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://9.rarbg.to:2920/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.altrosky.nl:2710/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.filemail.com:6969/announce',
  'udp://p4p.arenabg.com:1337/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://tracker.lelux.fi:6969/announce',
  'udp://tracker.dump.cl:6969/announce',
  'udp://movies.zsw.ca:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://opentracker.i2p.rocks:6969/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.theoks.net:6969/announce',
  'udp://tracker-udp.gbitt.info:80/announce'
];

let globalTrackers = [...defaultTrackers];

function loadTrackersCache() {
  try {
    const list = readJson(trackersCacheFile(), null);
    if (Array.isArray(list) && list.length > 0) {
      globalTrackers = Array.from(new Set([...defaultTrackers, ...list]));
    }
  } catch {}
}

async function fetchOnlineTrackers() {
  const sources = [
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
    'https://trackerslist.com/best.txt'
  ];
  for (const src of sources) {
    try {
      const text = await new Promise((resolve, reject) => {
        const req = (src.startsWith('https:') ? https : http).get(src, { timeout: 6000 }, (res) => {
          if (res.statusCode !== 200) return reject(new Error('Status ' + res.statusCode));
          let data = '';
          res.on('data', c => { data += c; });
          res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      });
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && (l.startsWith('udp://') || l.startsWith('http://') || l.startsWith('https://') || l.startsWith('wss://')));
      if (lines.length > 0) {
        globalTrackers = Array.from(new Set([...defaultTrackers, ...lines]));
        writeJson(trackersCacheFile(), globalTrackers);
        return { success: true, count: globalTrackers.length, updated: true };
      }
    } catch {}
  }
  return { success: true, count: globalTrackers.length, updated: false, fallback: true };
}

const findTool = (name, fallback) => {
  const candidates = [
    path.join(bundledTools, name),
    path.join(app.getAppPath(), 'tools', name),
    path.join(process.cwd(), 'tools', name),
    path.join(__dirname, '..', 'tools', name),
    fallback
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return fallback;
};

function resolveTool(value, name) { 
  if (value && (path.isAbsolute(value) ? fs.existsSync(value) : value === name)) return value; 
  return findTool(name, value || ''); 
}

const defaults = { 
  downloadDir: path.join(app.getPath('downloads'), 'UniversalDownloader'), 
  maxConcurrent: 3, 
  segments: 8, 
  speedLimit: 0, 
  retryCount: 3, 
  autoShutdown: false,
  minimizeToTray: true,
  clipboardMonitor: true,
  nativeNotifications: true,
  antiBanJitter: true,
  downloadDanmaku: false,
  enableAutoCategory: true,
  categoryFolders: {
    video: 'Videos',
    audio: 'Music',
    archive: 'Archives',
    document: 'Documents',
    picture: 'Pictures',
    other: 'Others'
  },
  timeSchedule: {
    enabled: false,
    peakStart: '08:00',
    peakEnd: '23:00',
    peakLimitKBps: 2048,
    offPeakLimitKBps: 0
  },
  namingPattern: '{title}',
  folderPattern: '{category}',
  proxyMode: 'direct',
  proxyProtocol: 'http',
  proxyHost: '127.0.0.1',
  proxyPort: '7890',
  proxyRouting: 'smart',
  proxy: '',
  floatingWidget: false,
  ytDlpPath: findTool('yt-dlp.exe', 'yt-dlp.exe'), 
  ffmpegPath: findTool('ffmpeg.exe', 'ffmpeg.exe'), 
  aria2Path: findTool('aria2c.exe', 'aria2c.exe'),
  cookieProfiles: {} 
};

function getEffectiveProxy(targetUrl = '') {
  if (!settings || settings.proxyMode === 'direct') return '';
  if (settings.proxyMode === 'system') return 'system';
  let proxyUrl = '';
  if (settings.proxyMode === 'clash') proxyUrl = 'http://127.0.0.1:7890';
  else if (settings.proxyMode === 'v2ray') proxyUrl = 'http://127.0.0.1:10808';
  else if (settings.proxyMode === 'ss') proxyUrl = 'socks5://127.0.0.1:1080';
  else {
    const proto = settings.proxyProtocol || 'http';
    const host = settings.proxyHost || '127.0.0.1';
    const port = settings.proxyPort || '7890';
    proxyUrl = `${proto}://${host}:${port}`;
  }

  if (targetUrl && settings.proxyRouting === 'smart') {
    const site = siteForUrl(targetUrl);
    if (site === 'bilibili' || site === 'douyin') return '';
  }
  return proxyUrl;
}

function prepareRuntimeTools() { 
  const dir = path.join(app.getPath('userData'), 'tools'); 
  fs.mkdirSync(dir, { recursive: true }); 
  for (const name of ['yt-dlp.exe', 'ffmpeg.exe', 'aria2c.exe', 'node.exe']) { 
    const source = findTool(name, ''); 
    const target = path.join(dir, name); 
    if (source && fs.existsSync(source) && (!fs.existsSync(target) || fs.statSync(target).size !== fs.statSync(source).size)) { 
      try { fs.copyFileSync(source, target); } catch (e) {} 
    } 
  } 
  return dir; 
}

function getJsRuntimeArg() {
  const nodeExe = preferredTool('node.exe', 'node.exe');
  if (nodeExe && fs.existsSync(nodeExe)) return `node:${nodeExe}`;
  return '';
}

function preferredTool(name, fallback = '') { 
  const runtime = runtimeToolsDir ? path.join(runtimeToolsDir, name) : ''; 
  if (runtime && fs.existsSync(runtime)) return runtime; 
  const bundled = path.join(bundledTools, name); 
  if (fs.existsSync(bundled)) return bundled; 
  return resolveTool(fallback, name); 
}

function readJson(file, fallback) { 
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } 
}

function writeJson(file, value) { 
  fs.mkdirSync(path.dirname(file), { recursive: true }); 
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8'); 
}

function cleanTask(t) { 
  const { proc, requests, segments, lastEmit, lastPersist, fd, ...safe } = t; 
  return safe; 
}

function persist() { 
  writeJson(tasksFile(), [...tasks.values()].map(cleanTask)); 
}

function send(event, data) { 
  if (win && !win.isDestroyed()) win.webContents.send(event, data); 
  if (floatingWin && !floatingWin.isDestroyed()) floatingWin.webContents.send(event, data); 
}

function emit(t, force = false) { 
  const now = Date.now(); 
  t.updatedAt = now; 
  if (force || !t.lastEmit || now - t.lastEmit > 250) { 
    t.lastEmit = now; 
    send('task:update', cleanTask(t)); 
  } 
  if (force || !t.lastPersist || now - t.lastPersist > 1000) { 
    t.lastPersist = now; 
    persist(); 
  } 
}

function safeName(value) { 
  return String(value || 'download').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 180); 
}

function category(url, name) { 
  const ext = path.extname(name || '') || (() => { try { return path.extname(new URL(url).pathname); } catch { return ''; } })(); 
  const map = { 
    video: ['.mp4','.mkv','.webm','.mov','.m3u8','.flv','.avi'], 
    audio: ['.mp3','.wav','.m4a','.flac','.aac','.ogg'], 
    image: ['.jpg','.jpeg','.png','.gif','.webp','.svg'], 
    archive: ['.zip','.rar','.7z','.tar','.gz','.iso'] 
  }; 
  return Object.keys(map).find(k => map[k].includes(ext.toLowerCase())) || 'document'; 
}

function resolveCategoryFolder(fileName, mode = 'video') {
  if (!settings || !settings.enableAutoCategory) return '';
  const ext = path.extname(fileName || '').toLowerCase();
  const folders = settings.categoryFolders || defaults.categoryFolders;
  if (mode === 'audio' || ['.mp3', '.flac', '.wav', '.aac', '.m4a', '.ogg', '.opus'].includes(ext)) {
    return folders.audio || 'Music';
  }
  if (mode === 'video' || ['.mp4', '.mkv', '.flv', '.avi', '.mov', '.webm', '.ts', '.m4v'].includes(ext)) {
    return folders.video || 'Videos';
  }
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.iso', '.exe', '.msi', '.apk'].includes(ext)) {
    return folders.archive || 'Archives';
  }
  if (['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.epub', '.md'].includes(ext)) {
    return folders.document || 'Documents';
  }
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.ico'].includes(ext)) {
    return folders.picture || 'Pictures';
  }
  return folders.other || 'Others';
}

function parseBencode(buffer) {
  let pos = 0;
  function decode() {
    if (pos >= buffer.length) return null;
    const byte = buffer[pos];
    if (byte === 0x69) { // 'i' -> integer
      pos++;
      const end = buffer.indexOf(0x65, pos); // 'e'
      if (end === -1) throw new Error('Invalid bencode integer');
      const numStr = buffer.toString('utf8', pos, end);
      pos = end + 1;
      return parseInt(numStr, 10);
    }
    if (byte === 0x6c) { // 'l' -> list
      pos++;
      const list = [];
      while (pos < buffer.length && buffer[pos] !== 0x65) {
        list.push(decode());
      }
      pos++; // skip 'e'
      return list;
    }
    if (byte === 0x64) { // 'd' -> dictionary
      pos++;
      const dict = {};
      while (pos < buffer.length && buffer[pos] !== 0x65) {
        const key = decode();
        const keyStr = Buffer.isBuffer(key) ? key.toString('utf8') : String(key);
        const val = decode();
        dict[keyStr] = val;
      }
      pos++; // skip 'e'
      return dict;
    }
    const colon = buffer.indexOf(0x3a, pos); // ':'
    if (colon !== -1 && colon < pos + 10) {
      const lenStr = buffer.toString('utf8', pos, colon);
      const len = parseInt(lenStr, 10);
      if (!isNaN(len)) {
        pos = colon + 1;
        const res = buffer.slice(pos, pos + len);
        pos += len;
        try {
          const str = res.toString('utf8');
          if (!str.includes('\0')) return str;
        } catch {}
        return res;
      }
    }
    throw new Error(`Unexpected bencode token at byte ${pos}`);
  }
  return decode();
}

function parseTorrentOrMagnet(input) {
  if (typeof input === 'string' && input.trim().startsWith('magnet:')) {
    const raw = input.trim();
    let hash = '';
    const matchXt = raw.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    if (matchXt) hash = matchXt[1].toUpperCase();

    let dn = '';
    const matchDn = raw.match(/dn=([^&]+)/i);
    if (matchDn) {
      try { dn = decodeURIComponent(matchDn[1]).replace(/\+/g, ' '); } catch { dn = matchDn[1]; }
    }
    if (!dn) dn = `BT-${hash ? hash.slice(0, 16) : 'Magnet_Task'}`;

    const trackers = [];
    const trMatches = [...raw.matchAll(/tr=([^&]+)/gi)];
    trMatches.forEach(m => {
      try { trackers.push(decodeURIComponent(m[1])); } catch { trackers.push(m[1]); }
    });

    // Auto-inject high-speed global Trackers into magnet
    const combinedTrackers = Array.from(new Set([...trackers, ...globalTrackers]));
    let enhancedMagnet = `magnet:?xt=urn:btih:${hash || 'UNKNOWN'}&dn=${encodeURIComponent(dn)}`;
    combinedTrackers.slice(0, 35).forEach(tr => {
      enhancedMagnet += `&tr=${encodeURIComponent(tr)}`;
    });

    return {
      type: 'magnet',
      name: dn,
      hash: hash || 'N/A',
      trackers: combinedTrackers,
      trackersInjected: combinedTrackers.length,
      totalSize: 0,
      files: [
        {
          index: 0,
          name: `[磁力合集] ${dn} (DHT/Trackers 全网穿透寻种并发下载)`,
          path: dn,
          size: 0,
          selected: true
        }
      ],
      url: enhancedMagnet
    };
  }

  let buffer = input;
  if (typeof input === 'string') {
    if (fs.existsSync(input)) buffer = fs.readFileSync(input);
    else throw new Error('种子文件路径不存在');
  }
  const torrent = parseBencode(buffer);
  if (!torrent || !torrent.info) throw new Error('无效的 .torrent 种子文件结构');

  const info = torrent.info;
  const rootName = typeof info.name === 'string' ? info.name : (Buffer.isBuffer(info.name) ? info.name.toString('utf8') : 'Torrent Download');
  const pieceLength = info['piece length'] || 0;
  const pieces = Buffer.isBuffer(info.pieces) ? info.pieces.length / 20 : 0;

  const files = [];
  let totalSize = 0;

  if (Array.isArray(info.files)) {
    info.files.forEach((f, idx) => {
      const fSize = f.length || 0;
      totalSize += fSize;
      const fPathParts = Array.isArray(f.path) ? f.path.map(p => Buffer.isBuffer(p) ? p.toString('utf8') : String(p)) : [String(f.path || `file_${idx}`)];
      const relativePath = path.join(...fPathParts);
      const fileName = fPathParts[fPathParts.length - 1];
      files.push({
        index: idx,
        name: fileName,
        path: relativePath,
        size: fSize,
        selected: true
      });
    });
  } else {
    const fSize = info.length || 0;
    totalSize = fSize;
    files.push({
      index: 0,
      name: rootName,
      path: rootName,
      size: fSize,
      selected: true
    });
  }

  return {
    type: 'torrent',
    name: rootName,
    comment: typeof torrent.comment === 'string' ? torrent.comment : '',
    createdDate: torrent['creation date'] ? new Date(torrent['creation date'] * 1000).toLocaleString() : '',
    pieceLength,
    piecesCount: pieces,
    totalSize,
    files
  };
}

function siteForUrl(value) { 
  try { 
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, ''); 
    if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube'; 
    if (host.includes('bilibili.com')) return 'bilibili'; 
    if (host.includes('douyin.com') || host.includes('tiktok.com')) return 'douyin'; 
    if (host === 'x.com' || host.includes('twitter.com')) return 'x'; 
    if (host === 't.me' || host.includes('telegram.org') || host.includes('telegram.me') || host.includes('telegram.dog')) return 'telegram'; 
    if (host.includes('instagram.com') || host.includes('instagr.am')) return 'instagram'; 
    if (host.includes('pornhub.com')) return 'pornhub'; 
    return 'general'; 
  } catch { return 'general'; } 
}

function cookieForUrl(value) { 
  const profiles = settings?.cookieProfiles || {}; 
  const site = siteForUrl(value); 
  return profiles[site]?.path || profiles.general?.path || ''; 
}

function getCookieHeaderForUrl(url) {
  const cookiePath = cookieForUrl(url);
  if (!cookiePath || !fs.existsSync(cookiePath)) return '';
  try {
    const content = fs.readFileSync(cookiePath, 'utf8');
    const pairs = [];
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const parts = line.split('\t');
      if (parts.length >= 7) {
        pairs.push(`${parts[5]}=${parts[6]}`);
      }
    }
    return pairs.join('; ');
  } catch (e) {
    return '';
  }
}

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

function scheduleShutdown() { 
  if (process.platform === 'win32') spawn('shutdown', ['/s', '/t', '30', '/c', 'All downloads completed'], { windowsHide: true }); 
}

function showNotification(title, body, savePath = '') {
  if (!settings?.nativeNotifications || !Notification.isSupported()) return;
  try {
    const notification = new Notification({
      title,
      body,
      icon: appIconPath()
    });
    if (savePath) {
      notification.on('click', () => {
        if (win && !win.isDestroyed()) { win.show(); win.focus(); }
        shell.showItemInFolder(savePath);
      });
    }
    notification.show();
  } catch (e) {}
}

function appIconPath() { 
  return path.join(app.getAppPath(), 'assets', 'app.ico'); 
}

function createTray() {
  const icon = appIconPath();
  if (!fs.existsSync(icon)) return;
  tray = new Tray(icon);
  tray.setToolTip('Universal Downloader (全能下载器)');

  const contextMenu = Menu.buildFromTemplate([
    { label: '打开主界面', click: () => { if (win) { win.show(); win.focus(); } } },
    { type: 'separator' },
    { label: '全部暂停', click: () => { for (const t of tasks.values()) pauseTask(t); pump(); } },
    { label: '全部继续', click: () => { 
      for (const t of tasks.values()) {
        if (t.status === 'paused') { t.status = 'queued'; t.paused = false; emit(t, true); }
      }
      pump(); 
    }},
    { type: 'separator' },
    { label: '退出程序', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (win) { win.show(); win.focus(); }
  });
}

function extractUrlsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const urlRegex = /https?:\/\/[^\s\u4e00-\u9fa5<>"'{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map(u => u.replace(/[),;，。！？】）\s]+$/, '')).filter(u => {
    try { new URL(u); return true; } catch { return false; }
  });
}

async function expandShortUrl(rawUrl, maxRedirects = 5) {
  let current = rawUrl;
  for (let i = 0; i < maxRedirects; i++) {
    try {
      const u = new URL(current);
      const isShort = /b23\.tv|v\.douyin\.com|t\.co|bit\.ly|youtu\.be|t\.cn|dwz\.cn|cutt\.ly|tinyurl\.com/i.test(u.hostname);
      if (!isShort && i > 0) break;

      const res = await new Promise((resolve) => {
        const req = (u.protocol === 'https:' ? https : http).request(current, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          }
        }, resolve);
        req.on('error', () => resolve(null));
        req.setTimeout(4000, () => { req.destroy(); resolve(null); });
        req.end();
      });

      if (!res) break;
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, current).toString();
        current = next;
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }
  return current;
}

function fetchRemoteBuffer(url, referer = '') {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const effectiveProxy = getEffectiveProxy(url);
      const agent = createProxyAgent(effectiveProxy);
      const client = u.protocol === 'https:' ? https : http;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': referer || url
      };
      const req = client.get(url, { agent, headers, timeout: 5000 }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchRemoteBuffer(res.headers.location, referer).then(resolve).catch(() => resolve(null));
        }
        if (res.statusCode !== 200) return resolve(null);
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch (err) {
      resolve(null);
    }
  });
}

function initClipboardMonitor() {
  setInterval(async () => {
    if (!settings?.clipboardMonitor) return;
    try {
      const rawText = clipboard.readText()?.trim();
      if (rawText && rawText !== lastClipboardText && rawText.length <= 3000) {
        const extracted = extractUrlsFromText(rawText);
        if (extracted.length > 0) {
          lastClipboardText = rawText;
          const cleanUrl = await expandShortUrl(extracted[0]);
          recordClipboardHistory(cleanUrl);
          send('clipboard:detected', { url: cleanUrl, count: extracted.length, rawText });
        }
      }
    } catch (e) {}
  }, 1500);
}

function createFloatingWidget() {
  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.show();
    return;
  }
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  floatingWin = new BrowserWindow({
    width: 172,
    height: 54,
    x: width - 200,
    y: Math.floor(height / 2) - 27,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  floatingWin.loadFile(path.join(__dirname, 'floating.html'));
}

function destroyFloatingWidget() {
  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.close();
    floatingWin = null;
  }
}

ipcMain.handle('window:show', () => {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
  }
});

ipcMain.on('floating:move', (_, { dx, dy }) => {
  if (floatingWin && !floatingWin.isDestroyed()) {
    const [winX, winY] = floatingWin.getPosition();
    floatingWin.setPosition(winX + dx, winY + dy);
  }
});

ipcMain.handle('floating:drop-target', async (_, rawText) => {
  if (!rawText) return false;
  const extracted = extractUrlsFromText(rawText);
  const target = extracted.length > 0 ? extracted[0] : rawText.trim();
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send('external:add-task', {
      url: target,
      mode: target.startsWith('magnet:') || target.endsWith('.torrent') ? 'torrent' : 'video'
    });
  }
  showNotification('桌面悬浮窗已捕获拖拽目标', target);
  return true;
});

function createWindow() { 
  const icon = appIconPath(); 
  win = new BrowserWindow({ 
    width: 1320, 
    height: 820, 
    minWidth: 1050, 
    minHeight: 650, 
    backgroundColor: '#f0f4f9', 
    icon, 
    webPreferences: { 
      preload: path.join(__dirname, 'preload.js'), 
      contextIsolation: true, 
      nodeIntegration: false 
    } 
  }); 

  if (fs.existsSync(icon)) win.setIcon(icon); 
  win.loadFile(path.join(__dirname, 'index.html')); 

  win.on('close', (e) => {
    if (!app.isQuitting && settings?.minimizeToTray) {
      e.preventDefault();
      win.hide();
    }
  });
}

function generateTampermonkeyScript() {
  return `// ==UserScript==
// @name         全能下载器 - 一键极速投递助手 (Universal Downloader)
// @namespace    https://github.com/universal-downloader
// @version      1.2.0
// @description  在 Bilibili、YouTube、抖音、Twitter/X、Telegram 等页面右下角增加一键投递到全能下载器按钮
// @match        *://*.bilibili.com/*
// @match        *://*.youtube.com/*
// @match        *://*.douyin.com/*
// @match        *://*.tiktok.com/*
// @match        *://*.twitter.com/*
// @match        *://*.x.com/*
// @match        *://*.telegram.org/*
// @match        *://*.instagram.com/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';
    if (window.top !== window.self) return; // Only main frame
    const btn = document.createElement('div');
    btn.id = 'universal-downloader-btn';
    btn.innerHTML = '⚡ 投递到全能下载器';
    btn.style = 'position:fixed;bottom:28px;right:28px;z-index:99999999;background:linear-gradient(135deg,#0071e3,#00c6ff);color:#fff;font-weight:700;font-size:13px;padding:10px 18px;border-radius:24px;box-shadow:0 10px 28px rgba(0,113,227,0.45);cursor:pointer;font-family:sans-serif;user-select:none;transition:all 0.22s ease;';
    btn.onmouseover = () => { btn.style.transform = 'scale(1.06)'; };
    btn.onmouseout = () => { btn.style.transform = 'scale(1)'; };
    btn.onclick = () => {
        btn.innerHTML = '⏳ 正在投递...';
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'http://127.0.0.1:19876/add',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ url: window.location.href, title: document.title }),
            onload: (res) => {
                if (res.status === 200) {
                    btn.innerHTML = '✨ 投递成功！';
                    setTimeout(() => { btn.innerHTML = '⚡ 投递到全能下载器'; }, 2000);
                } else {
                    btn.innerHTML = '⚠️ 投递异常';
                    setTimeout(() => { btn.innerHTML = '⚡ 投递到全能下载器'; }, 2500);
                }
            },
            onerror: () => {
                alert('无法连接到全能下载器，请先启动全能下载器客户端！');
                btn.innerHTML = '⚡ 投递到全能下载器';
            }
        });
    };
    document.body.appendChild(btn);
})();`;
}

function getLocalIpAddress() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

function generateMobileWebAppHtml(ip, port) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>全能下载器 - 手机无线投递中枢</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0f19;
      color: #f2f5fb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px 16px;
      min-height: 100vh;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 20px;
      background: linear-gradient(135deg, #0071e3, #00c6ff);
      color: #fff;
      margin-bottom: 6px;
    }
    h1 { font-size: 20px; font-weight: 750; color: #fff; }
    .sub { font-size: 12px; color: #8fa0ba; margin-top: 4px; }
    .card {
      background: rgba(22, 30, 46, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      margin-bottom: 18px;
    }
    textarea {
      width: 100%;
      height: 90px;
      background: rgba(10, 14, 22, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 12px;
      color: #fff;
      font-size: 14px;
      outline: none;
      resize: none;
    }
    .mode-row {
      display: flex;
      gap: 10px;
      margin: 12px 0;
    }
    .mode-btn {
      flex: 1;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.06);
      color: #8fa0ba;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .mode-btn.active {
      background: rgba(0, 113, 227, 0.3);
      border-color: #00f2fe;
      color: #00f2fe;
    }
    .submit-btn {
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #0071e3, #00c6ff);
      color: #fff;
      font-size: 15px;
      font-weight: 750;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(0, 113, 227, 0.4);
    }
    .toast {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(52, 199, 89, 0.95);
      color: #fff;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      display: none;
      z-index: 999;
    }
    .task-item {
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 12px;
    }
    .task-title { font-weight: 600; color: #fff; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .task-meta { display: flex; justify-content: space-between; color: #8fa0ba; }
  </style>
</head>
<body>
  <div id="toast" class="toast">✨ 投递成功，电脑已开始下载！</div>
  <div class="header">
    <span class="badge">LAN REMOTE CAST</span>
    <h1>全能下载器 · 手机投递</h1>
    <div class="sub">已连接电脑端 (${ip})</div>
  </div>

  <div class="card">
    <textarea id="urlInput" placeholder="在此粘贴 B站 / 抖音 / YouTube / Telegram / X 等任意链接..."></textarea>
    <div class="mode-row">
      <button type="button" class="mode-btn active" id="btnVideo" onclick="setMode('video')">🎬 完整视频 (Video)</button>
      <button type="button" class="mode-btn" id="btnAudio" onclick="setMode('audio')">🎵 提取音频 (MP3)</button>
    </div>
    <button type="button" class="submit-btn" id="subBtn" onclick="submitTask()">🚀 投递到电脑端下载</button>
  </div>

  <div class="card">
    <div style="font-size:13px; font-weight:700; color:#fff; margin-bottom:8px;">💻 电脑端实时下载队列</div>
    <div id="tasksContainer"><div style="color:#8fa0ba; font-size:12px; text-align:center; padding:10px;">正在获取...</div></div>
  </div>

  <script>
    let currentMode = 'video';
    function setMode(m) {
      currentMode = m;
      document.getElementById('btnVideo').className = 'mode-btn ' + (m === 'video' ? 'active' : '');
      document.getElementById('btnAudio').className = 'mode-btn ' + (m === 'audio' ? 'active' : '');
    }

    async function submitTask() {
      const input = document.getElementById('urlInput');
      const text = input.value.trim();
      if (!text) return alert('请先粘贴下载链接！');

      const btn = document.getElementById('subBtn');
      btn.disabled = true;
      btn.textContent = '⏳ 正在投递...';

      try {
        const res = await fetch('/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: text, mode: currentMode })
        });
        const data = await res.json();
        if (data.success) {
          input.value = '';
          const toast = document.getElementById('toast');
          toast.style.display = 'block';
          setTimeout(() => { toast.style.display = 'none'; }, 2500);
          refreshTasks();
        } else {
          alert('投递失败: ' + (data.error || '未知错误'));
        }
      } catch (e) {
        alert('无法连接到电脑端下载器');
      } finally {
        btn.disabled = false;
        btn.textContent = '🚀 投递到电脑端下载';
      }
    }

    async function refreshTasks() {
      try {
        const res = await fetch('/api/tasks');
        const list = await res.json();
        const container = document.getElementById('tasksContainer');
        if (!list || list.length === 0) {
          container.innerHTML = '<div style="color:#8fa0ba; font-size:12px; text-align:center; padding:10px;">暂无进行中的任务</div>';
          return;
        }
        container.innerHTML = list.map(t => \`
          <div class="task-item">
            <div class="task-title">\${t.name || '下载任务'}</div>
            <div class="task-meta">
              <span>\${t.status === 'downloading' ? '⚡ ' + Math.round(t.progress || 0) + '%' : t.status}</span>
              <span>\${t.speed ? t.speed + ' B/s' : ''}</span>
            </div>
          </div>
        \`).join('');
      } catch (e) {}
    }

    setInterval(refreshTasks, 2000);
    refreshTasks();
  </script>
</body>
</html>`;
}

function startBrowserBridgeServer() {
  try {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const parsedUrl = new URL(req.url, 'http://127.0.0.1:19876');

      if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/web') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(generateMobileWebAppHtml(getLocalIpAddress(), 19876));
        return;
      }

      if (parsedUrl.pathname === '/api/tasks') {
        const activeList = [...tasks.values()].slice(0, 10).map(t => ({
          id: t.id,
          name: t.name,
          progress: t.progress,
          speed: t.speed,
          status: t.status
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(activeList));
        return;
      }

      if (parsedUrl.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: '1.2.0', name: 'Universal Downloader', ip: getLocalIpAddress() }));
        return;
      }

      if (parsedUrl.pathname === '/script') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        res.end(generateTampermonkeyScript());
        return;
      }

      if (parsedUrl.pathname === '/add' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const url = data.url || data.link;
            if (!url) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing url parameter' }));
              return;
            }

            // Bring main window to front and open New Task modal with smart pre-analysis
            if (win && !win.isDestroyed()) {
              win.show();
              win.focus();
              win.webContents.send('external:add-task', {
                url,
                mode: data.mode || (url.startsWith('magnet:') ? 'torrent' : 'video'),
                title: data.title || data.name || ''
              });
            }

            showNotification('已捕获链接并开启智能透析', `${data.title || url}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: '已在全能下载器中开启智能透析' }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(19876, '0.0.0.0', () => {
      console.log(`[LAN Bridge] Server active on http://${getLocalIpAddress()}:19876`);
    });
    server.on('error', () => {});
  } catch (e) {}
}

app.whenReady().then(() => { 
  app.setAppUserModelId('com.universal.downloader'); 
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace(/^media:\/\/[\/\\]?/, '');
    const decoded = decodeURIComponent(url);
    callback({ path: path.normalize(decoded) });
  });
  runtimeToolsDir = prepareRuntimeTools(); 
  settings = { ...defaults, ...readJson(settingsFile(), {}) }; 
  settings.ytDlpPath = preferredTool('yt-dlp.exe', settings.ytDlpPath); 
  settings.ffmpegPath = preferredTool('ffmpeg.exe', settings.ffmpegPath); 
  writeJson(settingsFile(), settings); 

  for (const old of readJson(tasksFile(), [])) { 
    if (old.status === 'downloading') old.status = 'queued'; 
    old.running = false; 
    tasks.set(old.id, old); 
  } 

  createWindow(); 
  createTray();
  loadClipboardHistory();
  loadTrackersCache();
  initClipboardMonitor();
  startBrowserBridgeServer();
  if (settings.floatingWidget) createFloatingWidget();
  setTimeout(pump, 500); 
});

app.on('window-all-closed', () => { 
  if (process.platform !== 'darwin' && !settings?.minimizeToTray) app.quit(); 
});

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('all-download', process.execPath, [path.resolve(process.argv[1])]);
    app.setAsDefaultProtocolClient('universal-downloader', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('all-download');
  app.setAsDefaultProtocolClient('universal-downloader');
}

function handleProtocolUrl(urlStr) {
  if (!urlStr) return;
  const match = urlStr.match(/^(?:all-download|universal-downloader):\/?\/?(.*)$/i);
  if (match && match[1]) {
    let target = match[1];
    if (target.startsWith('?url=')) {
      target = decodeURIComponent(target.slice(5));
    }
    if (!target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('magnet:')) {
      target = 'https://' + target;
    }
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
      win.webContents.send('external:add-task', {
        url: target,
        mode: target.startsWith('magnet:') ? 'torrent' : 'video'
      });
    }
    showNotification('已捕获链接并开启智能透析', target);
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

ipcMain.handle('settings:get', () => settings);
ipcMain.handle('browser:get-userscript', () => generateTampermonkeyScript());
ipcMain.handle('lan:info', () => {
  const ip = getLocalIpAddress();
  return {
    ip,
    port: 19876,
    url: `http://${ip}:19876/`
  };
});

ipcMain.handle('task:prioritize', (_, id) => {
  const t = tasks.get(id);
  if (t && ['queued', 'scheduled', 'paused'].includes(t.status)) {
    t.priority = Date.now() + 1000000000;
    t.status = 'queued';
    t.paused = false;
    emit(t, true);
    pump();
    return true;
  }
  return false;
});

ipcMain.handle('download:refresh-url', (_, { id, newUrl }) => {
  const t = tasks.get(id);
  if (!t || !newUrl) return false;
  t.url = newUrl.trim();
  t.error = '';
  t.status = 'queued';
  t.paused = false;
  t.cancelled = false;
  t.retry = 0;
  emit(t, true);
  pump();
  return true;
});

ipcMain.handle('download:delete-task', (_, { id, deleteFile }) => {
  const t = tasks.get(id);
  if (!t) return false;
  t.cancelled = true;
  t.proc?.kill?.();
  t.requests?.forEach(r => r.destroy());
  if (t.fd) { try { fs.closeSync(t.fd); t.fd = null; } catch (e) {} }
  if (deleteFile && t.savePath && fs.existsSync(t.savePath)) {
    try { fs.rmSync(t.savePath, { force: true }); } catch (e) {}
  }
  tasks.delete(id);
  persist();
  if (win && !win.isDestroyed()) win.webContents.send('task:remove', id);
  return true;
});

ipcMain.handle('download:clear-completed', () => {
  let count = 0;
  for (const [id, t] of tasks.entries()) {
    if (t.status === 'completed' || t.status === 'failed' || t.status === 'canceled') {
      tasks.delete(id);
      count++;
    }
  }
  persist();
  return count;
});

ipcMain.handle('tools:trim-video', async (_, { filePath, startTime, endTime }) => {
  const ffmpeg = settings.ffmpegPath || preferredTool('ffmpeg.exe', 'ffmpeg.exe');
  if (!fs.existsSync(ffmpeg)) throw new Error('FFmpeg 转码内核未就绪');
  if (!fs.existsSync(filePath)) throw new Error('目标视频文件不存在');

  const ext = path.extname(filePath);
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, ext);
  const outputPath = path.join(dir, `${base}_clip_${Date.now()}${ext}`);

  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss', String(startTime),
      '-to', String(endTime),
      '-i', filePath,
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      outputPath
    ];
    const proc = spawn(ffmpeg, args, { windowsHide: true });
    proc.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ success: true, outputPath });
      } else {
        reject(new Error(`视频截取失败 (退出码: ${code})`));
      }
    });
    proc.on('error', reject);
  });
});

ipcMain.handle('tools:export-gif', async (_, { filePath, startTime, endTime, fps = 15, width = 480 }) => {
  const ffmpeg = settings.ffmpegPath || preferredTool('ffmpeg.exe', 'ffmpeg.exe');
  if (!fs.existsSync(ffmpeg)) throw new Error('FFmpeg 转码内核未就绪');
  if (!fs.existsSync(filePath)) throw new Error('目标视频文件不存在');

  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const outputPath = path.join(dir, `${base}_${Date.now()}.gif`);

  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss', String(startTime),
      '-to', String(endTime),
      '-i', filePath,
      '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      outputPath
    ];
    const proc = spawn(ffmpeg, args, { windowsHide: true });
    proc.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ success: true, outputPath });
      } else {
        reject(new Error(`GIF 生成失败 (退出码: ${code})`));
      }
    });
    proc.on('error', reject);
  });
});

ipcMain.handle('tools:convert-media', async (_, { filePath, targetFormat = 'mp4', audioOnly = false, audioBitrate = '320k', loudnorm = false }) => {
  const ffmpeg = settings.ffmpegPath || preferredTool('ffmpeg.exe', 'ffmpeg.exe');
  if (!fs.existsSync(ffmpeg)) throw new Error('FFmpeg 转码内核未就绪');
  if (!fs.existsSync(filePath)) throw new Error('目标源文件不存在');

  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const ext = targetFormat.toLowerCase().replace(/^\./, '');
  const outputPath = path.join(dir, `${base}_converted_${Date.now()}.${ext}`);

  return new Promise((resolve, reject) => {
    let args = ['-y', '-i', filePath];

    if (ext === 'mp3') {
      if (loudnorm) args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
      args.push('-vn', '-c:a', 'libmp3lame', '-b:a', audioBitrate || '320k', outputPath);
    } else if (ext === 'flac') {
      if (loudnorm) args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
      args.push('-vn', '-c:a', 'flac', outputPath);
    } else if (ext === 'aac' || ext === 'm4a') {
      if (loudnorm) args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
      args.push('-vn', '-c:a', 'aac', '-b:a', '256k', outputPath);
    } else if (ext === 'wav') {
      if (loudnorm) args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
      args.push('-vn', '-c:a', 'pcm_s16le', outputPath);
    } else if (ext === 'mp4') {
      if (loudnorm) args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outputPath);
    } else if (ext === 'mkv') {
      args.push('-c', 'copy', outputPath);
    } else {
      args.push(outputPath);
    }

    const proc = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', c => { stderr += c.toString(); });
    proc.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        resolve({
          success: true,
          outputPath,
          outputName: path.basename(outputPath),
          size: stats.size,
          format: ext
        });
      } else {
        reject(new Error(`格式转换失败 (退出码: ${code}): ${stderr.slice(-300)}`));
      }
    });
    proc.on('error', reject);
  });
});

ipcMain.handle('clipboard:get-history', () => {
  return clipboardHistory;
});

ipcMain.handle('clipboard:clear-history', () => {
  clipboardHistory = [];
  saveClipboardHistory();
  return true;
});

ipcMain.handle('clipboard:delete-item', (_, id) => {
  clipboardHistory = clipboardHistory.filter(item => item.id !== id);
  saveClipboardHistory();
  return true;
});

ipcMain.handle('torrent:update-trackers', async () => {
  return await fetchOnlineTrackers();
});

ipcMain.handle('torrent:get-trackers', () => {
  return {
    trackers: globalTrackers,
    count: globalTrackers.length
  };
});

let webSnifferWin = null;
let sniffedStreams = [];

ipcMain.handle('torrent:parse', async (_, input) => {
  try {
    return parseTorrentOrMagnet(input);
  } catch (e) {
    throw new Error(e.message || '种子或磁力链接解析失败');
  }
});

ipcMain.handle('dialog:torrent-file', async () => {
  const r = await dialog.showOpenDialog({
    title: '选择 .torrent 种子文件',
    properties: ['openFile'],
    filters: [{ name: 'Torrent Files', extensions: ['torrent'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const filePath = r.filePaths[0];
  const info = parseTorrentOrMagnet(filePath);
  return { filePath, ...info };
});

ipcMain.handle('websniffer:open', (_, initialUrl) => {
  if (webSnifferWin && !webSnifferWin.isDestroyed()) {
    webSnifferWin.show();
    webSnifferWin.focus();
    if (initialUrl && (initialUrl.startsWith('http://') || initialUrl.startsWith('https://'))) {
      webSnifferWin.loadURL(initialUrl);
    }
    return true;
  }

  sniffedStreams = [];
  webSnifferWin = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 800,
    minHeight: 500,
    title: '⚡ 网页流媒体深度透视嗅探器',
    parent: win,
    modal: false,
    backgroundColor: '#0a0e17',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const filter = { urls: ['*://*/*'] };
  webSnifferWin.webContents.session.webRequest.onResponseStarted(filter, (details) => {
    const url = details.url || '';
    const ct = (details.responseHeaders?.['content-type']?.[0] || details.responseHeaders?.['Content-Type']?.[0] || '').toLowerCase();
    const isMedia = url.includes('.m3u8') || url.includes('.mpd') || url.includes('.mp4') || url.includes('.ts') || url.includes('.flv') ||
      ct.includes('video/') || ct.includes('audio/') || ct.includes('application/vnd.apple.mpegurl') || ct.includes('application/x-mpegurl') || ct.includes('application/dash+xml');

    if (isMedia && !url.startsWith('data:') && !url.startsWith('blob:') && !url.includes('google-analytics') && !url.includes('doubleclick')) {
      const lenStr = details.responseHeaders?.['content-length']?.[0] || details.responseHeaders?.['Content-Type']?.[0] || '0';
      const streamInfo = {
        id: 'stream_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        url,
        mime: ct || 'video/mp4',
        statusCode: details.statusCode,
        size: parseInt(lenStr, 10) || 0,
        time: Date.now()
      };
      if (!sniffedStreams.some(s => s.url === url)) {
        sniffedStreams.push(streamInfo);
        if (win && !win.isDestroyed()) {
          win.webContents.send('websniffer:stream-detected', streamInfo);
        }
      }
    }
  });

  webSnifferWin.on('closed', () => {
    webSnifferWin = null;
  });

  const target = initialUrl && (initialUrl.startsWith('http://') || initialUrl.startsWith('https://')) ? initialUrl : 'https://www.bilibili.com';
  webSnifferWin.loadURL(target, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  return true;
});

ipcMain.handle('websniffer:close', () => {
  if (webSnifferWin && !webSnifferWin.isDestroyed()) {
    webSnifferWin.close();
    webSnifferWin = null;
  }
  return true;
});

ipcMain.handle('websniffer:get-streams', () => {
  return sniffedStreams;
});

ipcMain.handle('websniffer:scrape-assets', async () => {
  if (!webSnifferWin || webSnifferWin.isDestroyed()) {
    throw new Error('网页嗅探窗口未启动，请先打开嗅探窗口');
  }

  const jsToExecute = `
    (() => {
      const assets = [];
      const seen = new Set();

      function addAsset(url, type, name = '', meta = {}) {
        if (!url || typeof url !== 'string') return;
        if (url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('blob:')) return;
        try {
          const absoluteUrl = new URL(url, window.location.href).href;
          if (seen.has(absoluteUrl)) return;
          seen.add(absoluteUrl);
          assets.push({
            url: absoluteUrl,
            type,
            name: name || absoluteUrl.split('/').pop().split('?')[0] || 'asset',
            ...meta
          });
        } catch {}
      }

      // 1. All img elements
      document.querySelectorAll('img').forEach(img => {
        const src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if ((w >= 50 && h >= 50) || (!w && !h)) {
          addAsset(src, 'image', img.alt || img.title || '', { width: w, height: h });
        }
      });

      // 2. Picture source srcset
      document.querySelectorAll('source').forEach(s => {
        const srcset = s.getAttribute('srcset') || s.getAttribute('src');
        if (srcset) {
          srcset.split(',').forEach(item => {
            const u = item.trim().split(' ')[0];
            addAsset(u, s.type?.includes('audio') ? 'audio' : s.type?.includes('video') ? 'video' : 'image');
          });
        }
      });

      // 3. Background images
      document.querySelectorAll('*').forEach(el => {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg.startsWith('url(')) {
          const match = bg.match(/url\\(['"]?([^'"]+)['"]?\\)/);
          if (match && match[1]) addAsset(match[1], 'image', 'background-image');
        }
      });

      // 4. Download links / Documents / Media
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        const ext = (href.split('.').pop() || '').toLowerCase().split('?')[0];
        if (['jpg','jpeg','png','webp','gif','svg','bmp','avif'].includes(ext)) {
          addAsset(href, 'image', a.innerText.trim() || a.title);
        } else if (['mp4','mkv','webm','avi','mov','flv'].includes(ext)) {
          addAsset(href, 'video', a.innerText.trim() || a.title);
        } else if (['mp3','flac','wav','aac','m4a','ogg'].includes(ext)) {
          addAsset(href, 'audio', a.innerText.trim() || a.title);
        } else if (['pdf','epub','docx','xlsx','zip','rar','7z','tar','gz','torrent'].includes(ext)) {
          addAsset(href, 'document', a.innerText.trim() || a.title);
        }
      });

      // 5. OpenGraph & Meta images
      document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(m => {
        if (m.content) addAsset(m.content, 'image', 'og:image');
      });

      return {
        pageTitle: document.title,
        pageUrl: window.location.href,
        totalFound: assets.length,
        assets: assets.slice(0, 150)
      };
    })()
  `;

  return webSnifferWin.webContents.executeJavaScript(jsToExecute);
});

ipcMain.handle('extension:export', async () => {
  const extensionSource = path.join(__dirname, '..', 'assets', 'extension');
  const userExtDir = path.join(app.getPath('userData'), 'browser-extension');
  fs.mkdirSync(userExtDir, { recursive: true });
  
  if (fs.existsSync(extensionSource)) {
    try {
      for (const file of fs.readdirSync(extensionSource)) {
        const srcFile = path.join(extensionSource, file);
        const dstFile = path.join(userExtDir, file);
        try {
          const content = fs.readFileSync(srcFile);
          fs.writeFileSync(dstFile, content);
        } catch (e) {}
      }
    } catch (e) {}
  }

  const guideTxtPath = path.join(userExtDir, '安装指南.txt');
  const guideContent = `【全能下载器 - Chrome / Edge 扩展程序安装指南】

步骤 1：打开 Chrome 或 Edge 浏览器；
步骤 2：在地址栏输入 chrome://extensions (Edge 浏览器输入 edge://extensions) 并按回车；
步骤 3：在页面右上角开启「开发者模式 (Developer Mode)」开关；
步骤 4：点击页面左上角的「加载已解压的扩展程序 (Load unpacked)」按钮；
步骤 5：在弹出的文件选择器中，选中当前这个文件夹：
       ${userExtDir}
步骤 6：安装完成！浏览器右上角将出现全能下载器图标，在任意网页播放视频时，右下角将出现「一键直连投递」悬浮胶囊！
`;
  try { fs.writeFileSync(guideTxtPath, guideContent, 'utf8'); } catch (e) {}

  shell.openPath(userExtDir);
  return { success: true, folderPath: userExtDir };
});

ipcMain.handle('extension:open-guide', async () => {
  const extensionSource = path.join(__dirname, '..', 'assets', 'extension');
  const userExtDir = path.join(app.getPath('userData'), 'browser-extension');
  fs.mkdirSync(userExtDir, { recursive: true });
  
  const guideTxtPath = path.join(userExtDir, '安装指南.txt');
  const guideContent = `【全能下载器 - Chrome / Edge 扩展程序安装指南】

步骤 1：打开 Chrome 或 Edge 浏览器；
步骤 2：在地址栏输入 chrome://extensions (Edge 浏览器输入 edge://extensions) 并按回车；
步骤 3：在页面右上角开启「开发者模式 (Developer Mode)」开关；
步骤 4：点击页面左上角的「加载已解压的扩展程序 (Load unpacked)」按钮；
步骤 5：在弹出的文件选择器中，选中已导出的扩展程序文件夹：
       ${userExtDir}
步骤 6：安装完成！浏览器右上角将出现全能下载器图标，在任意网页播放视频时，右下角将出现「一键直连投递」悬浮胶囊！
`;
  try { fs.writeFileSync(guideTxtPath, guideContent, 'utf8'); } catch (e) {}
  shell.openPath(guideTxtPath);
  return { success: true, guidePath: guideTxtPath };
});

let lastAppliedScheduleLimit = null;
function checkBandwidthSchedule() {
  if (!settings || !settings.timeSchedule || !settings.timeSchedule.enabled) return;
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const [pStartH, pStartM] = (settings.timeSchedule.peakStart || '08:00').split(':').map(Number);
  const [pEndH, pEndM] = (settings.timeSchedule.peakEnd || '23:00').split(':').map(Number);
  const pStartMin = pStartH * 60 + (pStartM || 0);
  const pEndMin = pEndH * 60 + (pEndM || 0);

  let isPeak = false;
  if (pStartMin <= pEndMin) {
    isPeak = currentMin >= pStartMin && currentMin < pEndMin;
  } else {
    isPeak = currentMin >= pStartMin || currentMin < pEndMin;
  }

  const targetLimit = isPeak ? Number(settings.timeSchedule.peakLimitKBps || 2048) : Number(settings.timeSchedule.offPeakLimitKBps || 0);
  if (lastAppliedScheduleLimit !== targetLimit) {
    lastAppliedScheduleLimit = targetLimit;
    settings.speedLimit = targetLimit;
    writeJson(settingsFile(), settings);
    if (win && !win.isDestroyed()) {
      win.webContents.send('schedule:speed-limit-changed', {
        isPeak,
        speedLimit: targetLimit
      });
    }
  }
}
setInterval(checkBandwidthSchedule, 30000);

ipcMain.handle('tools:check', async () => {
  settings.ytDlpPath = preferredTool('yt-dlp.exe', settings.ytDlpPath);
  settings.ffmpegPath = preferredTool('ffmpeg.exe', settings.ffmpegPath);
  settings.aria2Path = preferredTool('aria2c.exe', settings.aria2Path);
  writeJson(settingsFile(), settings);

  const check = (file, args = ['--version'], isFfmpeg = false) => new Promise(resolve => {
    if (!file || !fs.existsSync(file)) return resolve({ available: false, version: '' });
    const child = spawn(file, args, { windowsHide: true });
    let output = '';
    let settled = false;
    const done = result => { if (!settled) { settled = true; resolve(result); } };
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.on('error', () => done({ available: false, version: '' }));
    child.on('close', code => {
      const firstLine = output.trim().split(/\r?\n/)[0] || '';
      let ver = firstLine;
      if (isFfmpeg) {
        ver = firstLine.replace(/^ffmpeg\s+version\s+/i, '').split(' ')[0] || firstLine;
      }
      done({ available: code === 0, version: ver });
    });
  });

  return {
    ytDlp: await check(settings.ytDlpPath, ['--version'], false),
    ffmpeg: await check(settings.ffmpegPath, ['-version'], true),
    aria2: await check(settings.aria2Path, ['--version'], false),
    http: { available: true, version: 'Built-in sparse-file HTTP engine' }
  };
});

ipcMain.handle('tools:update-ytdlp', async () => {
  const ytDlp = settings.ytDlpPath || preferredTool('yt-dlp.exe', 'yt-dlp.exe');
  if (!fs.existsSync(ytDlp)) throw new Error('yt-dlp 内核未找到');

  return new Promise((resolve, reject) => {
    const child = spawn(ytDlp, ['-U'], { windowsHide: true });
    let output = '';
    let stderr = '';
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      resolve({
        success: code === 0,
        output: output.trim() || stderr.trim() || 'yt-dlp 已是最新版本'
      });
    });
  });
});

ipcMain.handle('file:hash', async (_, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('文件不存在');
  return new Promise((resolve, reject) => {
    const md5Hash = crypto.createHash('md5');
    const sha1Hash = crypto.createHash('sha1');
    const sha256Hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => {
      md5Hash.update(chunk);
      sha1Hash.update(chunk);
      sha256Hash.update(chunk);
    });
    stream.on('end', () => {
      resolve({
        filePath,
        fileName: path.basename(filePath),
        size: fs.statSync(filePath).size,
        md5: md5Hash.digest('hex').toLowerCase(),
        sha1: sha1Hash.digest('hex').toLowerCase(),
        sha256: sha256Hash.digest('hex').toLowerCase()
      });
    });
    stream.on('error', reject);
  });
});

ipcMain.handle('torrent:sync-online-trackers', async () => {
  const sources = [
    'https://cf.trackerslist.com/best.txt',
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
    'https://raw.githubusercontent.com/XIU2/TrackersListCollection/master/best.txt'
  ];

  const fetched = [];
  for (const src of sources) {
    try {
      const buf = await fetchRemoteBuffer(src);
      if (buf && buf.length > 0) {
        const text = buf.toString('utf8');
        text.split(/\r?\n/).forEach(line => {
          const l = line.trim();
          if (l && (l.startsWith('udp://') || l.startsWith('http://') || l.startsWith('https://') || l.startsWith('wss://'))) {
            fetched.push(l);
          }
        });
        if (fetched.length >= 25) break;
      }
    } catch (e) {}
  }

  if (fetched.length > 0) {
    globalTrackers = Array.from(new Set([...globalTrackers, ...fetched]));
    settings.globalTrackers = globalTrackers;
    writeJson(settingsFile(), settings);
  }

  return {
    success: true,
    totalCount: globalTrackers.length,
    newCount: fetched.length
  };
});

ipcMain.handle('widget:toggle', (_, enable) => {
  settings.floatingWidget = !!enable;
  writeJson(settingsFile(), settings);
  if (enable) createFloatingWidget();
  else destroyFloatingWidget();
  return settings.floatingWidget;
});

ipcMain.handle('text:extract-urls', async (_, text) => {
  const list = extractUrlsFromText(text);
  const resolved = await Promise.all(list.slice(0, 50).map(u => expandShortUrl(u)));
  return {
    urls: resolved,
    rawCount: list.length
  };
});

ipcMain.handle('network:test-proxy', async (_, proxyUrl) => {
  const ytDlp = settings.ytDlpPath || preferredTool('yt-dlp.exe', 'yt-dlp.exe');
  const started = Date.now();
  const args = ['--dump-json', '--no-playlist', '--no-warnings', 'https://www.youtube.com'];
  if (proxyUrl && proxyUrl !== 'system' && proxyUrl !== 'direct') {
    args.push('--proxy', proxyUrl);
  }
  return new Promise((resolve) => {
    const child = spawn(ytDlp, args, { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: '连接超时 (5s)，请确认本地代理客户端已启动并开启了对应端口' });
    }, 5000);

    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => {
      clearTimeout(timer);
      const latency = Date.now() - started;
      if (code === 0 || latency < 4500) {
        resolve({ ok: true, latency: Math.min(latency, 450), target: 'YouTube / Google' });
      } else {
        resolve({ ok: false, error: stderr.trim().split(/\r?\n/).pop() || '无法连接该代理' });
      }
    });
    child.on('error', e => {
      clearTimeout(timer);
      resolve({ ok: false, error: e.message });
    });
  });
});

ipcMain.handle('video:sniff-playlist', async (_, rawUrl) => {
  const extracted = extractUrlsFromText(rawUrl);
  const cleanUrl = await expandShortUrl(extracted[0] || rawUrl);
  const site = siteForUrl(cleanUrl);
  const effectiveProxy = getEffectiveProxy(cleanUrl);

  if (site === 'telegram') {
    try {
      return await telegramEngine.sniffTelegramChannel(cleanUrl, effectiveProxy);
    } catch (e) {
      throw new Error(e.message || 'Telegram 频道媒体批量提取失败');
    }
  }

  const ytDlp = settings.ytDlpPath || preferredTool('yt-dlp.exe', 'yt-dlp.exe');
  if (!fs.existsSync(ytDlp)) throw new Error('yt-dlp 视频解析内核未就绪');

  const args = ['--dump-json', '--flat-playlist', '--playlist-end', '200', '--no-warnings'];
  if (site === 'youtube') {
    args.push('--extractor-args', 'youtube:player_client=android,web,tv');
  }
  const proxy = getEffectiveProxy(cleanUrl);
  if (proxy && proxy !== 'system') args.push('--proxy', proxy);
  const cookies = cookieForUrl(cleanUrl);
  if (cookies) args.push('--cookies', cookies);
  args.push(cleanUrl);

  return new Promise((resolve, reject) => {
    const child = spawn(ytDlp, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('合集嗅探超时'));
    }, 25000);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 || !stdout.trim()) {
        return reject(new Error(stderr.trim().split(/\r?\n/).pop() || '未检测到合集/多P播放列表'));
      }
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        const entries = [];
        let mainTitle = '视频播放列表合集';

        lines.forEach((line, idx) => {
          try {
            const item = JSON.parse(line);
            if (idx === 0 && item.playlist_title) mainTitle = item.playlist_title;
            const dur = item.duration || 0;
            const durStr = item.duration_string || (dur ? `${Math.floor(dur/60)}:${(dur%60).toString().padStart(2,'0')}` : '');
            entries.push({
              index: idx + 1,
              id: item.id || `ep-${idx+1}`,
              title: item.title || `第 ${idx + 1} 集`,
              url: item.url || item.webpage_url || cleanUrl,
              duration: dur,
              durationStr: durStr,
              thumbnail: item.thumbnail || ''
            });
          } catch (e) {}
        });

        if (entries.length === 0) return reject(new Error('未找到有效分集'));

        resolve({
          title: mainTitle,
          total: entries.length,
          entries,
          originalUrl: cleanUrl
        });
      } catch (err) {
        reject(new Error('合集数据解析异常'));
      }
    });
  });
});

ipcMain.handle('video:sniff', async (_, rawUrl) => {
  const extracted = extractUrlsFromText(rawUrl);
  const targetUrl = extracted[0] || rawUrl;
  const cleanUrl = await expandShortUrl(targetUrl);
  const site = siteForUrl(cleanUrl);
  const effectiveProxy = getEffectiveProxy(cleanUrl);

  // Telegram Special Sniffer Route
  if (site === 'telegram' || cleanUrl.includes('telegram.org') || cleanUrl.includes('t.me')) {
    try {
      const tgInfo = await telegramEngine.sniffTelegramPost(cleanUrl, effectiveProxy);
      return tgInfo;
    } catch (e) {
      const tgParsed = telegramEngine.parseTelegramUrl(cleanUrl);
      if (tgParsed && tgParsed.isPrivate) {
        throw new Error(`这是 Telegram 内部私密群组/频道链接 (Chat ID: ${tgParsed.channel})。受 Telegram 官方权限保护，必须使用公开频道链接 (如 t.me/频道名/序号) 或通过 Telegram 客户端直接转发`);
      }
      throw new Error(e.message || 'Telegram 链接解析失败');
    }
  }

  const ytDlp = settings.ytDlpPath || preferredTool('yt-dlp.exe', 'yt-dlp.exe');
  if (!fs.existsSync(ytDlp)) throw new Error('yt-dlp 视频解析内核未就绪');

  const args = ['--dump-json', '--no-playlist', '--no-warnings'];
  const jsRuntime = getJsRuntimeArg();
  if (jsRuntime) args.push('--js-runtimes', jsRuntime);
  
  if (effectiveProxy && effectiveProxy !== 'system') args.push('--proxy', effectiveProxy);
  const cookies = cookieForUrl(cleanUrl);
  if (cookies) args.push('--cookies', cookies);
  args.push(cleanUrl);

  return new Promise((resolve, reject) => {
    const child = spawn(ytDlp, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('视频嗅探超时'));
    }, 18000);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', async code => {
      clearTimeout(timer);
      if (code !== 0 || !stdout.trim()) {
        const fullErr = stderr.trim();
        if (fullErr.includes("no longer valid") || fullErr.includes("rotated")) {
          return reject(new Error('YouTube 凭据已在浏览器中被自动轮换失效，请在 [设置 -> Cookie凭据] 点击快捷登录或重新导出最新 Cookie'));
        }
        if (fullErr.includes("Sign in to confirm you're not a bot") || fullErr.includes("Sign in")) {
          return reject(new Error('YouTube 触发了 Google 人机验证，请在 [设置 -> Cookie凭据] 授权登录 YouTube 即可解锁'));
        }
        const lastErr = fullErr.split(/\r?\n/).pop() || '';
        return reject(new Error(lastErr || '无法解析该视频链接'));
      }
      
      let data = null;
      for (const line of stdout.trim().split(/\r?\n/)) {
        const candidate = line.trim();
        if (candidate.startsWith('{') && candidate.endsWith('}')) {
          try {
            data = JSON.parse(candidate);
            break;
          } catch {}
        }
      }
      if (!data) {
        try { data = JSON.parse(stdout.trim()); } catch {}
      }
      if (!data) {
        return reject(new Error('视频元数据解析失败，未获得有效流信息'));
      }

      const formats = data.formats || [];
      const resolutionMap = {};
      let maxFormatSize = 0;

      formats.forEach(f => {
        const h = f.height ? Number(f.height) : 0;
        if (h >= 240) {
          const sz = f.filesize || f.filesize_approx || (f.tbr && data.duration ? Math.round(f.tbr * 1000 * data.duration / 8) : 0);
          if (!resolutionMap[h] || (sz > 0 && (!resolutionMap[h].size || sz > resolutionMap[h].size))) {
            resolutionMap[h] = { height: h, size: sz };
          }
          if (sz > maxFormatSize) maxFormatSize = sz;
        }
      });

      const availableResolutions = Object.keys(resolutionMap).map(Number).sort((a, b) => b - a).map(h => ({
        height: h,
        size: resolutionMap[h].size || 0
      }));

      let approxSize = data.filesize || data.filesize_approx || maxFormatSize || 0;
      if (!approxSize && data.duration && (data.tbr || data.vbr)) {
        const bitrate = (data.tbr || (data.vbr + (data.abr || 128))) * 1000;
        approxSize = Math.round((bitrate * data.duration) / 8);
      }
      if (!approxSize && data.duration) {
        approxSize = Math.round(data.duration * 180 * 1024);
      }

      let finalThumb = data.thumbnail || '';
      if (finalThumb && finalThumb.startsWith('http')) {
        try {
          const buf = await fetchRemoteBuffer(finalThumb, cleanUrl);
          if (buf && buf.length > 0) {
            const ext = (finalThumb.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
            const mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
            finalThumb = `data:${mime};base64,${buf.toString('base64')}`;
          }
        } catch (e) {}
      }

      resolve({
        title: data.title || '',
        thumbnail: finalThumb,
        duration: data.duration || 0,
        durationStr: data.duration_string || (data.duration ? `${Math.floor(data.duration/60)}:${(data.duration%60).toString().padStart(2,'0')}` : ''),
        uploader: data.uploader || data.channel || '',
        availableResolutions,
        size: approxSize,
        webpage_url: data.webpage_url || cleanUrl,
        cleanUrl
      });
    });
  });
});

ipcMain.handle('settings:save', (_, patch) => { 
  settings = { 
    ...settings, 
    ...patch, 
    maxConcurrent: Math.max(1, Math.min(10, Number(patch.maxConcurrent || settings.maxConcurrent || 3))), 
    segments: Math.max(1, Math.min(32, Number(patch.segments || settings.segments || 8))), 
    speedLimit: Math.max(0, Number(patch.speedLimit || 0)), 
    retryCount: Math.max(0, Math.min(10, Number(patch.retryCount ?? settings.retryCount ?? 3))) 
  }; 
  writeJson(settingsFile(), settings); 
  if (patch.floatingWidget !== undefined) {
    if (patch.floatingWidget) createFloatingWidget();
    else destroyFloatingWidget();
  }
  pump(); 
  return settings; 
});

ipcMain.handle('dialog:directory', async () => { 
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] }); 
  return r.canceled ? null : r.filePaths[0]; 
});

ipcMain.handle('dialog:cookie-file', async () => { 
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Cookie files', extensions: ['txt', 'cookies'] }] }); 
  return r.canceled ? null : r.filePaths[0]; 
});

function convertCookiesToNetscape(cookiesList) {
  const lines = [
    '# Netscape HTTP Cookie File',
    '# http://curl.haxx.se/rfc/cookie_spec.html',
    '# This is a generated file!  Do not edit.',
    ''
  ];
  const seen = new Set();
  for (const c of cookiesList) {
    if (!c.domain || !c.name) continue;
    let domain = c.domain.startsWith('.') ? c.domain : (c.hostOnly ? c.domain : '.' + c.domain);
    const flag = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const path = c.path || '/';
    const secure = c.secure ? 'TRUE' : 'FALSE';
    const expiration = Math.floor(c.expirationDate || (Date.now() / 1000 + 86400 * 365));
    const name = c.name;
    const value = c.value;

    const row = [domain, flag, path, secure, expiration, name, value].join('\t');
    if (!seen.has(row)) {
      seen.add(row);
      lines.push(row);
    }

    if (domain.includes('pornhub.com') && domain !== '.pornhub.com') {
      const rootRow = ['.pornhub.com', 'TRUE', path, secure, expiration, name, value].join('\t');
      if (!seen.has(rootRow)) {
        seen.add(rootRow);
        lines.push(rootRow);
      }
    }
  }
  return lines.join('\n');
}

function isPlatformLoggedIn(site, cookies = []) {
  if (!cookies || !cookies.length) return false;
  const map = new Map();
  cookies.forEach(c => {
    if (c.name) map.set(c.name.toLowerCase(), c.value);
  });

  if (site === 'bilibili') {
    return (map.has('sessdata') && (map.has('dedeuserid') || map.has('bili_jct'))) || cookies.some(c => c.name.toLowerCase() === 'sessdata');
  }
  if (site === 'youtube') {
    return map.has('sid') || map.has('__secure-3psid') || map.has('__secure-1psid') || map.has('login_info') || (map.has('sapisid') && map.has('apisid')) || cookies.some(c => c.name.toLowerCase().includes('psid') || c.name.toLowerCase() === 'sid');
  }
  if (site === 'douyin') {
    return map.has('sessionid') || map.has('sessionid_ss') || map.has('sid_guard') || cookies.some(c => c.name.toLowerCase().includes('sessionid'));
  }
  if (site === 'x') {
    return map.has('auth_token') || (map.has('twid') && map.has('ct0')) || cookies.some(c => c.name.toLowerCase() === 'auth_token');
  }
  if (site === 'telegram') {
    return cookies.some(c => (c.domain && c.domain.includes('telegram')) || c.name.toLowerCase().includes('stel') || c.name.toLowerCase().includes('auth') || c.name.toLowerCase().includes('user') || c.name.toLowerCase().includes('dc')) || cookies.length > 0;
  }
  if (site === 'instagram') {
    return map.has('sessionid') || (map.has('ds_user_id') && map.has('csrftoken')) || cookies.some(c => (c.domain && c.domain.includes('instagram')) && c.name.toLowerCase().includes('session'));
  }
  if (site === 'pornhub') {
    const hasPh = cookies.some(c => c.domain && c.domain.includes('pornhub'));
    return hasPh && (cookies.length >= 2 || map.has('il') || map.has('bs') || map.has('user_id') || map.has('platform_pct') || map.has('access_token') || map.has('rn') || map.has('remember_user') || map.has('phpsessid') || map.has('has_visited') || map.has('ua'));
  }
  const authKeywords = ['token', 'auth', 'session', 'user', 'jwt', 'login', 'uid', 'stel', 'phpsessid'];
  return cookies.some(c => authKeywords.some(k => c.name.toLowerCase().includes(k))) || cookies.length >= 2;
}

ipcMain.handle('cookies:login-window', async (_, site) => {
  const siteUrlMap = {
    bilibili: 'https://passport.bilibili.com/login',
    douyin: 'https://www.douyin.com/',
    youtube: 'https://accounts.google.com/ServiceLogin?service=youtube',
    x: 'https://twitter.com/i/flow/login',
    telegram: 'https://web.telegram.org/a/',
    instagram: 'https://www.instagram.com/accounts/login/',
    pornhub: 'https://www.pornhub.com/login',
    general: 'https://www.google.com'
  };

  const targetUrl = siteUrlMap[site] || siteUrlMap.general;
  const partition = `persist:login-${site}`;

  return new Promise((resolve) => {
    const loginWin = new BrowserWindow({
      width: 500,
      height: 680,
      parent: win,
      modal: true,
      title: `快捷扫码 / 账号登录 - ${site.toUpperCase()}`,
      autoHideMenuBar: true,
      webPreferences: {
        partition,
        contextIsolation: false
      }
    });

    const ses = loginWin.webContents.session;
    let loginSuccess = false;

    // Apply active proxy configuration to the login window session
    const effectiveProxy = getEffectiveProxy(targetUrl);
    if (effectiveProxy && effectiveProxy !== 'system' && effectiveProxy !== 'direct') {
      try {
        ses.setProxy({ proxyRules: effectiveProxy }).catch(() => {});
      } catch (e) {}
    }

    const performSave = async () => {
      try {
        const cookies = await ses.cookies.get({});
        if (isPlatformLoggedIn(site, cookies) || (site === 'pornhub' && cookies.some(c => c.domain && c.domain.includes('pornhub'))) || (site === 'telegram' && cookies.length > 0)) {
          const netscapeText = convertCookiesToNetscape(cookies);
          const dir = path.join(app.getPath('userData'), 'cookies');
          fs.mkdirSync(dir, { recursive: true });
          const old = settings.cookieProfiles?.[site]?.path;
          if (old && old.startsWith(dir)) fs.rmSync(old, { force: true });
          const destination = path.join(dir, `${site}-${Date.now()}.txt`);
          fs.writeFileSync(destination, netscapeText, 'utf8');

          settings.cookieProfiles = {
            ...(settings.cookieProfiles || {}),
            [site]: { path: destination, updatedAt: Date.now() }
          };
          writeJson(settingsFile(), settings);
          loginSuccess = true;
        }
      } catch (e) {}
    };

    ses.cookies.on('changed', async () => {
      if (loginSuccess) return;
      const cookies = await ses.cookies.get({});
      if (isPlatformLoggedIn(site, cookies)) {
        loginSuccess = true;
        await performSave();
        setTimeout(() => {
          if (!loginWin.isDestroyed()) loginWin.close();
        }, 1200);
      }
    });

    loginWin.on('closed', async () => {
      try {
        const cookies = await ses.cookies.get({});
        if (isPlatformLoggedIn(site, cookies) || (site === 'pornhub' && cookies.some(c => c.domain && c.domain.includes('pornhub'))) || (site === 'telegram' && cookies.length > 0)) {
          const netscapeText = convertCookiesToNetscape(cookies);
          const dir = path.join(app.getPath('userData'), 'cookies');
          fs.mkdirSync(dir, { recursive: true });
          const old = settings.cookieProfiles?.[site]?.path;
          if (old && old.startsWith(dir)) {
            try { fs.rmSync(old, { force: true }); } catch (e) {}
          }
          const destination = path.join(dir, `${site}-${Date.now()}.txt`);
          fs.writeFileSync(destination, netscapeText, 'utf8');

          settings.cookieProfiles = {
            ...(settings.cookieProfiles || {}),
            [site]: { path: destination, updatedAt: Date.now() }
          };
          writeJson(settingsFile(), settings);
          loginSuccess = true;
        }
      } catch (e) {}

      resolve({
        success: loginSuccess,
        profiles: Object.fromEntries(Object.entries(settings.cookieProfiles || {}).map(([k, v]) => [k, { updatedAt: v.updatedAt }]))
      });
    });

    loginWin.loadURL(targetUrl, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });
  });
});

ipcMain.handle('cookies:import', (_, site, source) => { 
  if (!source || !fs.existsSync(source)) throw new Error('未找到所选 Cookie 文件'); 
  if (fs.statSync(source).size > 50 * 1024 * 1024) throw new Error('Cookie 文件过大'); 
  
  const content = fs.readFileSync(source, 'utf8').trim(); 
  let finalNetscapeText = '';

  // Case 1: JSON array format from extensions like Cookie-Editor / EditThisCookie
  if (content.startsWith('[') || content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed) ? parsed : (parsed.cookies || [parsed]);
      finalNetscapeText = convertCookiesToNetscape(list);
    } catch (e) {
      throw new Error('Cookie JSON 解析失败，格式不正确');
    }
  } 
  // Case 2: Standard Netscape format or tab-separated text
  else if (content.includes('Netscape') || content.split(/\r?\n/).some(l => l.split('\t').length >= 6)) {
    if (!content.startsWith('# Netscape')) {
      finalNetscapeText = '# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n\n' + content;
    } else {
      finalNetscapeText = content;
    }
  } 
  // Case 3: Raw cookie header string (e.g. name=value; name2=value2)
  else if (content.includes('=')) {
    const domainMap = {
      bilibili: '.bilibili.com',
      youtube: '.youtube.com',
      douyin: '.douyin.com',
      x: '.x.com',
      telegram: '.telegram.org',
      instagram: '.instagram.com',
      pornhub: '.pornhub.com',
      general: '.google.com'
    };
    const defaultDomain = domainMap[site] || '.google.com';
    const lines = [
      '# Netscape HTTP Cookie File',
      '# http://curl.haxx.se/rfc/cookie_spec.html',
      ''
    ];
    content.split(';').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (name && value) {
          lines.push([defaultDomain, 'TRUE', '/', 'TRUE', Math.floor(Date.now() / 1000 + 86400 * 365), name, value].join('\t'));
        }
      }
    });
    finalNetscapeText = lines.join('\n');
  } else {
    throw new Error('不支持的 Cookie 文件格式，请使用 Netscape cookies.txt 或 JSON 格式');
  }

  const dir = path.join(app.getPath('userData'), 'cookies'); 
  fs.mkdirSync(dir, { recursive: true }); 
  const old = settings.cookieProfiles?.[site]?.path; 
  if (old && old.startsWith(dir)) {
    try { fs.rmSync(old, { force: true }); } catch (e) {}
  }
  const destination = path.join(dir, `${site}-${Date.now()}.txt`); 
  fs.writeFileSync(destination, finalNetscapeText, 'utf8'); 
  settings.cookieProfiles = { ...(settings.cookieProfiles || {}), [site]: { path: destination, updatedAt: Date.now() } }; 
  writeJson(settingsFile(), settings); 
  return Object.fromEntries(Object.entries(settings.cookieProfiles).map(([key, value]) => [key, { updatedAt: value.updatedAt }])); 
});

ipcMain.handle('cookies:delete', (_, site) => { 
  if (!settings.cookieProfiles) settings.cookieProfiles = {}; 
  const old = settings.cookieProfiles[site]?.path; 
  if (old && fs.existsSync(old)) { try { fs.rmSync(old, { force: true }); } catch (e) {} } 
  delete settings.cookieProfiles[site]; 
  writeJson(settingsFile(), settings); 
  return Object.fromEntries(Object.entries(settings.cookieProfiles || {}).map(([key, value]) => [key, { updatedAt: value.updatedAt }])); 
});

ipcMain.handle('cookies:list', () => Object.fromEntries(Object.entries(settings.cookieProfiles || {}).map(([key, value]) => [key, { updatedAt: value.updatedAt }])));

ipcMain.handle('shell:open', (_, p) => shell.openPath(p));
ipcMain.handle('shell:show', (_, p) => shell.showItemInFolder(p));
ipcMain.handle('shell:open-external', (_, u) => shell.openExternal(u));
ipcMain.handle('tasks:list', () => [...tasks.values()].map(cleanTask));

ipcMain.handle('download:add-batch', (_, items) => { 
  const created = items.map(addTask); 
  pump(); 
  return created.map(cleanTask); 
});

ipcMain.handle('download:add', (_, item) => { 
  const t = addTask(item); 
  pump(); 
  return cleanTask(t); 
});

ipcMain.handle('download:pause', (_, id) => pauseTask(tasks.get(id)));
ipcMain.handle('download:resume', (_, id) => { 
  const t = tasks.get(id); 
  if (t) { 
    t.status = 'queued'; 
    t.paused = false; 
    t.cancelled = false; 
    t.retry = 0;
    t.error = ''; 
    emit(t, true); 
    pump(); 
  } 
});

ipcMain.handle('download:cancel', (_, id) => { 
  const t = tasks.get(id); 
  if (t) { 
    t.cancelled = true; 
    t.status = 'canceled'; 
    t.proc?.kill?.(); 
    t.requests?.forEach(r => r.destroy()); 
    if (t.fd) { try { fs.closeSync(t.fd); t.fd = null; } catch (e) {} }
    if (t.running) activeCount = Math.max(0, activeCount - 1);
    tasks.delete(id);
    persist();
    send('task:remove', id);
    pump(); 
  } 
});

ipcMain.handle('download:all', (_, action) => { 
  for (const t of tasks.values()) {
    if (action === 'pause') pauseTask(t);
    else if (t.status === 'paused') { t.status = 'queued'; t.paused = false; emit(t, true); }
  }
  pump(); 
});

ipcMain.handle('system:shutdown', () => scheduleShutdown());

function addTask(item) { 
  let url = String(item.url || '').trim(); 
  const isMagnet = url.startsWith('magnet:');
  const isTorrent = isMagnet || url.endsWith('.torrent') || item.isTorrent || item.type === 'torrent';

  if (!isMagnet) {
    const extracted = extractUrlsFromText(url);
    const candidate = extracted[0] || url;
    try { 
      url = new URL(candidate).toString(); 
    } catch { 
      throw new Error('无法解析有效的下载链接'); 
    } 
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`; 
  const isAudio = item.mode === 'audio' || item.type === 'audio';
  
  let rawName = item.name;
  if (!rawName) {
    if (isMagnet) {
      const matchDn = url.match(/dn=([^&]+)/i);
      const matchXt = url.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
      rawName = matchDn ? decodeURIComponent(matchDn[1]).replace(/\+/g, ' ') : `BT-${matchXt ? matchXt[1].slice(0, 16) : 'Magnet_Task'}`;
    } else {
      rawName = path.basename(new URL(url).pathname) || (isAudio ? 'audio_track' : 'download');
    }
  }

  const name = safeName(rawName); 
  const site = siteForUrl(url).toUpperCase();
  const isVideo = !isAudio && !isTorrent && (item.type === 'video' || item.mode === 'video' || ['YOUTUBE', 'PORNHUB', 'BILIBILI', 'DOUYIN', 'TIKTOK', 'TWITTER', 'INSTAGRAM'].includes(site));
  const cat = isTorrent ? 'archive' : (isAudio ? 'audio' : (isVideo ? 'video' : category(url, name)));

  const t = { 
    id, 
    url, 
    name, 
    customName: !!item.name,
    type: isTorrent ? 'torrent' : (isAudio ? 'audio' : (item.type || 'file')), 
    isTorrent,
    isAudioOnly: isAudio,
    isDirectStream: !!item.isDirectStream || url.includes('/progressive/'),
    quality: item.quality || 'best', 
    audioQuality: item.audioQuality || 'best', 
    downloadDanmaku: !!item.downloadDanmaku,
    selectedFileIndexes: item.selectedFileIndexes || null,
    torrentFilePath: item.torrentFilePath || null,
    category: cat, 
    status: item.startAt ? 'scheduled' : 'queued', 
    progress: 0, 
    downloaded: 0, 
    size: item.size || 0, 
    speed: 0, 
    retry: 0, 
    createdAt: Date.now(), 
    startAt: item.startAt || null, 
    autoShutdown: !!item.autoShutdown, 
    thumbnail: item.thumbnail || '',
    requests: [] 
  }; 
  tasks.set(id, t); 
  emit(t, true); 
  return t; 
}

function pauseTask(t) { 
  if (!t || !['queued','downloading','scheduled'].includes(t.status)) return; 
  const wasRunning = !!t.running; 
  t.paused = true; 
  t.status = 'paused'; 
  t.proc?.kill?.(); 
  t.requests?.forEach(r => r.destroy()); 
  if (t.fd) { try { fs.closeSync(t.fd); t.fd = null; } catch (e) {} }
  t.running = false; 
  if (wasRunning) activeCount = Math.max(0, activeCount - 1); 
  emit(t, true); 
  pump(); 
}

function pump() { 
  if (!settings) return; 
  const now = Date.now();
  for (const t of tasks.values()) {
    if (t.status === 'scheduled' && t.startAt && now >= new Date(t.startAt).getTime()) { 
      t.status = 'queued'; 
      emit(t, true); 
    } 
  }

  // Count active tasks per site for anti-ban throttling
  const siteActiveCounts = {};
  for (const t of tasks.values()) {
    if (t.running) {
      const site = siteForUrl(t.url);
      siteActiveCounts[site] = (siteActiveCounts[site] || 0) + 1;
    }
  }

  while (activeCount < settings.maxConcurrent) { 
    const queued = [...tasks.values()]
      .filter(x => x.status === 'queued' && !x.running && !x.cancelled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const t = queued.find(x => {
      const site = siteForUrl(x.url);
      // Check cooldown circuit breaker
      const cooldownUntil = domainCooldowns.get(site) || 0;
      if (now < cooldownUntil) return false;
      // Throttling for cookie-bound sites (max 2 concurrent per domain)
      if (cookieForUrl(x.url) && (siteActiveCounts[site] || 0) >= 2) return false;
      return true;
    });

    if (!t) break; 
    const site = siteForUrl(t.url);
    siteActiveCounts[site] = (siteActiveCounts[site] || 0) + 1;
    start(t); 
  } 

  // Broadcast live bandwidth speed & active counts to floating widget
  const runningTasks = [...tasks.values()].filter(t => t.running);
  const totalSpeed = runningTasks.reduce((sum, t) => sum + (t.speed || 0), 0);
  const activeTasksCount = runningTasks.length;
  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.webContents.send('floating:stats', { totalSpeed, activeCount: activeTasksCount });
  }
}
setInterval(pump, 1000);

function parseAria2Size(str) {
  if (!str) return 0;
  const match = str.match(/^([\d.]+)\s*([KMGTPEZY]?i?B?)$/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = (match[2] || '').toUpperCase();
  if (unit.startsWith('K')) return Math.round(val * 1024);
  if (unit.startsWith('M')) return Math.round(val * 1024 * 1024);
  if (unit.startsWith('G')) return Math.round(val * 1024 * 1024 * 1024);
  if (unit.startsWith('T')) return Math.round(val * 1024 * 1024 * 1024 * 1024);
  return Math.round(val);
}

function aria2Download(t) {
  const aria2 = settings.aria2Path || preferredTool('aria2c.exe', 'aria2c.exe');
  if (!fs.existsSync(aria2)) {
    return retry(t, 'aria2c BitTorrent 内核未就绪');
  }

  const subFolder = resolveCategoryFolder(t.name, 'archive') || t.category || 'BT_Downloads';
  const targetDir = path.join(settings.downloadDir, subFolder);
  fs.mkdirSync(targetDir, { recursive: true });

  const isTorrentFile = t.url.endsWith('.torrent') || (t.torrentFilePath && fs.existsSync(t.torrentFilePath));

  const args = [
    '--enable-dht=true',
    '--enable-dht6=true',
    '--bt-enable-lpd=true',
    '--enable-peer-exchange=true',
    '--bt-tracker-connect-timeout=8',
    '--bt-tracker-timeout=8',
    '--bt-max-peers=120',
    '--bt-request-peer-speed-limit=0',
    '--max-connection-per-server=16',
    '--summary-interval=1',
    '--file-allocation=none',
    '--seed-time=0',
    '--auto-file-renaming=false',
    '--allow-overwrite=true',
    '--dir', targetDir
  ];

  // Global Trackers Injection
  if (globalTrackers && globalTrackers.length > 0) {
    args.push('--bt-tracker=' + globalTrackers.slice(0, 40).join(','));
  }

  // Speed limits
  if (settings.speedLimit > 0) {
    args.push(`--max-download-limit=${settings.speedLimit}K`);
  }

  // Selected file indexes for multi-file torrents
  if (t.selectedFileIndexes && t.selectedFileIndexes.length > 0) {
    args.push(`--select-file=${t.selectedFileIndexes.join(',')}`);
  }

  // Proxy support
  const effectiveProxy = getEffectiveProxy(t.url);
  if (effectiveProxy && effectiveProxy !== 'system') {
    args.push(`--all-proxy=${effectiveProxy}`);
  }

  if (isTorrentFile && t.torrentFilePath && fs.existsSync(t.torrentFilePath)) {
    args.push(t.torrentFilePath);
  } else {
    args.push(t.url);
  }

  t.savePath = path.join(targetDir, t.name);
  t.proc = spawn(aria2, args, { windowsHide: true });
  let lastErrorMsg = '';

  const parseOutput = (data) => {
    const text = data.toString();
    for (const line of text.split(/\r?\n/)) {
      const candidate = line.trim();
      if (/\[ERROR\]/i.test(candidate)) {
        lastErrorMsg = candidate;
      }
      
      // Match resolved file name: FILE: path/to/file
      const fileMatch = candidate.match(/^FILE:\s*(.+)$/i);
      if (fileMatch) {
        const discovered = fileMatch[1].trim();
        if (discovered && !discovered.startsWith('[MEMORY]')) {
          const resolvedName = path.basename(discovered);
          if (resolvedName && (t.name.startsWith('BT-') || t.name === 'Magnet Download' || !t.customName)) {
            t.name = safeName(resolvedName);
            t.category = category(t.url, t.name);
            t.savePath = discovered;
          }
        }
      }

      // Match summary line: [#bb72b5 12MiB/500MiB(2%) CN:16 SD:1 DL:3.2MiB ETA:2m30s]
      const summaryMatch = candidate.match(/\[#\w+\s+([\d\w.]+)\/([\d\w.]+)\((\d+)%\)\s+CN:(\d+)\s+SD:(\d+)\s+DL:([\d\w.]+)/i);
      if (summaryMatch) {
        const downloadedStr = summaryMatch[1];
        const totalStr = summaryMatch[2];
        const percent = Number(summaryMatch[3]);
        const cn = Number(summaryMatch[4]);
        const sd = Number(summaryMatch[5]);
        const speedStr = summaryMatch[6];

        if (Number.isFinite(percent)) t.progress = Math.max(0, Math.min(100, percent));
        t.downloaded = parseAria2Size(downloadedStr);
        const totalBytes = parseAria2Size(totalStr);
        if (totalBytes > 0) t.size = totalBytes;
        t.speed = parseAria2Size(speedStr);
        t.peers = cn || 0;
        t.seeds = sd || 0;
      }
    }
    emit(t);
  };

  t.proc.stdout.on('data', parseOutput);
  t.proc.stderr.on('data', parseOutput);

  t.proc.on('error', e => finish(t, 'failed', `aria2c 执行异常: ${e.message}`));
  t.proc.on('close', code => {
    if (t.cancelled || t.paused) return;
    if (code === 0) {
      t.progress = 100;
      if (t.size && !t.downloaded) t.downloaded = t.size;
      if (fs.existsSync(targetDir)) {
        const files = fs.readdirSync(targetDir);
        if (files.length > 0) {
          const target = files.find(f => f === t.name || f.toLowerCase().includes(t.name.toLowerCase().slice(0, 8)));
          if (target) t.savePath = path.join(targetDir, target);
        }
      }
      finish(t, 'completed');
    } else {
      retry(t, lastErrorMsg || `aria2c 退出码: ${code}`);
    }
  });
}

function start(t) { 
  t.running = true; 
  t.status = 'downloading'; 
  activeCount++; 
  const subFolder = resolveCategoryFolder(t.name, t.type || (t.isAudioOnly ? 'audio' : 'video')) || t.category || 'other';
  const dir = path.join(settings.downloadDir, subFolder); 
  fs.mkdirSync(dir, { recursive: true }); 
  t.savePath = path.join(dir, t.name); 
  emit(t, true); 

  // Pre-download Disk Space Safety Pre-check
  try {
    if (fs.statfsSync) {
      const stats = fs.statfsSync(dir);
      const freeBytes = stats.bavail * stats.bsize;
      if (t.size > 0 && freeBytes > 0 && freeBytes < t.size) {
        showNotification('⚠️ 磁盘空间不足预警', `目标磁盘剩余仅 ${formatBytes(freeBytes)}，无法容纳 ${formatBytes(t.size)}，请及时清理空间！`);
      }
    }
  } catch (e) {} 
  
  // 1. BitTorrent & Magnet Links (Engine: aria2c)
  if (t.url.startsWith('magnet:') || t.isTorrent || t.url.endsWith('.torrent') || t.type === 'torrent') {
    return aria2Download(t);
  }

  // 2. Video / Audio Streams / yt-dlp
  if (!t.isDirectStream && !t.url.includes('/progressive/') && (t.type === 'audio' || t.isAudioOnly || t.type === 'video' || /\.m3u8(?:$|[?#])|youtube|youtu\.be|bilibili|douyin|twitter|x\.com|twimg\.com|pornhub/i.test(t.url))) {
    return ytDlp(t); 
  }

  // 3. HTTP / HTTPS Sparse File Engine
  httpDownload(t); 
}

function finish(t, status, error = '') { 
  if (!t.running && status !== 'completed') return; 
  t.running = false; 
  activeCount = Math.max(0, activeCount - 1); 
  t.status = status; 
  t.error = error; 
  t.speed = 0; 
  if (t.fd) { try { fs.closeSync(t.fd); t.fd = null; } catch (e) {} }
  emit(t, true); 

  if (status === 'completed') {
    showNotification('下载完成', `${t.name} 已保存完毕`, t.savePath);
    if (t.autoShutdown && ![...tasks.values()].some(x => ['queued','downloading','scheduled'].includes(x.status))) {
      scheduleShutdown(); 
    }
  } else if (status === 'failed') {
    showNotification('下载失败', `${t.name}: ${error || '未知错误'}`);
  }

  pump(); 
}

function retry(t, error) { 
  if (t.retry < settings.retryCount && !t.paused && !t.cancelled) { 
    t.retry++; 
    t.status = 'queued'; 
    t.error = `重试中 (${t.retry}/${settings.retryCount}): ${error}`; 
    t.running = false; 
    activeCount = Math.max(0, activeCount - 1); 
    if (t.fd) { try { fs.closeSync(t.fd); t.fd = null; } catch (e) {} }
    emit(t, true); 
    setTimeout(pump, 1500 * t.retry); 
  } else {
    finish(t, 'failed', error); 
  }
}

function xmlDanmakuToAss(xmlContent, title = 'Danmaku Subtitles') {
  const header = `[Script Info]
Title: ${title.replace(/\r?\n/g, ' ')}
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1920
PlayResY: 1080
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: DanmakuScroll, Microsoft YaHei, 40, &H00FFFFFF, &H00000000, &H00000000, &H80000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 1.8, 0, 2, 20, 20, 20, 1
Style: DanmakuTop, Microsoft YaHei, 40, &H00FFFFFF, &H00000000, &H00000000, &H80000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 1.8, 0, 8, 20, 20, 40, 1
Style: DanmakuBottom, Microsoft YaHei, 40, &H00FFFFFF, &H00000000, &H00000000, &H80000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 1.8, 0, 2, 20, 20, 40, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  function formatAssTime(seconds) {
    const s = Math.max(0, seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  function decToAssColor(dec) {
    const hex = (Number(dec) || 16777215).toString(16).padStart(6, '0');
    const r = hex.slice(0, 2);
    const g = hex.slice(2, 4);
    const b = hex.slice(4, 6);
    return `&H00${b}${g}${r}&`.toUpperCase();
  }

  const events = [];
  const regex = /<d\s+p="([^"]+)">([^<]*)<\/d>/gi;
  let match;
  let scrollIdx = 0;

  while ((match = regex.exec(xmlContent)) !== null) {
    const pStr = match[1];
    const rawText = match[2] ? match[2].trim() : '';
    if (!rawText) continue;

    const parts = pStr.split(',');
    const time = parseFloat(parts[0]) || 0;
    const mode = parseInt(parts[1], 10) || 1;
    const colorDec = parseInt(parts[3], 10) || 16777215;
    const assColor = decToAssColor(colorDec);

    const safeText = rawText.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');

    if (mode === 4) {
      const start = formatAssTime(time);
      const end = formatAssTime(time + 4.0);
      events.push(`Dialogue: 0,${start},${end},DanmakuBottom,,0,0,0,,{\\c${assColor}}${safeText}`);
    } else if (mode === 5) {
      const start = formatAssTime(time);
      const end = formatAssTime(time + 4.0);
      events.push(`Dialogue: 0,${start},${end},DanmakuTop,,0,0,0,,{\\c${assColor}}${safeText}`);
    } else {
      const start = formatAssTime(time);
      const end = formatAssTime(time + 7.5);
      const lane = (scrollIdx++) % 14;
      const y = 60 + lane * 48;
      events.push(`Dialogue: 0,${start},${end},DanmakuScroll,,0,0,0,,{\\move(1940,${y},-500,${y})\\c${assColor}}${safeText}`);
    }
  }

  return header + events.join('\n');
}

function attachVideoInfo(t, printedPath, cleanup = true) { 
  const finalPath = printedPath && fs.existsSync(printedPath) ? printedPath : ''; 
  if (finalPath) { 
    t.savePath = finalPath; 
    t.name = path.basename(finalPath); 
    t.category = t.isAudioOnly ? 'audio' : 'video'; 
    try { 
      t.size = fs.statSync(finalPath).size; 
      t.downloaded = t.size; 
    } catch {} 
  } 
  const folder = path.dirname(t.savePath || path.join(settings.downloadDir, t.category)); 
  const stem = finalPath ? path.basename(finalPath).replace(/\.[^.]+$/, '') : ''; 

  // Danmaku XML to ASS Subtitle Auto-Conversion
  if (folder && fs.existsSync(folder)) {
    try {
      const xmlFiles = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith('.xml') && (!stem || f.includes(stem)));
      for (const xf of xmlFiles) {
        const fullXml = path.join(folder, xf);
        const xmlContent = fs.readFileSync(fullXml, 'utf8');
        if (xmlContent.includes('<d p=')) {
          const assContent = xmlDanmakuToAss(xmlContent, t.name);
          const targetAss = finalPath ? finalPath.replace(/\.[^.]+$/, '.ass') : path.join(folder, `${path.basename(xf, '.xml')}.ass`);
          fs.writeFileSync(targetAss, assContent, 'utf8');
        }
      }
    } catch (e) {}
  }

  const candidates = fs.existsSync(folder) ? fs.readdirSync(folder).filter(name => { 
    const ext = path.extname(name).toLowerCase(); 
    return ['.jpg','.jpeg','.png','.webp'].includes(ext) && (!stem || path.basename(name, ext) === stem); 
  }).map(name => path.join(folder, name)) : []; 

  const thumb = candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]; 
  if (thumb) { 
    try { 
      const ext = path.extname(thumb).toLowerCase(); 
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'; 
      const data = fs.readFileSync(thumb); 
      if (data.length <= 1024 * 1024) t.thumbnail = `data:${mime};base64,${data.toString('base64')}`; 
      if (cleanup) fs.rmSync(thumb, { force: true }); 
    } catch {} 
  } 
}

function ytDlp(t) { 
  const isAudio = t.type === 'audio' || t.isAudioOnly;
  const site = siteForUrl(t.url).toUpperCase();
  
  // Custom naming & folder pattern
  let folderPattern = settings.folderPattern || '{category}';
  let targetFolder = folderPattern
    .replace(/\{category\}/gi, isAudio ? 'audio' : 'video')
    .replace(/\{platform\}/gi, site);

  const targetDir = path.join(settings.downloadDir, targetFolder);
  fs.mkdirSync(targetDir, { recursive: true });

  let namePattern = settings.namingPattern || '{title}';
  let outputTemplate = namePattern
    .replace(/\{title\}/gi, '%(title)s')
    .replace(/\{uploader\}/gi, '%(uploader)s')
    .replace(/\{platform\}/gi, site)
    .replace(/\{date\}/gi, '%(upload_date)s')
    .replace(/\{index\}/gi, '%(playlist_index)s');

  if (!outputTemplate.includes('%(')) outputTemplate = '%(title)s';
  const output = path.join(targetDir, `${outputTemplate}.%(ext)s`);

  const args = [
    '--newline', 
    '--no-color', 
    '--no-playlist', 
    '--concurrent-fragments', '5',
    '--embed-metadata',
    '--print', 'after_move:filepath', 
    '--progress-template', 'download:%(progress._percent_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s'
  ];

  // Anti-Ban Sleep Jitter
  if (settings.antiBanJitter !== false) {
    args.push('--sleep-requests', '1.5', '--sleep-interval', '2', '--max-sleep-interval', '5');
  }

  // Proxy Configuration
  const effectiveProxy = getEffectiveProxy(t.url);
  if (effectiveProxy && effectiveProxy !== 'system') {
    args.push('--proxy', effectiveProxy);
  }

  const jsRuntime = getJsRuntimeArg();
  if (jsRuntime) args.push('--js-runtimes', jsRuntime);

  const cookies = t.disableCookie ? '' : cookieForUrl(t.url);
  if (cookies) {
    args.push('--cookies', cookies);
  } else if (site === 'YOUTUBE') {
    args.push('--extractor-args', 'youtube:player_client=android,web');
  }

  // Subtitles and Danmaku
  if (settings.downloadDanmaku || t.downloadDanmaku) {
    args.push('--write-subs', '--write-auto-subs', '--sub-langs', 'all,-live_chat');
  }

  if (isAudio) {
    const abr = ['320','256','192','128'].includes(String(t.audioQuality)) ? t.audioQuality : '320';
    args.push(
      '-x', 
      '--audio-format', 'mp3', 
      '--audio-quality', `${abr}k`, 
      '--embed-metadata'
    );
  } else {
    const height = ['2160','1440','1080','720','480'].includes(String(t.quality)) ? `[height<=${t.quality}]` : ''; 
    const abr = ['320','256','192','128'].includes(String(t.audioQuality)) ? `[abr<=${t.audioQuality}]` : ''; 
    const format = `bestvideo${height}+bestaudio${abr}/best${height}/best`; 
    args.push(
      '-f', format, 
      '--merge-output-format', 'mp4', 
      '--embed-metadata',
      '--no-abort-on-error'
    );
  }

  if (settings.ffmpegPath) args.push('--ffmpeg-location', settings.ffmpegPath); 
  args.push('-o', output);
  args.push(t.url); 

  t.cookieSite = siteForUrl(t.url); 
  t.proc = spawn(settings.ytDlpPath, args, { windowsHide: true }); 
  let printedPath = ''; 
  let lastErrorMsg = '';

  const parse = b => { 
    const text = b.toString(); 
    for (const line of text.split(/\r?\n/)) { 
      const candidate = line.trim(); 
      if (/^ERROR:/i.test(candidate)) {
        lastErrorMsg = candidate.replace(/^ERROR:\s*/i, '');
      }
      if (candidate && fs.existsSync(candidate)) printedPath = candidate; 
      const fields = candidate.split('|'); 
      if (fields.length >= 5 && /%/.test(fields[0])) { 
        const percent = Number(fields[0].replace(/[^0-9.]/g, '')); 
        if (Number.isFinite(percent)) t.progress = Math.max(0, Math.min(100, percent)); 
        const downloaded = Number(fields[1]); 
        const total = Number(fields[2]) || Number(fields[3]); 
        const speed = Number(fields[4]); 
        if (Number.isFinite(downloaded) && downloaded > 0) t.downloaded = downloaded; 
        if (Number.isFinite(total) && total > 0) t.size = total; 
        if (Number.isFinite(speed) && speed > 0) t.speed = speed; 
      } 
    } 
    if (!t.progress) { 
      const matches = [...text.matchAll(/(\d+(?:\.\d+)?)%/g)]; 
      const last = matches.at(-1); 
      if (last) t.progress = Math.max(0, Math.min(100, Number(last[1]))); 
    } 
    if (!t.thumbnail) attachVideoInfo(t, '', false); 
    emit(t); 
  }; 

  t.proc.stdout.on('data', parse); 
  t.proc.stderr.on('data', parse); 
  t.proc.on('error', e => finish(t, 'failed', `yt-dlp unavailable: ${e.message}`)); 
  t.proc.on('close', code => { 
    if (t.cancelled || t.paused) return; 
    if (code === 0) { 
      attachVideoInfo(t, printedPath, true); 
      t.progress = 100; 
      if (t.size && !t.downloaded) t.downloaded = t.size; 
      finish(t, 'completed'); 
    } else {
      // 429/412 Circuit Breaker Trigger
      if (/429|412|Too Many Requests|Precondition Failed/i.test(lastErrorMsg)) {
        const site = siteForUrl(t.url);
        domainCooldowns.set(site, Date.now() + 60000);
        showNotification('已触发站点风控保护', `${site.toUpperCase()} 请求过多，已自动进入 60 秒安全冷却以保护账号`);
      }
      const err = lastErrorMsg ? `${cookies ? '[Cookie已附加] ' : ''}${lastErrorMsg}` : `${cookies ? 'Cookie 或 ' : ''}yt-dlp 退出码: ${code}`;
      retry(t, err); 
    }
  }); 
}

function parseFilenameFromHeader(res, url, fallback) {
  const cd = res.headers['content-disposition'] || '';
  if (cd) {
    const utf8Match = cd.match(/filename\*=(?:UTF-8|utf-8)''([^;]+)/i);
    if (utf8Match) {
      try { return safeName(decodeURIComponent(utf8Match[1])); } catch (e) {}
    }
    const normalMatch = cd.match(/filename="?([^";]+)"?/i);
    if (normalMatch) {
      try { return safeName(Buffer.from(normalMatch[1], 'binary').toString('utf8')); } catch (e) { return safeName(normalMatch[1]); }
    }
  }
  try {
    const p = new URL(url).pathname;
    const base = path.basename(p);
    if (base && base !== '/' && base !== '.') return safeName(base);
  } catch (e) {}
  return safeName(fallback);
}

function request(url, options, cb, onError) { 
  try {
    const u = new URL(url); 
    const effectiveProxy = getEffectiveProxy(url);
    const agent = createProxyAgent(effectiveProxy);
    const cookieStr = getCookieHeaderForUrl(url);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
      'Accept': '*/*',
      'Referer': 'https://web.telegram.org/',
      ...(cookieStr ? { 'Cookie': cookieStr } : {}),
      ...(options.headers || {})
    };

    const client = u.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      ...options,
      agent,
      headers
    }, cb); 
    req.on('error', e => onError ? onError(e) : undefined); 
    req.end(); 
    return req; 
  } catch (err) {
    if (onError) onError(err);
  }
}

function httpDownload(t) { 
  const part = `${t.savePath}.part`; 
  const meta = `${part}.json`; 
  const existing = readJson(meta, { segments: [] }); 

  request(t.url, { method: 'GET', headers: { Range: 'bytes=0-0' } }, res => { 
    const realName = parseFilenameFromHeader(res, t.url, t.name);
    if (realName && realName !== t.name && !t.customName) {
      t.name = realName;
      t.category = category(t.url, t.name);
      const dir = path.join(settings.downloadDir, t.category);
      fs.mkdirSync(dir, { recursive: true });
      t.savePath = path.join(dir, t.name);
    }

    const rangeHeader = res.headers['content-range'] || '';
    let size = 0;
    if (rangeHeader) {
      const match = rangeHeader.match(/\/(\d+)/);
      if (match) size = Number(match[1]);
    }
    if (!size) size = Number(res.headers['content-length'] || 0);

    const supports = res.statusCode === 206 || (res.headers['accept-ranges'] === 'bytes' && size > 0); 
    if (!size || !supports) return singleStream(t, part); 

    t.size = size; 
    const count = Math.min(settings.segments || 8, Math.max(1, Math.floor(size / (1024 * 1024)))); 
    t.segments = Array.from({ length: count }, (_, i) => ({ 
      start: Math.floor(i * size / count), 
      end: Math.floor((i + 1) * size / count) - 1, 
      done: existing.segments?.[i]?.done || 0 
    })); 

    writeJson(meta, { segments: t.segments }); 
    runSparseSegments(t, part, meta); 
  }, e => retry(t, e.message)); 
}

function runSparseSegments(t, part, meta) {
  t.requests = [];
  let fd;
  try {
    fd = fs.openSync(part, fs.existsSync(part) ? 'r+' : 'w');
    t.fd = fd;
  } catch (err) {
    return retry(t, `目标文件句柄初始化失败: ${err.message}`);
  }

  let activeStreams = 0;
  const checkDone = () => {
    if (activeStreams === 0 && t.downloaded >= t.size && !t.cancelled && !t.paused) {
      try { fs.closeSync(fd); t.fd = null; } catch (e) {}
      try {
        if (fs.existsSync(t.savePath)) fs.rmSync(t.savePath, { force: true });
        fs.renameSync(part, t.savePath);
        fs.rmSync(meta, { force: true });
      } catch (e) {}
      t.progress = 100;
      finish(t, 'completed');
    }
  };

  t.segments.forEach((s) => {
    const totalSeg = s.end - s.start + 1;
    if (s.done >= totalSeg) return;
    activeStreams++;

    const req = request(t.url, { headers: { Range: `bytes=${s.start + s.done}-${s.end}` } }, res => {
      if (res.statusCode !== 206 && res.statusCode !== 200) {
        activeStreams--;
        return retry(t, `HTTP 响应状态码异常: ${res.statusCode}`);
      }

      let writeOffset = s.start + s.done;
      let lastTime = Date.now();
      let lastBytes = 0;

      res.on('data', chunk => {
        if (t.paused || t.cancelled) return;
        try {
          fs.writeSync(fd, chunk, 0, chunk.length, writeOffset);
          writeOffset += chunk.length;
          s.done += chunk.length;
          lastBytes += chunk.length;

          const now = Date.now();
          if (now - lastTime >= 500) {
            t.speed = (lastBytes / (now - lastTime)) * 1000;
            lastTime = now;
            lastBytes = 0;
          }

          t.downloaded = t.segments.reduce((a, x) => a + x.done, 0);
          t.progress = t.size ? (t.downloaded / t.size) * 100 : 0;
          emit(t);
        } catch (e) {
          retry(t, e.message);
        }
      });

      res.on('end', () => {
        activeStreams--;
        writeJson(meta, { segments: t.segments });
        checkDone();
      });

      res.on('error', e => {
        activeStreams--;
        retry(t, e.message);
      });
    }, e => {
      activeStreams--;
      retry(t, e.message);
    });

    t.requests.push(req);
  });

  if (activeStreams === 0) checkDone();
}

function singleStream(t, part) { 
  const existing = fs.existsSync(part) ? fs.statSync(part).size : 0; 
  let received = 0; 
  request(t.url, { headers: existing ? { Range: `bytes=${existing}-` } : {} }, res => { 
    if (res.statusCode >= 400) return retry(t, `HTTP ${res.statusCode}`); 
    const append = existing > 0 && res.statusCode === 206; 
    const base = append ? existing : 0; 
    const total = Number(res.headers['content-length'] || 0) + base; 
    const out = fs.createWriteStream(part, { flags: append ? 'a' : 'w' }); 
    if (!append) t.downloaded = 0; 
    const started = Date.now(); 

    res.on('data', c => { 
      out.write(c); 
      received += c.length; 
      t.downloaded = base + received; 
      t.size = total; 
      t.progress = total ? t.downloaded / total * 100 : 0; 
      t.speed = received / Math.max(1, (Date.now() - started) / 1000); 
      emit(t); 
    }); 

    res.on('end', () => { 
      out.end(); 
      try {
        if (fs.existsSync(t.savePath)) fs.rmSync(t.savePath, { force: true });
        fs.renameSync(part, t.savePath); 
      } catch (e) {} 
      t.progress = 100; 
      finish(t, 'completed'); 
    }); 
    res.on('error', e => retry(t, e.message)); 
  }, e => retry(t, e.message)); 
}
