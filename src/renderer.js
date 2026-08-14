// Universal Downloader - Liquid Glass UI Architecture & Engine Bridge
let currentFilter = 'all';
let isDarkTheme = localStorage.getItem('theme') !== 'light';
let currentLang = localStorage.getItem('language') || 'zh';
let currentMode = 'video'; // video | audio | file
let currentSniffData = null;
let currentPlaylistData = null;
let sniffDebounceTimer = null;
let currentHashData = null;
let currentProxyMode = 'direct';
let selectedScheduleTime = null; // null = now
let selectedTaskIds = new Set();
let lastCheckedTaskId = null;
let currentRefreshTaskId = null;

let tasks = [];
let settings = {};
let cookieProfiles = {};
let sniffedStreamRecords = [];
const nativeApi = window.downloader;

// ==========================================================================
// 🎵 Synthetic Crystal Micro-Audio System (Pure Web Audio, Zero Dependencies)
// ==========================================================================
function playSound(type) {
  if (settings?.soundEffects === false) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.14);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    } else if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'delete') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.1);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch (e) {}
}

// Complete Bilingual Dictionary (Chinese & English)
const i18nDict = {
  zh: {
    allTasks: '全部任务',
    downloading: '正在下载',
    completed: '已完成',
    paused: '已暂停',
    failed: '下载失败',
    settings: '偏好设置',
    supported: '全格式切片加速 · 智能流媒体提取',
    subtitle: '多线程分片加速、视频嗅探与断点续传下载器',
    pauseAll: '全部暂停',
    newDownload: '新建下载任务',
    heroTitle: '粘贴下载链接，<br><strong>剩下的交给全能内核。</strong>',
    heroBody: '支持 HTTP/HTTPS 零耗时随机写分片、剪贴板自动嗅探、视频智能预解析与纯音频 MP3 提取。',
    search: '搜索任务名称或链接...',
    emptyTitle: '还没有下载任务',
    emptyBody: '点击右上角或下方按钮新建下载，体验极致液态玻璃下载流。',
    addDownloads: '添加下载任务',
    urlHelp: '支持单行或批量多行链接。输入单个视频链接自动开启智能解析。',
    nameOptional: '自定义任务名称（可选）',
    cancel: '取消',
    start: '立即开始',
    downloadSettings: '设置与凭据中心',
    downloadFolder: '默认下载目录',
    browse: '浏览选择',
    concurrent: '最大同时并发下载任务',
    segments: '单文件 HTTP 分片连接数',
    speedLimit: '下载限速 KB/s (0 表示不限速)',
    retries: '失败自动重试次数',
    autoShutdown: '所有下载任务完成后自动关闭 Windows 计算机',
    save: '保存并应用',
    activeTasks: '活动任务',
    activeHint: '正在并发传输',
    completedTasks: '已完成',
    completedHint: '传输成功完成',
    engineStatus: '下载内核',
    kernelTitle: '下载内核健康状态',
    kernelBody: '实时验证本地下载分片引擎、yt-dlp 与 FFmpeg 运行库可用性。',
    checkTools: '立即运行诊断',
    themeDark: '深色',
    themeLight: '浅色',
    queued: '等待队列中',
    statusDownloading: '高速下载中',
    statusCompleted: '下载完成',
    statusPaused: '已暂停',
    statusFailed: '下载失败',
    statusCanceled: '已取消',
    statusScheduled: '计划执行',
    resume: '继续',
    pause: '暂停',
    show: '定位文件',
    remove: '删除任务',
    retry: '重试',
    videoQuality: '视频分辨率',
    audioQuality: '音频音质 / 码率',
    cookieReady: '已就绪',
    cookieNone: '未配置',
    cookieUpdated: '更新于',
    cookieImportSuccess: 'Cookie 凭据导入成功',
    cookieDeleteSuccess: 'Cookie 凭据已清除',
    bubbleTitle: '✨ 捕获到媒体链接',
    bubbleDownloadVideo: '🎬 智能透析下载',
    bubbleDownloadAudio: '🎵 提取MP3',
    bubbleVideoCreated: '🚀 已通过微胶囊创建视频下载任务！',
    bubbleAudioCreated: '🎵 已通过微胶囊创建纯音频 MP3 提取任务！',
    clearCompletedBtn: '🧹 清空已完成',
    mobileCastBtn: '📱 手机扫码',
    batchPauseBtn: '⏸️ 批量暂停',
    batchResumeBtn: '▶️ 批量继续',
    batchDeleteBtn: '🗑️ 批量移除',
    previewBtn: '预览',
    trimBtn: '✂️ 截取',
    checkHashBtn: '校验',
    prioritizeBtn: '⬆️ 置顶',
    refreshUrlBtn: '🔄 换链',
    liveSpeedLabel: '实时下载速率',
    sortByCreated: '按创建时间',
    sortByProgress: '按下载进度',
    sortByName: '按任务名称',
    openWebSnifferBtn: '⚡ 网页透视嗅探',
    openTorrentBtn: '🧲 磁力/种子',
    exportExtensionBtn: '📦 导出扩展程序',
    openExtensionGuideBtn: '🧭 安装指南'
  },
  en: {
    allTasks: 'All Tasks',
    downloading: 'Downloading',
    completed: 'Completed',
    paused: 'Paused',
    failed: 'Failed',
    settings: 'Preferences',
    supported: 'Sparse-file Acceleration · Smart Stream Extraction',
    subtitle: 'High-speed segmented transfers, video parsing & resumable downloads',
    pauseAll: 'Pause All',
    newDownload: 'New Download',
    heroTitle: 'Paste a link.<br><strong>We handle the rest.</strong>',
    heroBody: 'Zero-merge sparse file transfers, clipboard sniffer, smart video pre-parse and audio MP3 extraction.',
    search: 'Search task name or URL...',
    emptyTitle: 'No downloads yet',
    emptyBody: 'Paste links to start your first liquid accelerated download.',
    addDownloads: 'Add Downloads',
    urlHelp: 'Supports single or batch URLs. Paste single video URL for smart pre-parsing.',
    nameOptional: 'Custom Task Name (optional)',
    cancel: 'Cancel',
    start: 'Start Now',
    downloadSettings: 'Preferences & Credentials',
    downloadFolder: 'Default Download Folder',
    browse: 'Browse',
    concurrent: 'Max Concurrent Tasks',
    segments: 'HTTP Segment Connections',
    speedLimit: 'Speed Limit KB/s (0 = Unlimited)',
    retries: 'Auto Retry Count',
    autoShutdown: 'Shut down Windows after all tasks complete',
    save: 'Save & Apply',
    activeTasks: 'ACTIVE TASKS',
    activeHint: 'Currently transferring',
    completedTasks: 'COMPLETED',
    completedHint: 'Successfully finished',
    engineStatus: 'DOWNLOAD ENGINE',
    kernelTitle: 'Engine Diagnostics',
    kernelBody: 'Verify local download engine, yt-dlp and FFmpeg availability.',
    checkTools: 'Run Diagnostics',
    themeDark: 'Dark',
    themeLight: 'Light',
    queued: 'Queued',
    statusDownloading: 'Downloading',
    statusCompleted: 'Completed',
    statusPaused: 'Paused',
    statusFailed: 'Failed',
    statusCanceled: 'Canceled',
    statusScheduled: 'Scheduled',
    resume: 'Resume',
    pause: 'Pause',
    show: 'Locate File',
    remove: 'Delete',
    retry: 'Retry',
    videoQuality: 'Video Quality',
    audioQuality: 'Audio Bitrate',
    cookieReady: 'Ready',
    cookieNone: 'Not configured',
    cookieUpdated: 'Updated on',
    cookieImportSuccess: 'Cookie profile imported successfully',
    cookieDeleteSuccess: 'Cookie profile removed',
    bubbleTitle: '✨ Media Link Detected',
    bubbleDownloadVideo: '🎬 Inspect & Download',
    bubbleDownloadAudio: '🎵 Extract MP3',
    bubbleVideoCreated: '🚀 Video download started via capsule!',
    bubbleAudioCreated: '🎵 MP3 audio extraction started via capsule!',
    clearCompletedBtn: '🧹 Clear Done',
    mobileCastBtn: '📱 Mobile Cast',
    batchPauseBtn: '⏸️ Pause Selected',
    batchResumeBtn: '▶️ Resume Selected',
    batchDeleteBtn: '🗑️ Delete Selected',
    previewBtn: 'Preview',
    trimBtn: '✂️ Trim',
    checkHashBtn: 'Verify',
    prioritizeBtn: '⬆️ Top',
    refreshUrlBtn: '🔄 Renew',
    liveSpeedLabel: 'REAL-TIME SPEED',
    sortByCreated: 'Sort by Time',
    sortByProgress: 'Sort by Progress',
    sortByName: 'Sort by Name',
    openWebSnifferBtn: '⚡ Web Sniffer',
    openTorrentBtn: '🧲 Torrent/Magnet',
    exportExtensionBtn: '📦 Export Extension',
    openExtensionGuideBtn: '🧭 Install Guide'
  }
};

function t(key) {
  return i18nDict[currentLang]?.[key] || i18nDict.zh[key] || key;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let num = bytes;
  while (num >= 1024 && i < units.length - 1) {
    num /= 1024;
    i++;
  }
  return `${num.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const date = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${month}-${date} ${hours}:${minutes}`;
}

function showToast(msg) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2800);
}

function applyTheme() {
  document.body.classList.toggle('dark', isDarkTheme);
  const themeText = document.getElementById('themeText');
  if (themeText) themeText.textContent = isDarkTheme ? t('themeLight') : t('themeDark');
}

function applyLanguage() {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = t(key);
    } else {
      el.innerHTML = t(key);
    }
  });

  document.querySelectorAll('[data-i18n-text]').forEach(el => {
    el.textContent = t(el.dataset.i18nText);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  const langSelect = document.getElementById('language');
  if (langSelect) langSelect.value = currentLang;

  const vQualityLabel = document.querySelector('[data-quality-label="video"]');
  const aQualityLabel = document.querySelector('[data-quality-label="audio"]');
  if (vQualityLabel) vQualityLabel.textContent = t('videoQuality');
  if (aQualityLabel) aQualityLabel.textContent = t('audioQuality');

  const bubbleTitle = document.getElementById('bubbleTitle');
  const bubbleDownloadVideo = document.getElementById('bubbleDownloadVideo');
  const bubbleDownloadAudio = document.getElementById('bubbleDownloadAudio');
  if (bubbleTitle) bubbleTitle.textContent = t('bubbleTitle');
  if (bubbleDownloadVideo) bubbleDownloadVideo.textContent = t('bubbleDownloadVideo');
  if (bubbleDownloadAudio) bubbleDownloadAudio.textContent = t('bubbleDownloadAudio');

  const clearCompletedBtn = document.getElementById('clearCompletedBtn');
  if (clearCompletedBtn) clearCompletedBtn.textContent = t('clearCompletedBtn');

  const mobileCastBtn = document.getElementById('mobileCastBtn');
  if (mobileCastBtn) mobileCastBtn.textContent = t('mobileCastBtn');

  const batchPauseBtn = document.getElementById('batchPauseBtn');
  const batchResumeBtn = document.getElementById('batchResumeBtn');
  if (batchPauseBtn) batchPauseBtn.textContent = t('batchPauseBtn');
  if (batchResumeBtn) batchResumeBtn.textContent = t('batchResumeBtn');
  if (batchDeleteBtn) batchDeleteBtn.textContent = t('batchDeleteBtn');

  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) {
    const titlesMap = {
      all: 'allTasks',
      downloading: 'downloading',
      completed: 'completed',
      paused: 'paused',
      failed: 'failed',
      'channel-torrent': currentLang === 'zh' ? '🧲 磁力/BT种子专区' : '🧲 Magnet & BT Channel',
      'channel-sniffer': currentLang === 'zh' ? '⚡ 网页透视流专区' : '⚡ Web Sniffer Streams',
      'channel-video': currentLang === 'zh' ? '🎬 网页视频解析专区' : '🎬 Web Video Channel',
      'channel-audio': currentLang === 'zh' ? '🎵 纯音频提取专区' : '🎵 Audio Extractor Channel',
      'channel-file': currentLang === 'zh' ? '📦 通用文件直链专区' : '📦 Direct File Channel'
    };
    const titleVal = titlesMap[currentFilter] || 'allTasks';
    pageTitle.innerHTML = titleVal.startsWith('channel') || titleVal.includes('专区') || titleVal.includes('Channel') || titleVal.includes('Streams') ? titleVal : t(titleVal);
  }

  const sortSelect = document.getElementById('sort');
  if (sortSelect && sortSelect.options && sortSelect.options.length >= 3) {
    sortSelect.options[0].textContent = t('sortByCreated');
    sortSelect.options[1].textContent = t('sortByProgress');
    sortSelect.options[2].textContent = t('sortByName');
  }

  applyTheme();
  renderTasks();
}

function renderTasks() {
  const taskListEl = document.getElementById('taskList');
  const emptyEl = document.getElementById('empty');
  const searchInput = document.getElementById('search');
  const sortSelect = document.getElementById('sort');

  const query = (searchInput?.value || '').toLowerCase().trim();
  const sortMode = sortSelect?.value || 'new';

  let filtered = tasks.filter(task => {
    let matchesFilter = true;
    if (currentFilter === 'all') matchesFilter = true;
    else if (currentFilter === 'downloading' || currentFilter === 'completed' || currentFilter === 'paused' || currentFilter === 'failed') {
      matchesFilter = task.status === currentFilter;
    } else if (currentFilter === 'channel-torrent') {
      matchesFilter = task.url?.startsWith('magnet:') || task.isTorrent || task.url?.endsWith('.torrent');
    } else if (currentFilter === 'channel-sniffer') {
      matchesFilter = task.isDirectStream || task.url?.includes('.m3u8') || task.url?.includes('.mpd') || task.url?.includes('/progressive/');
    } else if (currentFilter === 'channel-video') {
      matchesFilter = (task.category === 'video' || task.type === 'video') && !task.isDirectStream && !task.url?.startsWith('magnet:') && !task.url?.endsWith('.torrent');
    } else if (currentFilter === 'channel-audio') {
      matchesFilter = task.category === 'audio' || task.isAudioOnly || task.type === 'audio';
    } else if (currentFilter === 'channel-file') {
      matchesFilter = (task.category === 'archive' || task.category === 'document' || task.category === 'other' || task.type === 'file') && !task.url?.startsWith('magnet:') && !task.url?.endsWith('.torrent') && !task.isDirectStream;
    }

    const matchesQuery = !query || 
      String(task.name || '').toLowerCase().includes(query) ||
      String(task.url || '').toLowerCase().includes(query);
    return matchesFilter && matchesQuery;
  });

  filtered.sort((a, b) => {
    if (sortMode === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
    if (sortMode === 'progress') return (b.progress || 0) - (a.progress || 0);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  if (taskListEl) {
    taskListEl.innerHTML = filtered.map(task => {
      const isVideo = task.category === 'video';
      const isAudio = task.category === 'audio';
      const thumbContent = task.thumbnail 
        ? `<img class="thumb" src="${task.thumbnail}" alt="">` 
        : `<div class="icon">${isVideo ? 'V' : isAudio ? 'A' : 'D'}</div>`;

      const statusKey = {
        queued: 'queued',
        downloading: 'statusDownloading',
        completed: 'statusCompleted',
        paused: 'statusPaused',
        failed: 'statusFailed',
        canceled: 'statusCanceled',
        scheduled: 'statusScheduled'
      }[task.status] || task.status;
      
      const statusLabel = task.status === 'scheduled' && task.startAt
        ? `⏰ 计划于 ${formatDate(task.startAt)} 启动`
        : (t(statusKey) + (task.error ? ` · ${escapeHtml(task.error).slice(0, 30)}` : ''));

      const speedStr = typeof task.speed === 'number' && task.speed > 0
        ? `${formatBytes(task.speed)}/s`
        : (task.speed || '-');

      let actionBtn = '';
      if (task.status === 'completed') {
        const isMedia = task.category === 'video' || task.category === 'audio' || task.type === 'video' || task.type === 'audio' || /\.(mp4|mkv|webm|mov|avi|flv|ts|mp3|flac|wav|aac|m4a)$/i.test(task.savePath || '');
        const isVideo = task.category === 'video' || /\.(mp4|mkv|webm|mov|avi)$/i.test(task.savePath || '');
        const trimBtn = isVideo ? `<button type="button" class="mini" data-trim="${escapeHtml(task.id)}" title="无损截取片段与生成GIF动图">${t('trimBtn')}</button>` : '';
        const convertBtn = isMedia ? `<button type="button" class="mini" data-convert="${escapeHtml(task.id)}" title="格式转换与音频提取">🔄 转码</button>` : '';
        actionBtn = `
          <button type="button" class="mini preview-btn" data-preview="${escapeHtml(task.id)}" title="免转码立即预览播放">${t('previewBtn')}</button>
          ${trimBtn}
          ${convertBtn}
          <button type="button" class="mini" data-show="${escapeHtml(task.savePath || '')}">${t('show')}</button>
          <button type="button" class="mini" data-hash="${escapeHtml(task.savePath || '')}" title="校验文件完整性与哈希值">${t('checkHashBtn')}</button>
        `;
      } else if (task.status === 'queued' || task.status === 'scheduled') {
        actionBtn = `
          <button type="button" class="mini" data-prioritize="${escapeHtml(task.id)}" title="插队置顶立即优先下载">${t('prioritizeBtn')}</button>
          <button type="button" class="mini" data-pause="${escapeHtml(task.id)}">${t('pause')}</button>
        `;
      } else if (task.status === 'paused') {
        actionBtn = `
          <button type="button" class="mini" data-prioritize="${escapeHtml(task.id)}" title="插队置顶立即优先下载">${t('prioritizeBtn')}</button>
          <button type="button" class="mini" data-resume="${escapeHtml(task.id)}">${t('resume')}</button>
          <button type="button" class="mini" data-refresh-url="${escapeHtml(task.id)}" title="直链过期时更新新链接无缝接着下">${t('refreshUrlBtn')}</button>
        `;
      } else if (task.status === 'failed' || task.status === 'canceled') {
        actionBtn = `
          <button type="button" class="mini" data-resume="${escapeHtml(task.id)}">${t('retry')}</button>
          <button type="button" class="mini" data-refresh-url="${escapeHtml(task.id)}" title="直链过期时更新新链接无缝接着下">${t('refreshUrlBtn')}</button>
        `;
      } else if (task.status === 'downloading') {
        actionBtn = `<button type="button" class="mini" data-pause="${escapeHtml(task.id)}">${t('pause')}</button>`;
      } else {
        actionBtn = `<button type="button" class="mini" data-resume="${escapeHtml(task.id)}">${t('retry')}</button>`;
      }

      let sizeInfoHtml = '';
      if (task.status === 'completed') {
        sizeInfoHtml = `<span class="meta-size-badge complete">📦 文件大小: ${formatBytes(task.size || task.downloaded || 0)}</span>`;
      } else if (task.size && task.size > 0) {
        sizeInfoHtml = `<span class="meta-size-badge active">📦 ${formatBytes(task.downloaded || 0)} / 预估 ${formatBytes(task.size)}</span>`;
      } else if (task.downloaded && task.downloaded > 0) {
        sizeInfoHtml = `<span class="meta-size-badge active">📦 已下 ${formatBytes(task.downloaded)} (计算总大小...)</span>`;
      } else {
        sizeInfoHtml = `<span class="meta-size-badge pending">📦 预估大小: 测算中...</span>`;
      }

      let channelBadgeHtml = '';
      if (task.url?.startsWith('magnet:') || task.isTorrent || task.url?.endsWith('.torrent')) {
        channelBadgeHtml = `<span class="channel-badge torrent-badge">🧲 磁力/BT</span>`;
      } else if (task.isDirectStream || task.url?.includes('.m3u8') || task.url?.includes('.mpd') || task.url?.includes('/progressive/')) {
        channelBadgeHtml = `<span class="channel-badge sniffer-badge">⚡ 网页透视</span>`;
      } else if (task.category === 'audio' || task.isAudioOnly || task.type === 'audio') {
        channelBadgeHtml = `<span class="channel-badge audio-badge">🎵 音频提取</span>`;
      } else if (task.category === 'video' || task.type === 'video' || /youtube|bilibili|douyin|tiktok|twitter|x\.com|pornhub/i.test(task.url || '')) {
        channelBadgeHtml = `<span class="channel-badge video-badge">🎬 视频解析</span>`;
      } else {
        channelBadgeHtml = `<span class="channel-badge file-badge">📦 高速直链</span>`;
      }

      let peerBadgeHtml = '';
      if (task.url?.startsWith('magnet:') || task.isTorrent || task.type === 'torrent') {
        peerBadgeHtml = `<span class="meta-peer-badge">👥 节点: ${task.peers || 0} · 🌱 做种: ${task.seeds || 0}</span>`;
      }

      const isSelected = selectedTaskIds.has(task.id);

      return `
        <article class="task ${task.status} ${isSelected ? 'selected' : ''}" data-task-id="${escapeHtml(task.id)}">
          <div class="task-checkbox-wrap">
            <input type="checkbox" class="task-checkbox" data-id="${escapeHtml(task.id)}" ${isSelected ? 'checked' : ''}>
          </div>
          <div class="thumb-box">${thumbContent}</div>
          <div class="task-info-main">
            <div class="task-header-line">
              ${channelBadgeHtml}
              <div class="title" title="${escapeHtml(task.name)}">${escapeHtml(task.name || 'download')}</div>
            </div>
            <div class="meta">
              <span class="meta-category">${escapeHtml(task.category || 'document')}</span>
              ${sizeInfoHtml}
              ${peerBadgeHtml}
              <span class="meta-speed">${speedStr}</span>
            </div>
            <div class="progress">
              <i style="width: ${Math.min(100, Math.max(0, task.progress || 0))}%"></i>
            </div>
          </div>
          <div class="task-actions-right">
            <div class="percent">${Math.round(task.progress || 0)}%</div>
            <div class="status">${statusLabel}</div>
            <div class="task-button-group">
              ${actionBtn}
              <button type="button" class="mini" data-cancel="${escapeHtml(task.id)}">${t('remove')}</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  if (emptyEl) emptyEl.style.display = filtered.length ? 'none' : 'block';

  const countAll = document.getElementById('countAll');
  const countDownloading = document.getElementById('countRun');
  const countCompleted = document.getElementById('countDone');
  const countPaused = document.getElementById('countPaused');
  const countFailed = document.getElementById('countFailed');

  const countTorrent = document.getElementById('countTorrent');
  const countSniffer = document.getElementById('countSniffer');
  const countVideo = document.getElementById('countVideo');
  const countAudio = document.getElementById('countAudio');
  const countFile = document.getElementById('countFile');

  if (countAll) countAll.textContent = tasks.length;
  if (countDownloading) countDownloading.textContent = tasks.filter(t => t.status === 'downloading' || t.status === 'queued').length;
  if (countCompleted) countCompleted.textContent = tasks.filter(t => t.status === 'completed').length;
  if (countPaused) countPaused.textContent = tasks.filter(t => t.status === 'paused').length;
  if (countFailed) countFailed.textContent = tasks.filter(t => t.status === 'failed' || t.status === 'canceled').length;

  if (countTorrent) countTorrent.textContent = tasks.filter(t => t.url?.startsWith('magnet:') || t.isTorrent || t.url?.endsWith('.torrent')).length;
  if (countSniffer) countSniffer.textContent = tasks.filter(t => t.isDirectStream || t.url?.includes('.m3u8') || t.url?.includes('.mpd') || t.url?.includes('/progressive/')).length;
  if (countVideo) countVideo.textContent = tasks.filter(t => (t.category === 'video' || t.type === 'video') && !t.isDirectStream && !t.url?.startsWith('magnet:') && !t.url?.endsWith('.torrent')).length;
  if (countAudio) countAudio.textContent = tasks.filter(t => t.category === 'audio' || t.isAudioOnly || t.type === 'audio').length;
  if (countFile) countFile.textContent = tasks.filter(t => (t.category === 'archive' || t.category === 'document' || t.category === 'other' || t.type === 'file') && !t.url?.startsWith('magnet:') && !t.url?.endsWith('.torrent') && !t.isDirectStream).length;

  const metricActive = document.getElementById('metricActive');
  const metricCompleted = document.getElementById('metricCompleted');
  if (metricActive) metricActive.textContent = tasks.filter(t => t.status === 'downloading').length;
  if (metricCompleted) metricCompleted.textContent = tasks.filter(t => t.status === 'completed').length;
}

// Built-in Liquid Video & Audio Preview Player
function openPreviewModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task || !task.savePath) return showToast('未找到可预览的本地文件');

  const modal = document.getElementById('previewModal');
  const titleEl = document.getElementById('previewTitleText');
  const formatBadge = document.getElementById('previewFormatBadge');
  const fileInfo = document.getElementById('previewFileInfo');
  const videoPlayer = document.getElementById('previewVideoPlayer');
  const audioWrap = document.getElementById('previewAudioWrap');
  const audioPlayer = document.getElementById('previewAudioPlayer');
  const audioCover = document.getElementById('previewAudioCover');
  const vinylDisc = document.getElementById('vinylDisc');
  const locateBtn = document.getElementById('previewLocateBtn');

  if (titleEl) titleEl.textContent = task.name || '媒体预览';
  if (fileInfo) fileInfo.textContent = `文件大小: ${formatBytes(task.size || 0)} | 存储路径: ${task.savePath}`;
  if (locateBtn) locateBtn.onclick = () => nativeApi.show(task.savePath);

  const isAudio = task.category === 'audio';
  const mediaUrl = `media://${encodeURIComponent(task.savePath)}`;

  if (isAudio) {
    if (formatBadge) formatBadge.textContent = 'MP3 AUDIO';
    if (videoPlayer) {
      videoPlayer.classList.add('hidden');
      videoPlayer.pause();
      videoPlayer.src = '';
    }
    if (audioWrap) audioWrap.classList.remove('hidden');
    if (audioCover) audioCover.src = task.thumbnail || '';
    if (audioPlayer) {
      audioPlayer.src = mediaUrl;
      audioPlayer.onplay = () => vinylDisc?.classList.add('playing');
      audioPlayer.onpause = () => vinylDisc?.classList.remove('playing');
      audioPlayer.onended = () => vinylDisc?.classList.remove('playing');
      audioPlayer.play().catch(() => {});
    }
  } else {
    if (formatBadge) formatBadge.textContent = task.quality ? `${task.quality}P VIDEO` : '4K MP4';
    if (audioWrap) {
      audioWrap.classList.add('hidden');
      if (audioPlayer) { audioPlayer.pause(); audioPlayer.src = ''; }
    }
    if (videoPlayer) {
      videoPlayer.classList.remove('hidden');
      videoPlayer.src = mediaUrl;
      videoPlayer.play().catch(() => {});
    }
  }

  if (modal) modal.classList.remove('hidden');
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  const videoPlayer = document.getElementById('previewVideoPlayer');
  const audioPlayer = document.getElementById('previewAudioPlayer');
  const vinylDisc = document.getElementById('vinylDisc');

  if (videoPlayer) { videoPlayer.pause(); videoPlayer.src = ''; }
  if (audioPlayer) { audioPlayer.pause(); audioPlayer.src = ''; }
  if (vinylDisc) vinylDisc.classList.remove('playing');
  if (modal) modal.classList.add('hidden');
}

// Real-time Global Speed Waveform Visualizer & Dynamic Engine Sync
const speedHistory = new Array(40).fill(0);
let currentSmoothSpeed = 0;
let backendTotalSpeed = 0;

function startSpeedWaveform() {
  const canvas = document.getElementById('speedWaveCanvas');
  const liveSpeedEl = document.getElementById('metricLiveSpeed');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Sample speed history every 200ms (5Hz) to provide an 8-second smooth sliding window
  setInterval(() => {
    let taskSpeedSum = 0;
    tasks.forEach(t => {
      if ((t.status === 'downloading' || t.running) && t.speed) {
        const s = typeof t.speed === 'number' ? t.speed : parseFloat(t.speed) || 0;
        if (s > 0) taskSpeedSum += s;
      }
    });

    const activeSpeed = Math.max(taskSpeedSum, backendTotalSpeed);
    speedHistory.push(activeSpeed);
    if (speedHistory.length > 40) speedHistory.shift();
  }, 200);

  function draw() {
    let instantaneousSpeed = 0;
    tasks.forEach(t => {
      if ((t.status === 'downloading' || t.running) && t.speed) {
        const s = typeof t.speed === 'number' ? t.speed : parseFloat(t.speed) || 0;
        if (s > 0) instantaneousSpeed += s;
      }
    });

    const targetSpeed = Math.max(instantaneousSpeed, backendTotalSpeed);

    // Smooth exponential moving average for fluid number and curve transitions
    currentSmoothSpeed = currentSmoothSpeed * 0.8 + targetSpeed * 0.2;
    if (Math.abs(currentSmoothSpeed - targetSpeed) < 1 && targetSpeed === 0) {
      currentSmoothSpeed = 0;
    }

    if (liveSpeedEl) {
      if (currentSmoothSpeed > 10) {
        liveSpeedEl.textContent = formatBytes(Math.round(currentSmoothSpeed)) + '/s';
        liveSpeedEl.classList.add('active-pulse');
      } else {
        liveSpeedEl.textContent = '0 B/s';
        liveSpeedEl.classList.remove('active-pulse');
      }
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const maxSpeed = Math.max(...speedHistory, currentSmoothSpeed, 512 * 1024);
    const step = w / (speedHistory.length - 1);

    // 1. Draw smooth area fill gradient
    ctx.beginPath();
    ctx.moveTo(0, h);

    for (let i = 0; i < speedHistory.length; i++) {
      const val = (i === speedHistory.length - 1) ? currentSmoothSpeed : speedHistory[i];
      const norm = Math.min(1, Math.max(0, val / maxSpeed));
      const x = i * step;
      const y = h - norm * (h - 10) - 4;
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        const prevX = (i - 1) * step;
        const prevVal = speedHistory[i - 1];
        const prevNorm = Math.min(1, Math.max(0, prevVal / maxSpeed));
        const prevY = h - prevNorm * (h - 10) - 4;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }

    ctx.lineTo(w, h);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, currentSmoothSpeed > 0 ? 'rgba(0, 242, 254, 0.45)' : 'rgba(0, 242, 254, 0.1)');
    grad.addColorStop(1, 'rgba(0, 113, 227, 0.01)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 2. Draw glowing neon path
    ctx.beginPath();
    for (let i = 0; i < speedHistory.length; i++) {
      const val = (i === speedHistory.length - 1) ? currentSmoothSpeed : speedHistory[i];
      const norm = Math.min(1, Math.max(0, val / maxSpeed));
      const x = i * step;
      const y = h - norm * (h - 10) - 4;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * step;
        const prevVal = speedHistory[i - 1];
        const prevNorm = Math.min(1, Math.max(0, prevVal / maxSpeed));
        const prevY = h - prevNorm * (h - 10) - 4;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }

    ctx.save();
    ctx.shadowColor = currentSmoothSpeed > 0 ? 'rgba(0, 242, 254, 0.9)' : 'rgba(0, 242, 254, 0.3)';
    ctx.shadowBlur = currentSmoothSpeed > 0 ? 8 : 2;
    ctx.strokeStyle = currentSmoothSpeed > 0 ? '#00f2fe' : 'rgba(0, 242, 254, 0.4)';
    ctx.lineWidth = currentSmoothSpeed > 0 ? 2.2 : 1.2;
    ctx.stroke();
    ctx.restore();

    // 3. Draw leading active beacon dot
    if (currentSmoothSpeed > 0) {
      const lastX = w;
      const lastNorm = Math.min(1, Math.max(0, currentSmoothSpeed / maxSpeed));
      const lastY = h - lastNorm * (h - 10) - 4;
      ctx.beginPath();
      ctx.arc(lastX - 2, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 10;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  draw();
}

function updateNamingPreview() {
  const pattern = document.getElementById('namingPattern')?.value || '{title}';
  const previewEl = document.getElementById('namingPreview');
  if (previewEl) {
    const formatted = pattern
      .replace(/\{title\}/gi, 'Never Gonna Give You Up')
      .replace(/\{uploader\}/gi, 'Rick Astley')
      .replace(/\{platform\}/gi, 'YouTube')
      .replace(/\{resolution\}/gi, '4K')
      .replace(/\{date\}/gi, '2026-08-14')
      .replace(/\{index\}/gi, '01');
    previewEl.textContent = `${formatted}.mp4`;
  }
}

async function refreshCookieProfiles() {
  if (!nativeApi?.listCookies) return;
  try {
    cookieProfiles = await nativeApi.listCookies();
  } catch (e) {}

  ['bilibili', 'youtube', 'douyin', 'x', 'telegram', 'instagram', 'pornhub', 'general'].forEach(site => {
    const statusEl = document.getElementById(`status-${site}`);
    const deleteBtn = document.querySelector(`.delete-cookie-btn[data-site="${site}"]`);

    if (cookieProfiles && cookieProfiles[site]) {
      const timeStr = formatDate(cookieProfiles[site].updatedAt);
      if (statusEl) {
        statusEl.textContent = `● ${t('cookieReady')}${timeStr ? ` (${timeStr})` : ''}`;
        statusEl.className = 'cookie-status-text active';
      }
      if (deleteBtn) deleteBtn.classList.remove('hidden');
    } else {
      if (statusEl) {
        statusEl.textContent = `○ ${t('cookieNone')}`;
        statusEl.className = 'cookie-status-text';
      }
      if (deleteBtn) deleteBtn.classList.add('hidden');
    }
  });
}

function getPlatformFallbackThumb(url) {
  let text = '🎬 视频';
  let color = '#0071e3';
  let bg = '#162032';

  if (/pornhub/i.test(url)) {
    text = '🔞 PH';
    color = '#ff9900';
    bg = '#1f1900';
  } else if (/bilibili|b23\.tv/i.test(url)) {
    text = '📺 B站';
    color = '#00aeec';
    bg = '#142533';
  } else if (/youtube|youtu\.be/i.test(url)) {
    text = '▶️ YT';
    color = '#ff3b30';
    bg = '#2a1111';
  } else if (/douyin|tiktok/i.test(url)) {
    text = '🎵 抖音';
    color = '#00f2fe';
    bg = '#112228';
  } else if (/twitter|x\.com|t\.co/i.test(url)) {
    text = '🐦 X';
    color = '#1d9bf0';
    bg = '#11202e';
  } else if (/t\.me|telegram/i.test(url)) {
    text = '✈️ TG';
    color = '#2aabee';
    bg = '#112233';
  } else if (/magnet:|\.torrent/i.test(url)) {
    text = '🧲 BT';
    color = '#bf5af2';
    bg = '#221133';
  }

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="90" height="56" viewBox="0 0 90 56"><rect width="90" height="56" rx="6" fill="${encodeURIComponent(bg)}"/><text x="45" y="34" fill="${encodeURIComponent(color)}" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="15" text-anchor="middle">${encodeURIComponent(text)}</text></svg>`;
}

// Smart Video Sniffer & Text Dirt Cleaner Handler
async function handleUrlInputSniff() {
  const urlInput = document.getElementById('urlInput');
  const sniffIndicator = document.getElementById('sniffIndicator');
  const sniffPreviewCard = document.getElementById('sniffPreviewCard');
  const nameInput = document.getElementById('nameInput');

  clearTimeout(sniffDebounceTimer);
  const text = (urlInput?.value || '').trim();
  if (!text) {
    if (sniffIndicator) sniffIndicator.classList.add('hidden');
    if (sniffPreviewCard) sniffPreviewCard.classList.add('hidden');
    currentSniffData = null;
    return;
  }

  // Automatic channel auto-switch for magnet and torrent links
  if (text.startsWith('magnet:') || text.endsWith('.torrent')) {
    setDownloadMode('torrent');
    const tIn = document.getElementById('modalTorrentInput');
    if (tIn) tIn.value = text;
    handleModalParseTorrent(text);
    return;
  }

  if (nativeApi?.extractUrls) {
    try {
      const res = await nativeApi.extractUrls(text);
      if (res && res.urls && res.urls.length > 0) {
        if (res.urls.length === 1) {
          const cleanUrl = res.urls[0];
          if (sniffIndicator) {
            sniffIndicator.innerHTML = `<span class="spin-dot"></span> ✨ 智能提纯：正在深度穿透解析...`;
            sniffIndicator.classList.remove('hidden');
          }

          sniffDebounceTimer = setTimeout(async () => {
            if (!nativeApi?.sniffVideo) return;
            try {
              const data = await nativeApi.sniffVideo(cleanUrl);
              currentSniffData = data;
              if (sniffIndicator) {
                sniffIndicator.innerHTML = `✨ 智能提纯就绪`;
                sniffIndicator.classList.remove('hidden');
              }

              if (sniffPreviewCard && data) {
                sniffPreviewCard.classList.remove('hidden');
                const thumb = document.getElementById('sniffThumb');
                const title = document.getElementById('sniffTitle');
                const duration = document.getElementById('sniffDuration');
                const uploader = document.getElementById('sniffUploader');

                const fallbackSvg = getPlatformFallbackThumb(cleanUrl || data.webpage_url || '');

                if (thumb) {
                  if (data.thumbnail) {
                    thumb.src = data.thumbnail;
                  } else {
                    thumb.src = fallbackSvg;
                  }
                  thumb.onerror = () => {
                    thumb.src = fallbackSvg;
                  };
                }
                if (title) title.textContent = data.title || '视频标题';
                if (duration) {
                  duration.textContent = data.durationStr || (data.duration ? `${Math.floor(data.duration/60)}:${(data.duration%60).toString().padStart(2,'0')}` : '00:00');
                }

                const sizeBadge = document.getElementById('sniffSizeBadge');
                if (sizeBadge) {
                  if (data.size && data.size > 0) {
                    sizeBadge.textContent = `📦 预估大小: ${formatBytes(data.size)}`;
                    sizeBadge.style.display = 'inline-flex';
                  } else {
                    sizeBadge.style.display = 'none';
                  }
                }

                if (uploader) uploader.textContent = data.uploader || 'UP主 / 频道';

                if (nameInput && !nameInput.value.trim() && data.title) {
                  nameInput.value = data.title;
                }

                if (data.availableResolutions && data.availableResolutions.length) {
                  const vQualitySelect = document.getElementById('videoQuality');
                  if (vQualitySelect) {
                    const bestLabel = data.size ? `最高可用（原画最高 · ~${formatBytes(data.size)}）` : `最高可用（原画最高）`;
                    vQualitySelect.innerHTML = `<option value="best">${bestLabel}</option>` +
                      data.availableResolutions.map(item => {
                        const h = typeof item === 'object' ? item.height : item;
                        const sz = typeof item === 'object' && item.size ? ` · ~${formatBytes(item.size)}` : '';
                        return `<option value="${h}">${h}P 超清${sz}</option>`;
                      }).join('');
                  }
                }
              }
            } catch (err) {
              if (sniffIndicator) {
                sniffIndicator.innerHTML = `⚠️ ${escapeHtml(err.message || '未获取到视频信息')}`;
                sniffIndicator.classList.remove('hidden');
              }
              if (sniffPreviewCard) sniffPreviewCard.classList.add('hidden');
              currentSniffData = null;
            }
          }, 450);
          return;
        } else {
          if (sniffIndicator) {
            sniffIndicator.innerHTML = `✨ 批量提纯：成功从复杂文本中捕获 ${res.urls.length} 个下载链接`;
            sniffIndicator.classList.remove('hidden');
          }
          if (sniffPreviewCard) sniffPreviewCard.classList.add('hidden');
          currentSniffData = null;
          return;
        }
      }
    } catch (e) {}
  }

  if (sniffIndicator) sniffIndicator.classList.add('hidden');
  if (sniffPreviewCard) sniffPreviewCard.classList.add('hidden');
  currentSniffData = null;
}

let modalTorrentData = null;

function setDownloadMode(mode) {
  currentMode = mode;
  document.querySelectorAll('#modalChannelPills .mode-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.mode === mode);
  });

  const paneStandard = document.getElementById('channelPaneStandard');
  const paneSniffer = document.getElementById('channelPaneSniffer');
  const paneTorrent = document.getElementById('channelPaneTorrent');

  if (paneStandard) paneStandard.classList.toggle('hidden', mode === 'sniffer' || mode === 'torrent');
  if (paneSniffer) paneSniffer.classList.toggle('hidden', mode !== 'sniffer');
  if (paneTorrent) paneTorrent.classList.toggle('hidden', mode !== 'torrent');

  const vGroup = document.getElementById('videoQualityGroup');
  const aGroup = document.getElementById('audioQualityGroup');

  if (mode === 'video') {
    if (vGroup) vGroup.style.display = 'block';
    if (aGroup) aGroup.style.display = 'block';
  } else if (mode === 'audio') {
    if (vGroup) vGroup.style.display = 'none';
    if (aGroup) aGroup.style.display = 'block';
  } else {
    if (vGroup) vGroup.style.display = 'none';
    if (aGroup) aGroup.style.display = 'none';
  }

  if (mode === 'sniffer') {
    renderModalSniffedStreamsList();
  }
}

function openAddModal(prefillUrl = '', mode = 'video') {
  const modal = document.getElementById('modal');
  const urlInput = document.getElementById('urlInput');
  const isModalOpen = modal && !modal.classList.contains('hidden');

  if (prefillUrl && (prefillUrl.startsWith('magnet:') || prefillUrl.endsWith('.torrent'))) {
    mode = 'torrent';
  }

  // If modal is already open and in standard video/audio/file mode
  if (isModalOpen && mode !== 'torrent' && mode !== 'sniffer' && urlInput && prefillUrl) {
    const existing = urlInput.value.trim();
    if (existing) {
      const urls = existing.split(/\r?\n/).map(u => u.trim()).filter(Boolean);
      if (urls.includes(prefillUrl)) {
        showToast(currentLang === 'zh' ? '✨ 该链接已在当前任务卡中！' : 'Link is already in current task card!');
        urlInput.focus();
        return;
      } else {
        urlInput.value = existing + '\n' + prefillUrl;
        showToast(currentLang === 'zh' ? `➕ 已将第 ${urls.length + 1} 个链接追加至当前批量任务！` : `Added url #${urls.length + 1} to batch!`);
        handleUrlInputSniff();
        urlInput.focus();
        return;
      }
    }
  }

  const sniffPreviewCard = document.getElementById('sniffPreviewCard');
  if (sniffPreviewCard) sniffPreviewCard.classList.add('hidden');
  currentSniffData = null;
  selectedScheduleTime = null;

  setDownloadMode(mode);

  document.querySelectorAll('.schedule-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.time === 'now');
  });

  if (modal) modal.classList.remove('hidden');

  if (mode === 'torrent') {
    const tIn = document.getElementById('modalTorrentInput');
    if (tIn && prefillUrl) {
      tIn.value = prefillUrl;
      handleModalParseTorrent(prefillUrl);
    }
  } else if (mode === 'sniffer') {
    const sIn = document.getElementById('modalSnifferUrlInput');
    if (sIn && prefillUrl) sIn.value = prefillUrl;
  } else {
    if (urlInput) {
      if (prefillUrl) {
        urlInput.value = prefillUrl;
        handleUrlInputSniff();
      }
      urlInput.focus();
    }
  }
}

function closeAddModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('hidden');
  const urlInput = document.getElementById('urlInput');
  const nameInput = document.getElementById('nameInput');
  const sniffPreviewCard = document.getElementById('sniffPreviewCard');
  const sniffIndicator = document.getElementById('sniffIndicator');

  if (urlInput) urlInput.value = '';
  if (nameInput) nameInput.value = '';
  if (sniffPreviewCard) sniffPreviewCard.classList.add('hidden');
  if (sniffIndicator) sniffIndicator.classList.add('hidden');
  currentSniffData = null;
  selectedScheduleTime = null;
}

function renderModalSniffedStreamsList() {
  const listEl = document.getElementById('modalSniffedStreamsList');
  const countEl = document.getElementById('modalSniffedCount');
  if (countEl) countEl.textContent = sniffedStreamRecords.length;
  if (!listEl) return;

  if (sniffedStreamRecords.length === 0) {
    listEl.innerHTML = '<div class="empty-hint-text">暂无截获到的媒体流，请点击上方启动嗅探窗口播放视频</div>';
    return;
  }

  listEl.innerHTML = sniffedStreamRecords.map(s => {
    let typeName = 'VIDEO STREAM';
    if (s.url.includes('.m3u8')) typeName = 'HLS (m3u8)';
    else if (s.url.includes('.mpd')) typeName = 'DASH (mpd)';
    else if (s.url.includes('.mp4')) typeName = 'MP4 DIRECT';
    else if (s.mime?.includes('audio')) typeName = 'AUDIO STREAM';

    return `
      <div class="sniffer-stream-item" data-url="${escapeHtml(s.url)}">
        <div class="sniffer-stream-info">
          <div class="sniffer-stream-url" title="${escapeHtml(s.url)}">${escapeHtml(s.url)}</div>
          <div class="sniffer-stream-meta">
            <span class="stream-type-badge">${typeName}</span>
            <span>大小: ${s.size ? formatBytes(s.size) : '分片流'}</span>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button type="button" class="liquid-btn primary-btn mini-btn modal-select-stream-btn" data-url="${escapeHtml(s.url)}">📥 立即下载此流</button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.modal-select-stream-btn').forEach(btn => {
    btn.onclick = async () => {
      const u = btn.dataset.url;
      try {
        const payload = [{
          url: u,
          name: 'stream_' + Date.now(),
          type: 'video',
          mode: 'video',
          quality: 'best',
          isDirectStream: true,
          startAt: selectedScheduleTime || null
        }];
        await nativeApi.addBatch(payload);
        closeAddModal();
        showToast('🚀 网页透视截获的媒体流已加入下载队列！');
      } catch (e) {
        showToast(e.message || '添加任务失败');
      }
    };
  });
}

async function handleModalParseTorrent(rawInput) {
  if (!nativeApi?.parseTorrent) return;
  const input = rawInput || document.getElementById('modalTorrentInput')?.value?.trim();
  if (!input) return showToast('请输入磁力链接或选择种子文件');

  const parseBtn = document.getElementById('modalParseTorrentBtn');
  if (parseBtn) { parseBtn.disabled = true; parseBtn.textContent = '解析中...'; }
  try {
    const data = await nativeApi.parseTorrent(input);
    modalTorrentData = data;
    renderModalTorrentData(data);
    showToast('✨ 种子/磁力元数据解析成功！');
  } catch (err) {
    showToast('解析失败: ' + (err.message || '未知错误'));
  } finally {
    if (parseBtn) { parseBtn.disabled = false; parseBtn.textContent = '🔍 解析内容'; }
  }
}

function renderModalTorrentData(data) {
  const metaCard = document.getElementById('modalTorrentMetaCard');
  const titleEl = document.getElementById('modalTorrentTitle');
  const totalSizeEl = document.getElementById('modalTorrentTotalSize');
  const fileCountEl = document.getElementById('modalTorrentFileCount');
  const listEl = document.getElementById('modalTorrentFilesList');

  if (metaCard) metaCard.classList.remove('hidden');
  if (titleEl) titleEl.textContent = data.name || 'Torrent Download';
  if (totalSizeEl) totalSizeEl.textContent = data.totalSize ? formatBytes(data.totalSize) : '动态握手获取';
  if (fileCountEl) fileCountEl.textContent = data.files ? data.files.length : 1;

  if (listEl && data.files) {
    const isMagnet = data.type === 'magnet';
    listEl.innerHTML = data.files.map(f => `
      <div class="torrent-file-item" data-idx="${f.index}">
        <input type="checkbox" class="modal-torrent-file-checkbox" ${f.selected ? 'checked' : ''} data-idx="${f.index}">
        <span class="torrent-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="torrent-file-size" style="${isMagnet ? 'color:#00f2fe; font-size:11px;' : ''}">${f.size ? formatBytes(f.size) : (isMagnet ? `⚡ ${data.trackersInjected || 35}+ Trackers 已就绪` : '动态获取')}</span>
      </div>
    `).join('');

    listEl.querySelectorAll('.modal-torrent-file-checkbox').forEach(cb => {
      cb.onchange = () => {
        const idx = Number(cb.dataset.idx);
        if (modalTorrentData.files[idx]) {
          modalTorrentData.files[idx].selected = cb.checked;
        }
        updateModalTorrentSelectedCount();
      };
    });
  }
  updateModalTorrentSelectedCount();
}

function updateModalTorrentSelectedCount() {
  const selCountEl = document.getElementById('modalTorrentSelectedCount');
  if (!modalTorrentData || !selCountEl) return;
  const count = modalTorrentData.files.filter(f => f.selected).length;
  selCountEl.textContent = count;
}

function openSettingsModal() {
  const s = settings;
  const modal = document.getElementById('settingsModal');
  if (!modal) return;

  const downloadDir = document.getElementById('downloadDir');
  const maxConcurrent = document.getElementById('maxConcurrent');
  const segments = document.getElementById('segments');
  const speedLimit = document.getElementById('speedLimit');
  const retryCount = document.getElementById('retryCount');
  const namingPattern = document.getElementById('namingPattern');
  const antiBanJitter = document.getElementById('antiBanJitter');
  const downloadDanmaku = document.getElementById('downloadDanmaku');
  const floatingWidget = document.getElementById('floatingWidget');
  const minimizeToTray = document.getElementById('minimizeToTray');
  const clipboardMonitor = document.getElementById('clipboardMonitor');
  const nativeNotifications = document.getElementById('nativeNotifications');
  const autoShutdown = document.getElementById('autoShutdown');
  const ytDlpPath = document.getElementById('ytDlpPath');
  const ffmpegPath = document.getElementById('ffmpegPath');

  if (downloadDir) downloadDir.value = s.downloadDir || '';
  if (maxConcurrent) maxConcurrent.value = s.maxConcurrent || 3;
  if (segments) segments.value = s.segments || 8;
  if (speedLimit) speedLimit.value = s.speedLimit || 0;
  if (retryCount) retryCount.value = s.retryCount ?? 3;
  if (namingPattern) namingPattern.value = s.namingPattern || '{title}';
  if (antiBanJitter) antiBanJitter.checked = s.antiBanJitter !== false;
  if (downloadDanmaku) downloadDanmaku.checked = !!s.downloadDanmaku;
  if (floatingWidget) floatingWidget.checked = !!s.floatingWidget;
  if (minimizeToTray) minimizeToTray.checked = s.minimizeToTray !== false;
  if (clipboardMonitor) clipboardMonitor.checked = s.clipboardMonitor !== false;
  if (autoShutdown) autoShutdown.checked = !!s.autoShutdown;
  const soundEffects = document.getElementById('soundEffects');
  if (soundEffects) soundEffects.checked = s.soundEffects !== false;
  if (ytDlpPath) ytDlpPath.value = s.ytDlpPath || '';
  if (ffmpegPath) ffmpegPath.value = s.ffmpegPath || '';

  // Smart Category Fields
  const enableAutoCat = document.getElementById('enableAutoCategory');
  const catVideo = document.getElementById('catVideoFolder');
  const catAudio = document.getElementById('catAudioFolder');
  const catArchive = document.getElementById('catArchiveFolder');
  const catDocument = document.getElementById('catDocumentFolder');
  const catPicture = document.getElementById('catPictureFolder');
  const catOther = document.getElementById('catOtherFolder');

  if (enableAutoCat) enableAutoCat.checked = s.enableAutoCategory !== false;
  const cf = s.categoryFolders || {};
  if (catVideo) catVideo.value = cf.video || 'Videos';
  if (catAudio) catAudio.value = cf.audio || 'Music';
  if (catArchive) catArchive.value = cf.archive || 'Archives';
  if (catDocument) catDocument.value = cf.document || 'Documents';
  if (catPicture) catPicture.value = cf.picture || 'Pictures';
  if (catOther) catOther.value = cf.other || 'Others';

  // Time Schedule Fields
  const enableSchedule = document.getElementById('enableTimeSchedule');
  const pStart = document.getElementById('peakStartTime');
  const pEnd = document.getElementById('peakEndTime');
  const pLimit = document.getElementById('peakLimitKBps');
  const opLimit = document.getElementById('offPeakLimitKBps');

  const ts = s.timeSchedule || {};
  if (enableSchedule) enableSchedule.checked = !!ts.enabled;
  if (pStart) pStart.value = ts.peakStart || '08:00';
  if (pEnd) pEnd.value = ts.peakEnd || '23:00';
  if (pLimit) pLimit.value = ts.peakLimitKBps || 2048;
  if (opLimit) opLimit.value = ts.offPeakLimitKBps || 0;

  // Proxy tab state
  currentProxyMode = s.proxyMode || 'direct';
  document.querySelectorAll('.proxy-preset-card').forEach(c => {
    c.classList.toggle('active', c.dataset.preset === currentProxyMode);
  });
  const pProto = document.getElementById('proxyProtocol');
  const pHost = document.getElementById('proxyHost');
  const pPort = document.getElementById('proxyPort');
  if (pProto) pProto.value = s.proxyProtocol || 'http';
  if (pHost) pHost.value = s.proxyHost || '127.0.0.1';
  if (pPort) pPort.value = s.proxyPort || '7890';

  const routingRadio = document.querySelector(`input[name="proxyRouting"][value="${s.proxyRouting || 'smart'}"]`);
  if (routingRadio) routingRadio.checked = true;

  updateNamingPreview();
  refreshCookieProfiles();
  runDiagnosticCheck(true);

  if (nativeApi?.getUserscript) {
    nativeApi.getUserscript().then(script => {
      const display = document.getElementById('userscriptCodeDisplay');
      if (display) display.textContent = script;
    }).catch(() => {});
  }

  const copyScriptBtn = document.getElementById('copyUserscriptBtn');
  if (copyScriptBtn) {
    copyScriptBtn.onclick = async () => {
      const display = document.getElementById('userscriptCodeDisplay');
      if (display && display.textContent) {
        await navigator.clipboard.writeText(display.textContent);
        showToast('✨ 油猴脚本代码已复制到剪贴板！');
      }
    };
  }

  modal.classList.remove('hidden');
}

async function runDiagnosticCheck(silent = false) {
  if (!nativeApi) return;
  const checkToolsBtn = document.getElementById('checkTools');
  if (checkToolsBtn && !silent) {
    checkToolsBtn.disabled = true;
    checkToolsBtn.textContent = '检测中...';
  }
  try {
    const res = await nativeApi.checkTools();
    const ytDlpStatus = document.getElementById('kernelYtDlpStatus');
    const ffmpegStatus = document.getElementById('kernelFfmpegStatus');
    const metricEngine = document.getElementById('metricEngine');

    if (ytDlpStatus) {
      ytDlpStatus.textContent = res.ytDlp?.available ? `就绪 (${res.ytDlp.version})` : '未找到或不可用';
      ytDlpStatus.className = `status-pill ${res.ytDlp?.available ? 'ok' : 'bad'}`;
    }
    if (ffmpegStatus) {
      ffmpegStatus.textContent = res.ffmpeg?.available ? `就绪 (${res.ffmpeg.version})` : '未找到或不可用';
      ffmpegStatus.className = `status-pill ${res.ffmpeg?.available ? 'ok' : 'bad'}`;
    }
    if (metricEngine) {
      metricEngine.textContent = (res.ytDlp?.available && res.ffmpeg?.available) ? 'All Ready' : 'Ready (HTTP)';
    }
    if (!silent) showToast('内核诊断完成');
  } catch (err) {
    if (!silent) showToast(err.message || '诊断过程异常');
  } finally {
    if (checkToolsBtn && !silent) {
      checkToolsBtn.disabled = false;
      checkToolsBtn.textContent = t('checkTools');
    }
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.add('hidden');
}

// Playlist Modal Operations
function openPlaylistModal(data) {
  currentPlaylistData = data;
  const modal = document.getElementById('playlistModal');
  const titleEl = document.getElementById('playlistTitle');
  const totalCountEl = document.getElementById('playlistTotalCount');
  const allCountEl = document.getElementById('playlistAllCount');
  const searchInput = document.getElementById('playlistSearchInput');

  if (titleEl) titleEl.textContent = data.title || '视频播放列表';
  if (totalCountEl) totalCountEl.textContent = `共 ${data.entries.length} 集`;
  if (allCountEl) allCountEl.textContent = data.entries.length;
  if (searchInput) searchInput.value = '';

  renderPlaylistEpisodes(data.entries);
  if (modal) modal.classList.remove('hidden');
}

function closePlaylistModal() {
  const modal = document.getElementById('playlistModal');
  if (modal) modal.classList.add('hidden');
  currentPlaylistData = null;
}

function renderPlaylistEpisodes(entriesList) {
  const container = document.getElementById('playlistEpisodesList');
  if (!container) return;

  container.innerHTML = entriesList.map(ep => `
    <div class="episode-item-row selected" data-id="${ep.id}">
      <input type="checkbox" class="episode-checkbox" checked data-id="${ep.id}">
      <span class="episode-idx">#${ep.index}</span>
      <span class="episode-title" title="${escapeHtml(ep.title)}">${escapeHtml(ep.title)}</span>
      <span class="episode-duration">${ep.durationStr || '--:--'}</span>
    </div>
  `).join('');

  updatePlaylistSelectedCount();
}

function updatePlaylistSelectedCount() {
  const container = document.getElementById('playlistEpisodesList');
  const selCountEl = document.getElementById('playlistSelectedCount');
  if (!container || !selCountEl) return;
  const checked = container.querySelectorAll('.episode-checkbox:checked').length;
  selCountEl.textContent = checked;
}

// File Hash Modal Operations
async function openHashModal(filePath) {
  const modal = document.getElementById('hashModal');
  const nameEl = document.getElementById('hashFileName');
  const md5El = document.getElementById('hashMd5Value');
  const sha1El = document.getElementById('hashSha1Value');
  const sha256El = document.getElementById('hashSha256Value');
  const compareInput = document.getElementById('hashCompareInput');
  const compareResult = document.getElementById('hashCompareResult');

  if (nameEl) nameEl.textContent = filePath;
  if (md5El) md5El.textContent = '计算中...';
  if (sha1El) sha1El.textContent = '计算中...';
  if (sha256El) sha256El.textContent = '计算中...';
  if (compareInput) compareInput.value = '';
  if (compareResult) compareResult.classList.add('hidden');

  if (modal) modal.classList.remove('hidden');

  if (nativeApi?.calculateHash) {
    try {
      const res = await nativeApi.calculateHash(filePath);
      currentHashData = res;
      if (md5El) md5El.textContent = res.md5;
      if (sha1El) sha1El.textContent = res.sha1;
      if (sha256El) sha256El.textContent = res.sha256;
    } catch (err) {
      if (md5El) md5El.textContent = '计算失败: ' + err.message;
      if (sha1El) sha1El.textContent = '计算失败';
      if (sha256El) sha256El.textContent = '计算失败';
    }
  }

  if (compareInput) {
    compareInput.oninput = () => {
      const val = compareInput.value.trim().toLowerCase();
      if (!val || !currentHashData) {
        if (compareResult) compareResult.classList.add('hidden');
        return;
      }
      const match = val === currentHashData.md5?.toLowerCase() ||
                    val === currentHashData.sha1?.toLowerCase() ||
                    val === currentHashData.sha256?.toLowerCase();
      if (compareResult) {
        compareResult.classList.remove('hidden');
        if (match) {
          compareResult.className = 'hash-result-badge success';
          compareResult.innerHTML = '✅ 完美匹配！文件完整无损无篡改';
        } else {
          compareResult.className = 'hash-result-badge danger';
          compareResult.innerHTML = '❌ 未匹配，请核对官方哈希字符串';
        }
      }
    };
  }
}

function closeHashModal() {
  const modal = document.getElementById('hashModal');
  if (modal) modal.classList.add('hidden');
  currentHashData = null;
}

// ==========================================================================
// 📱 Mobile Cast & LAN QR Code Engine
// ==========================================================================
// ==========================================================================
// 📱 Mobile Cast & LAN QR Code Engine (Standard 100% Genuine Compliant)
// ==========================================================================
function renderQrToCanvas(canvas, text) {
  if (!canvas || !text) return;
  try {
    if (typeof QRCode !== 'undefined') {
      const size = canvas.width || 180;
      new QRCode(canvas, {
        text: text,
        width: size,
        height: size,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  } catch (e) {
    console.error('QR Render Error:', e);
  }
}

async function openMobileCastModal() {
  const modal = document.getElementById('mobileCastModal');
  const canvas = document.getElementById('qrCanvas');
  const lanUrlText = document.getElementById('lanUrlText');
  if (!modal) return;

  if (nativeApi?.getLanInfo) {
    try {
      const info = await nativeApi.getLanInfo();
      if (lanUrlText) lanUrlText.textContent = info.url;
      renderQrToCanvas(canvas, info.url);
    } catch (e) {}
  }
  modal.classList.remove('hidden');
}

function closeMobileCastModal() {
  const modal = document.getElementById('mobileCastModal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================================================
// 🎞️ FFmpeg Video Lossless Trimmer & GIF Maker Operations
// ==========================================================================
let currentTrimTask = null;

function formatSecondsToHms(sec) {
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function parseHmsToSeconds(hms) {
  const parts = String(hms).trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(hms) || 0;
}

function openTrimModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task || !task.savePath) return showToast('未找到可剪辑的文件');
  currentTrimTask = task;

  const modal = document.getElementById('trimModal');
  const nameEl = document.getElementById('trimFileName');
  const video = document.getElementById('trimVideoPlayer');
  const startInput = document.getElementById('trimStartTime');
  const endInput = document.getElementById('trimEndTime');
  const progressText = document.getElementById('trimProgressText');

  if (nameEl) nameEl.textContent = task.name || (task.savePath.split(/[\/\\]/).pop());
  if (startInput) startInput.value = '00:00:00';
  if (endInput) endInput.value = '00:00:10';
  if (progressText) progressText.classList.add('hidden');

  if (video) {
    video.src = `media://${encodeURIComponent(task.savePath)}`;
    video.onloadedmetadata = () => {
      if (endInput) {
        const dur = Math.min(video.duration || 10, 10);
        endInput.value = formatSecondsToHms(dur);
      }
    };
  }

  if (modal) modal.classList.remove('hidden');
}

function closeTrimModal() {
  const modal = document.getElementById('trimModal');
  const video = document.getElementById('trimVideoPlayer');
  if (video) { video.pause(); video.src = ''; }
  if (modal) modal.classList.add('hidden');
  currentTrimTask = null;
}

// ==========================================================================
// 🔄 Refresh Expired Download URL Modal (换链续传)
// ==========================================================================
function openRefreshUrlModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return showToast('未找到该任务');
  currentRefreshTaskId = taskId;

  const modal = document.getElementById('refreshUrlModal');
  const titleEl = document.getElementById('refreshUrlTaskTitle');
  const input = document.getElementById('newUrlInput');

  if (titleEl) titleEl.textContent = `任务: ${task.name || task.url}`;
  if (input) input.value = '';

  if (modal) modal.classList.remove('hidden');
}

function closeRefreshUrlModal() {
  const modal = document.getElementById('refreshUrlModal');
  if (modal) modal.classList.add('hidden');
  currentRefreshTaskId = null;
}

// ==========================================================================
// 🧹 Batch Selection & Batch Actions
// ==========================================================================
function updateBatchActionBar() {
  const bar = document.getElementById('batchActionBar');
  const countEl = document.getElementById('batchSelectedCount');
  const count = selectedTaskIds.size;

  if (countEl) countEl.textContent = count;
  if (bar) {
    if (count > 0) bar.classList.remove('hidden');
    else bar.classList.add('hidden');
  }
}

function clearTaskSelection() {
  selectedTaskIds.clear();
  updateBatchActionBar();
  renderTasks();
}

// ==========================================================================
// 📊 History Data Export (CSV & JSON)
// ==========================================================================
function exportHistoryToCsv() {
  if (!tasks.length) return showToast('暂无下载历史可导出');
  const headers = ['ID', '任务名称', '下载链接', '状态', '文件大小', '进度', '创建时间', '保存路径'];
  const rows = tasks.map(t => [
    `"${t.id}"`,
    `"${(t.name || '').replace(/"/g, '""')}"`,
    `"${(t.url || '').replace(/"/g, '""')}"`,
    `"${t.status}"`,
    `"${t.size || t.downloaded || 0}"`,
    `"${Math.round(t.progress || 0)}%"`,
    `"${new Date(t.createdAt || Date.now()).toLocaleString()}"`,
    `"${(t.savePath || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `全能下载器_历史记录_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  playSound('pop');
  showToast('📊 下载历史 CSV 导出成功！');
}

function exportHistoryToJson() {
  if (!tasks.length) return showToast('暂无下载历史可导出');
  const jsonContent = JSON.stringify(tasks, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `全能下载器_历史备份_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  playSound('pop');
  showToast('📋 下载历史 JSON 备份导出成功！');
}

// Bind Global UI Events
document.addEventListener('DOMContentLoaded', () => {
  // Navigation filter clicks
  document.querySelectorAll('.nav[data-filter]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.nav[data-filter]').forEach(n => n.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      const pageTitle = document.getElementById('pageTitle');
      if (pageTitle) {
        const titlesMap = {
          all: 'allTasks',
          downloading: 'downloading',
          completed: 'completed',
          paused: 'paused',
          failed: 'failed',
          'channel-torrent': currentLang === 'zh' ? '🧲 磁力/BT种子专区' : '🧲 Magnet & BT Channel',
          'channel-sniffer': currentLang === 'zh' ? '⚡ 网页透视流专区' : '⚡ Web Sniffer Streams',
          'channel-video': currentLang === 'zh' ? '🎬 网页视频解析专区' : '🎬 Web Video Channel',
          'channel-audio': currentLang === 'zh' ? '🎵 纯音频提取专区' : '🎵 Audio Extractor Channel',
          'channel-file': currentLang === 'zh' ? '📦 通用文件直链专区' : '📦 Direct File Channel'
        };
        const titleVal = titlesMap[currentFilter] || 'allTasks';
        pageTitle.innerHTML = titleVal.startsWith('channel') || titleVal.includes('专区') || titleVal.includes('Channel') || titleVal.includes('Streams') ? titleVal : t(titleVal);
      }
      renderTasks();
    };
  });

  // Settings Tabs Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-${btn.dataset.tab}`);
      if (targetPane) targetPane.classList.add('active');
    };
  });

  // Mode Selector Pills
  document.querySelectorAll('.mode-pill').forEach(pill => {
    pill.onclick = () => setDownloadMode(pill.dataset.mode);
  });

  // URL Input listener for smart sniffer
  const urlInput = document.getElementById('urlInput');
  if (urlInput) {
    urlInput.addEventListener('input', handleUrlInputSniff);
    urlInput.addEventListener('paste', () => setTimeout(handleUrlInputSniff, 100));
  }

  // Playlist Sniffer Button
  const sniffPlaylistBtn = document.getElementById('sniffPlaylistBtn');
  if (sniffPlaylistBtn) {
    sniffPlaylistBtn.onclick = async () => {
      if (!nativeApi?.sniffPlaylist) return;
      const urlIn = document.getElementById('urlInput');
      const text = (urlIn?.value || '').trim();
      if (!text) return showToast('请先输入要嗅探的多P/合集链接');

      sniffPlaylistBtn.disabled = true;
      sniffPlaylistBtn.textContent = '嗅探合集中...';
      try {
        const data = await nativeApi.sniffPlaylist(text);
        openPlaylistModal(data);
      } catch (err) {
        showToast(err.message || '未识别到合集/多P播放列表');
      } finally {
        sniffPlaylistBtn.disabled = false;
        sniffPlaylistBtn.textContent = '🎬 批量嗅探合集/多P';
      }
    };
  }

  // Schedule Chips in Add Task Modal
  document.querySelectorAll('.schedule-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('.schedule-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const mode = chip.dataset.time;
      if (mode === 'now') {
        selectedScheduleTime = null;
      } else if (mode === '1h') {
        selectedScheduleTime = new Date(Date.now() + 3600 * 1000).toISOString();
      } else if (mode === '2h') {
        selectedScheduleTime = new Date(Date.now() + 7200 * 1000).toISOString();
      } else if (mode === 'night') {
        const d = new Date();
        d.setHours(2, 0, 0, 0);
        if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
        selectedScheduleTime = d.toISOString();
      }
    };
  });

  // Naming Pattern Token Chips
  document.querySelectorAll('.token-chip').forEach(chip => {
    chip.onclick = () => {
      const token = chip.dataset.token;
      const namingInput = document.getElementById('namingPattern');
      if (namingInput) {
        namingInput.value += (namingInput.value.endsWith('/') || namingInput.value === '' ? '' : ' - ') + token;
        updateNamingPreview();
      }
    };
  });

  const namingPatternInput = document.getElementById('namingPattern');
  if (namingPatternInput) {
    namingPatternInput.oninput = updateNamingPreview;
  }

  // Language selector
  const langSelect = document.getElementById('language');
  if (langSelect) {
    langSelect.onchange = e => {
      currentLang = e.target.value;
      localStorage.setItem('language', currentLang);
      applyLanguage();
    };
  }

  // Theme switcher
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.onclick = () => {
      isDarkTheme = !isDarkTheme;
      localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
      applyTheme();
    };
  }

  // Modal Open / Close buttons
  const addBtn = document.getElementById('addBtn');
  const emptyAdd = document.getElementById('emptyAdd');
  const closeModal = document.getElementById('closeModal');
  const cancelModal = document.getElementById('cancelModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettings = document.getElementById('closeSettings');
  const cancelSettings = document.getElementById('cancelSettings');
  const closePlaylist = document.getElementById('closePlaylist');
  const cancelPlaylist = document.getElementById('cancelPlaylist');
  const closeHash = document.getElementById('closeHash');
  const closeHashBtn = document.getElementById('closeHashBtn');
  const closePreview = document.getElementById('closePreview');

  if (addBtn) addBtn.onclick = () => openAddModal();
  if (emptyAdd) emptyAdd.onclick = () => openAddModal();
  if (closeModal) closeModal.onclick = closeAddModal;
  if (cancelModal) cancelModal.onclick = closeAddModal;
  if (settingsBtn) settingsBtn.onclick = () => nativeApi ? openSettingsModal() : showToast('请从安装版客户端运行');
  if (closeSettings) closeSettings.onclick = closeSettingsModal;
  if (cancelSettings) cancelSettings.onclick = closeSettingsModal;
  if (closePlaylist) closePlaylist.onclick = closePlaylistModal;
  if (cancelPlaylist) cancelPlaylist.onclick = closePlaylistModal;
  if (closeHash) closeHash.onclick = closeHashModal;
  if (closeHashBtn) closeHashBtn.onclick = closeHashModal;
  if (closePreview) closePreview.onclick = closePreviewModal;

  // Search & Sort filters
  const searchInput = document.getElementById('search');
  const sortSelect = document.getElementById('sort');
  if (searchInput) searchInput.oninput = renderTasks;
  if (sortSelect) sortSelect.onchange = renderTasks;

  // Mode pills click event
  document.querySelectorAll('#modalChannelPills .mode-pill').forEach(pill => {
    pill.onclick = () => {
      setDownloadMode(pill.dataset.mode);
      playSound('pop');
    };
  });

  // Modal Sniffer Button
  const modalLaunchSnifferBtn = document.getElementById('modalLaunchSnifferBtn');
  if (modalLaunchSnifferBtn) {
    modalLaunchSnifferBtn.onclick = () => {
      const url = document.getElementById('modalSnifferUrlInput')?.value?.trim() || 'https://www.bilibili.com';
      if (nativeApi?.openWebSniffer) {
        nativeApi.openWebSniffer(url);
        showToast('🌐 网页透视嗅探窗口已启动，播放视频时媒体流将实时显示在下方！');
      }
    };
  }

  // Modal Torrent Buttons
  const modalPickTorrentBtn = document.getElementById('modalPickTorrentBtn');
  if (modalPickTorrentBtn) {
    modalPickTorrentBtn.onclick = async () => {
      if (!nativeApi?.pickTorrentFile) return;
      const res = await nativeApi.pickTorrentFile();
      if (res) {
        document.getElementById('modalTorrentInput').value = res.filePath;
        modalTorrentData = res;
        renderModalTorrentData(res);
        showToast('✨ 种子文件解析完成！');
      }
    };
  }

  const modalParseTorrentBtn = document.getElementById('modalParseTorrentBtn');
  if (modalParseTorrentBtn) {
    modalParseTorrentBtn.onclick = () => handleModalParseTorrent();
  }

  const modalSelectTorrentAll = document.getElementById('modalSelectTorrentAll');
  if (modalSelectTorrentAll) {
    modalSelectTorrentAll.onclick = () => {
      if (!modalTorrentData?.files) return;
      modalTorrentData.files.forEach(f => { f.selected = true; });
      document.querySelectorAll('.modal-torrent-file-checkbox').forEach(cb => { cb.checked = true; });
      updateModalTorrentSelectedCount();
    };
  }

  const modalSelectTorrentVideoOnly = document.getElementById('modalSelectTorrentVideoOnly');
  if (modalSelectTorrentVideoOnly) {
    modalSelectTorrentVideoOnly.onclick = () => {
      if (!modalTorrentData?.files) return;
      const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm', '.ts', '.m4v'];
      modalTorrentData.files.forEach(f => {
        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
        f.selected = videoExts.includes(ext);
      });
      document.querySelectorAll('.modal-torrent-file-checkbox').forEach(cb => {
        const idx = Number(cb.dataset.idx);
        cb.checked = !!modalTorrentData.files[idx]?.selected;
      });
      updateModalTorrentSelectedCount();
    };
  }

  const modalSelectTorrentNone = document.getElementById('modalSelectTorrentNone');
  if (modalSelectTorrentNone) {
    modalSelectTorrentNone.onclick = () => {
      if (!modalTorrentData?.files) return;
      modalTorrentData.files.forEach(f => { f.selected = false; });
      document.querySelectorAll('.modal-torrent-file-checkbox').forEach(cb => { cb.checked = false; });
      updateModalTorrentSelectedCount();
    };
  }

  // Start Download submission across all channels
  const startDownloadBtn = document.getElementById('startDownload');
  if (startDownloadBtn) {
    startDownloadBtn.onclick = async () => {
      if (!nativeApi) return showToast('请在桌面应用中启动下载');

      // Case 1: Torrent / Magnet Channel
      if (currentMode === 'torrent') {
        const tInput = document.getElementById('modalTorrentInput')?.value?.trim();
        if (!modalTorrentData && !tInput) return showToast('请输入磁力链接或选择种子文件');
        if (!modalTorrentData && tInput) {
          try {
            modalTorrentData = await nativeApi.parseTorrent(tInput);
            renderModalTorrentData(modalTorrentData);
          } catch (e) {
            return showToast('种子解析失败: ' + e.message);
          }
        }
        const selected = modalTorrentData?.files?.filter(f => f.selected) || [];
        if (selected.length === 0) return showToast('请至少勾选一个需要下载的文件');

        const isAudio = selected.every(f => ['.mp3', '.flac', '.wav', '.aac', '.m4a'].some(ext => f.name.toLowerCase().endsWith(ext)));
        try {
          const taskPayload = {
            url: modalTorrentData.url || modalTorrentData.filePath || ('magnet:?xt=urn:btih:' + modalTorrentData.hash),
            name: modalTorrentData.name || 'Torrent Download',
            size: selected.reduce((sum, f) => sum + (f.size || 0), 0),
            mode: isAudio ? 'audio' : 'video',
            startAt: selectedScheduleTime || null
          };
          await nativeApi.addTask(taskPayload);
          closeAddModal();
          showToast('🚀 BT 种子/磁力任务已建立并加入满速下载队列！');
        } catch (err) {
          showToast(err.message || '添加任务失败');
        }
        return;
      }

      // Case 2: Sniffer Channel
      if (currentMode === 'sniffer') {
        const sUrl = document.getElementById('modalSnifferUrlInput')?.value?.trim();
        if (sUrl && (sUrl.includes('.m3u8') || sUrl.includes('.mp4') || sUrl.includes('.ts') || sUrl.includes('.mpd'))) {
          try {
            await nativeApi.addTask({
              url: sUrl,
              name: 'sniffed_stream_' + Date.now(),
              type: 'video',
              mode: 'video',
              quality: 'best',
              isDirectStream: true,
              startAt: selectedScheduleTime || null
            });
            closeAddModal();
            showToast('🚀 网页透视直链已加入下载队列！');
          } catch (e) {
            showToast(e.message || '添加任务失败');
          }
          return;
        }
        return showToast('请在上方启动嗅探窗口播放视频，或在列表中点击「立即下载此流」');
      }

      // Case 3: Video / Audio / File Standard Channels
      const urlIn = document.getElementById('urlInput');
      const nameIn = document.getElementById('nameInput');
      const videoQuality = document.getElementById('videoQuality');
      const audioQuality = document.getElementById('audioQuality');

      const rawText = (urlIn?.value || '').trim();
      let rawUrls = [];
      if (nativeApi.extractUrls) {
        try {
          const extracted = await nativeApi.extractUrls(rawText);
          rawUrls = extracted.urls || [];
        } catch (e) {}
      }
      if (!rawUrls.length) {
        rawUrls = rawText.split(/\r?\n/).map(u => u.trim()).filter(Boolean);
      }
      if (!rawUrls.length) return showToast('请输入或粘贴有效的下载链接');

      const isMulti = rawUrls.length > 1;
      const payload = rawUrls.map(url => ({
        url,
        name: !isMulti && nameIn?.value ? nameIn.value.trim() : (currentSniffData?.title || ''),
        thumbnail: currentSniffData?.thumbnail || '',
        type: currentMode === 'audio' ? 'audio' : (currentMode === 'video' ? 'video' : 'file'),
        mode: currentMode,
        quality: videoQuality?.value || 'best',
        audioQuality: audioQuality?.value || 'best',
        downloadDanmaku: settings.downloadDanmaku,
        startAt: selectedScheduleTime || null,
        autoShutdown: settings.autoShutdown
      }));

      try {
        await nativeApi.addBatch(payload);
        closeAddModal();
        showToast(selectedScheduleTime ? `⏰ 已创建 ${payload.length} 个定时计划下载任务` : `✨ 智能提纯完成：已添加 ${payload.length} 个下载任务`);
      } catch (err) {
        showToast(err.message || '添加任务失败');
      }
    };
  }

  // Playlist selection buttons
  const btnSelectAll = document.getElementById('btnSelectAll');
  const btnSelectInverse = document.getElementById('btnSelectInverse');
  const btnSelectTop10 = document.getElementById('btnSelectTop10');
  const btnSelectTop30 = document.getElementById('btnSelectTop30');
  const playlistSearch = document.getElementById('playlistSearchInput');
  const playlistContainer = document.getElementById('playlistEpisodesList');
  const confirmPlaylistBtn = document.getElementById('confirmPlaylistDownload');

  if (btnSelectAll && playlistContainer) {
    btnSelectAll.onclick = () => {
      playlistContainer.querySelectorAll('.episode-checkbox').forEach(cb => {
        cb.checked = true;
        cb.closest('.episode-item-row')?.classList.add('selected');
      });
      updatePlaylistSelectedCount();
    };
  }

  if (btnSelectInverse && playlistContainer) {
    btnSelectInverse.onclick = () => {
      playlistContainer.querySelectorAll('.episode-checkbox').forEach(cb => {
        cb.checked = !cb.checked;
        cb.closest('.episode-item-row')?.classList.toggle('selected', cb.checked);
      });
      updatePlaylistSelectedCount();
    };
  }

  if (btnSelectTop10 && playlistContainer) {
    btnSelectTop10.onclick = () => {
      playlistContainer.querySelectorAll('.episode-item-row').forEach((row, i) => {
        const cb = row.querySelector('.episode-checkbox');
        if (cb) {
          cb.checked = i < 10;
          row.classList.toggle('selected', cb.checked);
        }
      });
      updatePlaylistSelectedCount();
    };
  }

  if (btnSelectTop30 && playlistContainer) {
    btnSelectTop30.onclick = () => {
      playlistContainer.querySelectorAll('.episode-item-row').forEach((row, i) => {
        const cb = row.querySelector('.episode-checkbox');
        if (cb) {
          cb.checked = i < 30;
          row.classList.toggle('selected', cb.checked);
        }
      });
      updatePlaylistSelectedCount();
    };
  }

  if (playlistSearch && playlistContainer) {
    playlistSearch.oninput = () => {
      const q = (playlistSearch.value || '').toLowerCase().trim();
      playlistContainer.querySelectorAll('.episode-item-row').forEach(row => {
        const title = (row.querySelector('.episode-title')?.textContent || '').toLowerCase();
        const idx = (row.querySelector('.episode-idx')?.textContent || '').toLowerCase();
        row.style.display = (!q || title.includes(q) || idx.includes(q)) ? 'flex' : 'none';
      });
    };
  }

  if (playlistContainer) {
    playlistContainer.onclick = e => {
      const row = e.target.closest('.episode-item-row');
      if (!row) return;
      const cb = row.querySelector('.episode-checkbox');
      if (e.target !== cb && cb) {
        cb.checked = !cb.checked;
      }
      row.classList.toggle('selected', cb?.checked);
      updatePlaylistSelectedCount();
    };
  }

  if (confirmPlaylistBtn) {
    confirmPlaylistBtn.onclick = async () => {
      if (!currentPlaylistData || !nativeApi) return;
      const checkedRows = playlistContainer?.querySelectorAll('.episode-item-row:has(.episode-checkbox:checked)') || [];
      if (checkedRows.length === 0) return showToast('请至少选择一集');

      const checkedIds = new Set(Array.from(checkedRows).map(r => r.dataset.id));
      const selectedEntries = currentPlaylistData.entries.filter(ep => checkedIds.has(String(ep.id)));

      const payload = selectedEntries.map(ep => ({
        url: ep.url,
        name: ep.title,
        thumbnail: ep.thumbnail,
        type: 'video',
        quality: 'best',
        downloadDanmaku: settings.downloadDanmaku
      }));

      try {
        await nativeApi.addBatch(payload);
        closePlaylistModal();
        closeAddModal();
        showToast(`🎉 成功添加 ${payload.length} 个分集任务到下载队列！`);
      } catch (err) {
        showToast(err.message || '添加分集任务失败');
      }
    };
  }

  // Hash Compare Input live matching
  const hashCompareInput = document.getElementById('hashCompareInput');
  const hashCompareResult = document.getElementById('hashCompareResult');
  if (hashCompareInput && hashCompareResult) {
    hashCompareInput.oninput = () => {
      const val = hashCompareInput.value.trim().toLowerCase();
      if (!val || !currentHashData) {
        hashCompareResult.classList.add('hidden');
        return;
      }
      const match = val === currentHashData.md5.toLowerCase() || val === currentHashData.sha256.toLowerCase();
      hashCompareResult.classList.remove('hidden');
      if (match) {
        hashCompareResult.className = 'hash-result-badge match';
        hashCompareResult.innerHTML = `✅ <strong>哈希值完全匹配！</strong> 文件完整无损，与官方完全一致。`;
      } else {
        hashCompareResult.className = 'hash-result-badge mismatch';
        hashCompareResult.innerHTML = `❌ <strong>哈希值不匹配！</strong> 请核对是否输入正确或文件可能损坏。`;
      }
    };
  }

  // Copy Hash buttons
  document.querySelectorAll('.copy-hash-btn').forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.dataset.target;
      const val = document.getElementById(targetId)?.textContent;
      if (val && !val.includes('...')) {
        navigator.clipboard.writeText(val);
        showToast('哈希值已复制到剪贴板');
      }
    };
  });

  // Pause all
  const pauseAllBtn = document.getElementById('pauseAll');
  if (pauseAllBtn) {
    pauseAllBtn.onclick = async () => {
      if (nativeApi) {
        await nativeApi.all('pause');
        showToast(t('pauseAll'));
      }
    };
  }

  // Task list action buttons event delegation & Checkbox selection
  const taskListEl = document.getElementById('taskList');
  if (taskListEl) {
    taskListEl.onclick = async e => {
      // Checkbox click or shift click
      const cb = e.target.closest('.task-checkbox');
      if (cb) {
        const id = cb.dataset.id;
        if (e.shiftKey && lastCheckedTaskId && lastCheckedTaskId !== id) {
          const allIds = tasks.map(t => t.id);
          const idx1 = allIds.indexOf(lastCheckedTaskId);
          const idx2 = allIds.indexOf(id);
          const [start, end] = [Math.min(idx1, idx2), Math.max(idx1, idx2)];
          for (let i = start; i <= end; i++) {
            if (cb.checked) selectedTaskIds.add(allIds[i]);
            else selectedTaskIds.delete(allIds[i]);
          }
        } else {
          if (cb.checked) selectedTaskIds.add(id);
          else selectedTaskIds.delete(id);
          lastCheckedTaskId = id;
        }
        updateBatchActionBar();
        renderTasks();
        return;
      }

      const button = e.target.closest('button[data-pause], button[data-resume], button[data-cancel], button[data-show], button[data-hash], button[data-preview], button[data-prioritize], button[data-trim], button[data-refresh-url], button[data-convert]');
      if (!button || !nativeApi) return;
      const d = button.dataset;
      button.disabled = true;
      try {
        if (d.preview) openPreviewModal(d.preview);
        if (d.convert) openConvertModal(d.convert);
        if (d.refreshUrl) openRefreshUrlModal(d.refreshUrl);
        if (d.prioritize) {
          await nativeApi.prioritizeTask(d.prioritize);
          playSound('pop');
          showToast('⬆️ 已置顶任务，排队到最前！');
        }
        if (d.trim) openTrimModal(d.trim);
        if (d.pause) await nativeApi.pause(d.pause);
        if (d.resume) await nativeApi.resume(d.resume);
        if (d.cancel) {
          await nativeApi.cancel(d.cancel);
          tasks = tasks.filter(t => t.id !== d.cancel);
          selectedTaskIds.delete(d.cancel);
          updateBatchActionBar();
          renderTasks();
          playSound('delete');
          showToast('已删除任务');
        }
        if (d.show) await nativeApi.show(d.show);
        if (d.hash) openHashModal(d.hash);
      } catch (err) {
        showToast(err.message || '操作执行失败');
      } finally {
        button.disabled = false;
      }
    };
  }

  // Clear Completed Tasks
  const clearCompletedBtn = document.getElementById('clearCompletedBtn');
  if (clearCompletedBtn) {
    clearCompletedBtn.onclick = async () => {
      if (!nativeApi?.clearCompleted) return;
      const count = await nativeApi.clearCompleted();
      tasks = tasks.filter(t => t.status === 'queued' || t.status === 'downloading' || t.status === 'paused' || t.status === 'scheduled');
      selectedTaskIds.clear();
      updateBatchActionBar();
      renderTasks();
      playSound('delete');
      showToast(currentLang === 'zh'
        ? `🧹 已清空 ${count} 个已完成/已失效历史任务！`
        : `🧹 Cleared ${count} completed/expired tasks!`);
    };
  }

  // Batch Action Bar Handlers
  const batchPauseBtn = document.getElementById('batchPauseBtn');
  const batchResumeBtn = document.getElementById('batchResumeBtn');
  const batchDeleteBtn = document.getElementById('batchDeleteBtn');
  const batchCancelBtn = document.getElementById('batchCancelBtn');
  const batchDeleteFileCheck = document.getElementById('batchDeleteFileCheck');

  if (batchPauseBtn) {
    batchPauseBtn.onclick = async () => {
      if (!nativeApi) return;
      for (const id of selectedTaskIds) {
        await nativeApi.pause(id);
      }
      showToast(currentLang === 'zh'
        ? `⏸️ 已批量暂停 ${selectedTaskIds.size} 个任务`
        : `⏸️ Paused ${selectedTaskIds.size} tasks`);
      clearTaskSelection();
    };
  }

  if (batchResumeBtn) {
    batchResumeBtn.onclick = async () => {
      if (!nativeApi) return;
      for (const id of selectedTaskIds) {
        await nativeApi.resume(id);
      }
      showToast(currentLang === 'zh'
        ? `▶️ 已批量恢复 ${selectedTaskIds.size} 个任务`
        : `▶️ Resumed ${selectedTaskIds.size} tasks`);
      clearTaskSelection();
    };
  }

  if (batchDeleteBtn) {
    batchDeleteBtn.onclick = async () => {
      if (!nativeApi) return;
      const deleteFile = !!batchDeleteFileCheck?.checked;
      const count = selectedTaskIds.size;
      for (const id of selectedTaskIds) {
        if (nativeApi.deleteTask) await nativeApi.deleteTask(id, deleteFile);
        else await nativeApi.cancel(id);
        tasks = tasks.filter(t => t.id !== id);
      }
      playSound('delete');
      showToast(deleteFile
        ? (currentLang === 'zh' ? `🗑️ 已批量删除 ${count} 个任务及其本地实体文件！` : `🗑️ Deleted ${count} tasks and local files!`)
        : (currentLang === 'zh' ? `🗑️ 已批量移除 ${count} 个任务` : `🗑️ Removed ${count} tasks`));
      clearTaskSelection();
    };
  }

  if (batchCancelBtn) {
    batchCancelBtn.onclick = clearTaskSelection;
  }

  // Refresh URL Modal Handlers
  const closeRefreshUrl = document.getElementById('closeRefreshUrl');
  const cancelRefreshUrlBtn = document.getElementById('cancelRefreshUrlBtn');
  const confirmRefreshUrlBtn = document.getElementById('confirmRefreshUrlBtn');

  if (closeRefreshUrl) closeRefreshUrl.onclick = closeRefreshUrlModal;
  if (cancelRefreshUrlBtn) cancelRefreshUrlBtn.onclick = closeRefreshUrlModal;
  if (confirmRefreshUrlBtn) {
    confirmRefreshUrlBtn.onclick = async () => {
      if (!currentRefreshTaskId || !nativeApi?.refreshTaskUrl) return;
      const input = document.getElementById('newUrlInput');
      const newUrl = (input?.value || '').trim();
      if (!newUrl) return showToast('请输入新的有效直链');

      confirmRefreshUrlBtn.disabled = true;
      confirmRefreshUrlBtn.textContent = '更新中...';
      try {
        await nativeApi.refreshTaskUrl(currentRefreshTaskId, newUrl);
        playSound('success');
        showToast('🚀 已成功更新直链并启动无缝续传！');
        closeRefreshUrlModal();
      } catch (err) {
        showToast(err.message || '更新链接失败');
      } finally {
        confirmRefreshUrlBtn.disabled = false;
        confirmRefreshUrlBtn.textContent = '🚀 立即更新并无缝续传';
      }
    };
  }

  // Export CSV & JSON Handlers
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  if (exportCsvBtn) exportCsvBtn.onclick = exportHistoryToCsv;
  if (exportJsonBtn) exportJsonBtn.onclick = exportHistoryToJson;

  // Proxy Presets & Port Chips & Test Latency
  document.querySelectorAll('.proxy-preset-card').forEach(card => {
    card.onclick = () => {
      document.querySelectorAll('.proxy-preset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentProxyMode = card.dataset.preset;
      const pProto = document.getElementById('proxyProtocol');
      const pHost = document.getElementById('proxyHost');
      const pPort = document.getElementById('proxyPort');

      if (currentProxyMode === 'clash') {
        if (pProto) pProto.value = 'http';
        if (pHost) pHost.value = '127.0.0.1';
        if (pPort) pPort.value = '7890';
        showToast('已选用 Clash / Mihomo 预设 (7890)');
      } else if (currentProxyMode === 'v2ray') {
        if (pProto) pProto.value = 'http';
        if (pHost) pHost.value = '127.0.0.1';
        if (pPort) pPort.value = '10808';
        showToast('已选用 v2rayN 预设 (HTTP 10808)');
      } else if (currentProxyMode === 'ss') {
        if (pProto) pProto.value = 'socks5';
        if (pHost) pHost.value = '127.0.0.1';
        if (pPort) pPort.value = '1080';
        showToast('已选用 Shadowsocks 预设 (1080)');
      } else if (currentProxyMode === 'direct') {
        showToast('已选用直连模式 (不使用代理)');
      } else if (currentProxyMode === 'system') {
        showToast('已选用跟随 Windows 系统全局代理');
      }
    };
  });

  document.querySelectorAll('.port-chip').forEach(chip => {
    chip.onclick = () => {
      const port = chip.dataset.port;
      const proto = chip.dataset.proto;
      const pPort = document.getElementById('proxyPort');
      const pProto = document.getElementById('proxyProtocol');
      if (pPort) pPort.value = port;
      if (pProto) pProto.value = proto;
      document.querySelectorAll('.proxy-preset-card').forEach(c => c.classList.remove('active'));
      document.querySelector('.proxy-preset-card[data-preset="custom"]')?.classList.add('active');
      currentProxyMode = 'custom';
      showToast(`已快捷填入端口: ${port} (${proto.toUpperCase()})`);
    };
  });

  const testProxyBtn = document.getElementById('testProxyBtn');
  const proxyTestStatus = document.getElementById('proxyTestStatus');
  if (testProxyBtn && proxyTestStatus) {
    testProxyBtn.onclick = async () => {
      if (!nativeApi?.testProxy) return;
      const pProto = document.getElementById('proxyProtocol')?.value || 'http';
      const pHost = document.getElementById('proxyHost')?.value || '127.0.0.1';
      const pPort = document.getElementById('proxyPort')?.value || '7890';
      let testUrl = `${pProto}://${pHost}:${pPort}`;
      if (currentProxyMode === 'direct') testUrl = 'direct';
      if (currentProxyMode === 'system') testUrl = 'system';

      testProxyBtn.disabled = true;
      proxyTestStatus.className = 'proxy-test-pill';
      proxyTestStatus.textContent = '⚡ 正在测速 YouTube...';

      try {
        const res = await nativeApi.testProxy(testUrl);
        if (res.ok) {
          proxyTestStatus.className = 'proxy-test-pill ok';
          proxyTestStatus.textContent = `🟢 连通正常 · 延迟 ${res.latency}ms (${res.target})`;
          showToast(`代理连通测试成功 (延迟 ${res.latency}ms)`);
        } else {
          proxyTestStatus.className = 'proxy-test-pill err';
          proxyTestStatus.textContent = `🔴 无法连通 (${res.error.slice(0, 25)})`;
          showToast('代理连接失败，请确认客户端已开启');
        }
      } catch (err) {
        proxyTestStatus.className = 'proxy-test-pill err';
        proxyTestStatus.textContent = '🔴 测速失败';
      } finally {
        testProxyBtn.disabled = false;
      }
    };
  }

  // Settings Save & Pick Directory
  const pickDirBtn = document.getElementById('pickDir');
  if (pickDirBtn) {
    pickDirBtn.onclick = async () => {
      if (!nativeApi) return;
      const dir = await nativeApi.pickDirectory();
      if (dir) {
        const downloadDir = document.getElementById('downloadDir');
        if (downloadDir) downloadDir.value = dir;
      }
    };
  }

  const saveSettingsBtn = document.getElementById('saveSettings');
  if (saveSettingsBtn) {
    saveSettingsBtn.onclick = async () => {
      if (!nativeApi) return;
      try {
        const proxyRouting = document.querySelector('input[name="proxyRouting"]:checked')?.value || 'smart';
        settings = await nativeApi.saveSettings({
          downloadDir: document.getElementById('downloadDir')?.value,
          maxConcurrent: Number(document.getElementById('maxConcurrent')?.value || 3),
          segments: Number(document.getElementById('segments')?.value || 8),
          speedLimit: Number(document.getElementById('speedLimit')?.value || 0),
          retryCount: Number(document.getElementById('retryCount')?.value ?? 3),
          namingPattern: document.getElementById('namingPattern')?.value?.trim() || '{title}',
          proxyMode: currentProxyMode,
          proxyProtocol: document.getElementById('proxyProtocol')?.value || 'http',
          proxyHost: document.getElementById('proxyHost')?.value || '127.0.0.1',
          proxyPort: document.getElementById('proxyPort')?.value || '7890',
          proxyRouting,
          antiBanJitter: document.getElementById('antiBanJitter')?.checked,
          downloadDanmaku: document.getElementById('downloadDanmaku')?.checked,
          enableAutoCategory: document.getElementById('enableAutoCategory')?.checked,
          categoryFolders: {
            video: document.getElementById('catVideoFolder')?.value?.trim() || 'Videos',
            audio: document.getElementById('catAudioFolder')?.value?.trim() || 'Music',
            archive: document.getElementById('catArchiveFolder')?.value?.trim() || 'Archives',
            document: document.getElementById('catDocumentFolder')?.value?.trim() || 'Documents',
            picture: document.getElementById('catPictureFolder')?.value?.trim() || 'Pictures',
            other: document.getElementById('catOtherFolder')?.value?.trim() || 'Others'
          },
          timeSchedule: {
            enabled: !!document.getElementById('enableTimeSchedule')?.checked,
            peakStart: document.getElementById('peakStartTime')?.value || '08:00',
            peakEnd: document.getElementById('peakEndTime')?.value || '23:00',
            peakLimitKBps: Number(document.getElementById('peakLimitKBps')?.value || 2048),
            offPeakLimitKBps: Number(document.getElementById('offPeakLimitKBps')?.value || 0)
          },
          floatingWidget: document.getElementById('floatingWidget')?.checked,
          minimizeToTray: document.getElementById('minimizeToTray')?.checked,
          clipboardMonitor: document.getElementById('clipboardMonitor')?.checked,
          nativeNotifications: document.getElementById('nativeNotifications')?.checked,
          autoShutdown: document.getElementById('autoShutdown')?.checked,
          soundEffects: document.getElementById('soundEffects')?.checked !== false,
          ytDlpPath: document.getElementById('ytDlpPath')?.value,
          ffmpegPath: document.getElementById('ffmpegPath')?.value
        });
        closeSettingsModal();
        showToast(t('save'));
      } catch (err) {
        showToast(err.message || '保存设置失败');
      }
    };
  }

  // Cookie Platform Manager Event Delegation
  const cookieGrid = document.getElementById('cookiePlatformsGrid');
  if (cookieGrid) {
    cookieGrid.onclick = async e => {
      if (!nativeApi) return showToast('桌面环境未就绪');
      const loginBtn = e.target.closest('.login-cookie-btn');
      const importBtn = e.target.closest('.import-cookie-btn');
      const deleteBtn = e.target.closest('.delete-cookie-btn');

      if (loginBtn) {
        const site = loginBtn.dataset.site;
        showToast(`正在打开 ${site.toUpperCase()} 登录窗口，请在弹窗中扫码或登录...`);
        try {
          const res = await nativeApi.openLoginWindow(site);
          await refreshCookieProfiles();
          if (res?.success) {
            showToast(`✨ [${site.toUpperCase()}] 账号登录成功，凭据已自动无感同步就绪！`);
          } else {
            showToast(`[${site.toUpperCase()}] 登录窗口已关闭（未检测到登录，未保存凭据）`);
          }
        } catch (err) {
          showToast(err.message || '登录窗口异常');
        }
      } else if (importBtn) {
        const site = importBtn.dataset.site;
        const filePath = await nativeApi.pickCookieFile();
        if (!filePath) return;
        try {
          await nativeApi.importCookies(site, filePath);
          await refreshCookieProfiles();
          showToast(`[${site.toUpperCase()}] ${t('cookieImportSuccess')}`);
        } catch (err) {
          showToast(err.message || 'Cookie 导入失败');
        }
      } else if (deleteBtn) {
        const site = deleteBtn.dataset.site;
        try {
          if (nativeApi.deleteCookies) {
            await nativeApi.deleteCookies(site);
          }
          await refreshCookieProfiles();
          showToast(`[${site.toUpperCase()}] ${t('cookieDeleteSuccess')}`);
        } catch (err) {
          showToast(err.message || '清除失败');
        }
      }
    };
  }

  // Engine Diagnostic & Update Buttons
  const checkToolsBtn = document.getElementById('checkTools');
  if (checkToolsBtn) {
    checkToolsBtn.onclick = () => runDiagnosticCheck(false);
  }

  const updateYtDlpBtn = document.getElementById('updateYtDlpBtn');
  if (updateYtDlpBtn) {
    updateYtDlpBtn.onclick = async () => {
      if (!nativeApi?.updateYtDlp) return;
      updateYtDlpBtn.disabled = true;
      updateYtDlpBtn.textContent = '检查更新中...';
      try {
        const res = await nativeApi.updateYtDlp();
        showToast(res.output || 'yt-dlp 更新完毕');
        runDiagnosticCheck(true);
      } catch (e) {
        showToast(e.message || '内核升级失败');
      } finally {
        updateYtDlpBtn.disabled = false;
        updateYtDlpBtn.textContent = '在线升级 yt-dlp';
      }
    };
  }

  // Clipboard Detection Event
  const clipBanner = document.getElementById('clipboardBanner');
  const clipUrlText = document.getElementById('clipboardUrlText');
  // Mobile Cast Modal Events
  const mobileCastBtn = document.getElementById('mobileCastBtn');
  const closeMobileCast = document.getElementById('closeMobileCast');
  const copyLanUrlBtn = document.getElementById('copyLanUrlBtn');

  if (mobileCastBtn) mobileCastBtn.onclick = openMobileCastModal;
  if (closeMobileCast) closeMobileCast.onclick = closeMobileCastModal;
  if (copyLanUrlBtn) {
    copyLanUrlBtn.onclick = () => {
      const urlText = document.getElementById('lanUrlText')?.textContent;
      if (urlText) {
        navigator.clipboard.writeText(urlText);
        showToast('✨ 局域网网址已复制到剪贴板！');
      }
    };
  }

  // ==========================================================================
  // 💬 WhatsApp Contact Author & Cooperation Controllers
  // ==========================================================================
  const contactAuthorBtn = document.getElementById('contactAuthorBtn');
  const contactAuthorModal = document.getElementById('contactAuthorModal');
  const closeContactAuthor = document.getElementById('closeContactAuthor');
  const closeContactAuthorBtn = document.getElementById('closeContactAuthorBtn');
  const copyWhatsappBtn = document.getElementById('copyWhatsappBtn');
  const copyTelegramBtn = document.getElementById('copyTelegramBtn');
  const copyGmailBtn = document.getElementById('copyGmailBtn');
  const openWhatsappLinkBtn = document.getElementById('openWhatsappLinkBtn');
  const openTelegramLinkBtn = document.getElementById('openTelegramLinkBtn');
  const openGmailLinkBtn = document.getElementById('openGmailLinkBtn');
  const whatsappQrCanvas = document.getElementById('whatsappQrCanvas');
  const qrTabWhatsapp = document.getElementById('qrTabWhatsapp');
  const qrTabTelegram = document.getElementById('qrTabTelegram');
  const qrTabGmail = document.getElementById('qrTabGmail');
  const qrScanLabel = document.getElementById('qrScanLabel');

  let currentContactChannel = 'whatsapp';

  function renderContactQr(channel) {
    currentContactChannel = channel;
    if (channel === 'whatsapp') {
      if (qrTabWhatsapp) qrTabWhatsapp.classList.add('active');
      if (qrTabTelegram) qrTabTelegram.classList.remove('active');
      if (qrTabGmail) qrTabGmail.classList.remove('active');
      if (qrScanLabel) qrScanLabel.textContent = '📱 微信 / 相机扫码直达 WhatsApp 对话';
      if (whatsappQrCanvas) renderQrToCanvas(whatsappQrCanvas, 'https://wa.me/12498978869');
    } else if (channel === 'telegram') {
      if (qrTabTelegram) qrTabTelegram.classList.add('active');
      if (qrTabWhatsapp) qrTabWhatsapp.classList.remove('active');
      if (qrTabGmail) qrTabGmail.classList.remove('active');
      if (qrScanLabel) qrScanLabel.textContent = '✈️ 微信 / 相机扫码直达 Telegram 对话';
      if (whatsappQrCanvas) renderQrToCanvas(whatsappQrCanvas, 'https://t.me/woeken318');
    } else if (channel === 'gmail') {
      if (qrTabGmail) qrTabGmail.classList.add('active');
      if (qrTabWhatsapp) qrTabWhatsapp.classList.remove('active');
      if (qrTabTelegram) qrTabTelegram.classList.remove('active');
      if (qrScanLabel) qrScanLabel.textContent = '📧 手机扫码直接呼出邮箱应用撰写邮件';
      if (whatsappQrCanvas) renderQrToCanvas(whatsappQrCanvas, 'mailto:songfx.shop318318@gmail.com');
    }
  }

  function openContactModal() {
    if (contactAuthorModal) contactAuthorModal.classList.remove('hidden');
    renderContactQr(currentContactChannel || 'whatsapp');
    playSound('click');
  }

  function closeContactModal() {
    if (contactAuthorModal) contactAuthorModal.classList.add('hidden');
  }

  if (contactAuthorBtn) contactAuthorBtn.onclick = openContactModal;
  if (closeContactAuthor) closeContactAuthor.onclick = closeContactModal;
  if (closeContactAuthorBtn) closeContactAuthorBtn.onclick = closeContactModal;

  if (qrTabWhatsapp) qrTabWhatsapp.onclick = () => renderContactQr('whatsapp');
  if (qrTabTelegram) qrTabTelegram.onclick = () => renderContactQr('telegram');
  if (qrTabGmail) qrTabGmail.onclick = () => renderContactQr('gmail');

  if (copyWhatsappBtn) {
    copyWhatsappBtn.onclick = () => {
      navigator.clipboard.writeText('+1 (249) 897-8869');
      playSound('success');
      showToast('✨ WhatsApp 号码 (+1 (249) 897-8869) 已复制到剪贴板！');
    };
  }

  if (copyTelegramBtn) {
    copyTelegramBtn.onclick = () => {
      navigator.clipboard.writeText('@woeken318');
      playSound('success');
      showToast('✨ Telegram 账号 (@woeken318) 已复制到剪贴板！');
    };
  }

  if (copyGmailBtn) {
    copyGmailBtn.onclick = () => {
      navigator.clipboard.writeText('songfx.shop318318@gmail.com');
      playSound('success');
      showToast('✨ Gmail 邮箱 (songfx.shop318318@gmail.com) 已复制到剪贴板！');
    };
  }

  if (openWhatsappLinkBtn) {
    openWhatsappLinkBtn.onclick = () => {
      playSound('click');
      if (nativeApi?.openExternal) {
        nativeApi.openExternal('https://wa.me/12498978869');
      } else {
        window.open('https://wa.me/12498978869', '_blank');
      }
      showToast('🚀 正在为您打开 WhatsApp 聊天页面...');
    };
  }

  if (openTelegramLinkBtn) {
    openTelegramLinkBtn.onclick = () => {
      playSound('click');
      if (nativeApi?.openExternal) {
        nativeApi.openExternal('https://t.me/woeken318');
      } else {
        window.open('https://t.me/woeken318', '_blank');
      }
      showToast('🚀 正在为您打开 Telegram 页面...');
    };
  }

  if (openGmailLinkBtn) {
    openGmailLinkBtn.onclick = () => {
      playSound('click');
      if (nativeApi?.openExternal) {
        nativeApi.openExternal('mailto:songfx.shop318318@gmail.com?subject=全能下载器合作与技术咨询');
      } else {
        window.open('mailto:songfx.shop318318@gmail.com?subject=全能下载器合作与技术咨询', '_blank');
      }
      showToast('🚀 正在为您唤起本地邮件客户端...');
    };
  }

  // Trim & GIF Modal Events
  const closeTrim = document.getElementById('closeTrim');
  const setStartCurrentBtn = document.getElementById('setStartCurrentBtn');
  const setEndCurrentBtn = document.getElementById('setEndCurrentBtn');
  const doTrimMp4Btn = document.getElementById('doTrimMp4Btn');
  const doExportGifBtn = document.getElementById('doExportGifBtn');
  const trimVideoPlayer = document.getElementById('trimVideoPlayer');

  if (closeTrim) closeTrim.onclick = closeTrimModal;
  if (setStartCurrentBtn && trimVideoPlayer) {
    setStartCurrentBtn.onclick = () => {
      const t = trimVideoPlayer.currentTime || 0;
      document.getElementById('trimStartTime').value = formatSecondsToHms(t);
    };
  }
  if (setEndCurrentBtn && trimVideoPlayer) {
    setEndCurrentBtn.onclick = () => {
      const t = trimVideoPlayer.currentTime || 0;
      document.getElementById('trimEndTime').value = formatSecondsToHms(t);
    };
  }
  if (doTrimMp4Btn) {
    doTrimMp4Btn.onclick = async () => {
      if (!currentTrimTask || !nativeApi?.trimVideo) return;
      const start = parseHmsToSeconds(document.getElementById('trimStartTime').value);
      const end = parseHmsToSeconds(document.getElementById('trimEndTime').value);
      if (end <= start) return showToast('结束时间必须大于开始时间');

      const progressText = document.getElementById('trimProgressText');
      if (progressText) {
        progressText.classList.remove('hidden');
        progressText.textContent = '⚡ 正在 0.1 秒极速无损截取 MP4 (Stream Copy)...';
      }
      doTrimMp4Btn.disabled = true;

      try {
        const res = await nativeApi.trimVideo({
          filePath: currentTrimTask.savePath,
          startTime: start,
          endTime: end
        });
        showToast('🎉 无损视频切片截取成功！');
        if (nativeApi.show) nativeApi.show(res.outputPath);
        closeTrimModal();
      } catch (err) {
        showToast(err.message || '截取失败');
      } finally {
        doTrimMp4Btn.disabled = false;
        if (progressText) progressText.classList.add('hidden');
      }
    };
  }

  if (doExportGifBtn) {
    doExportGifBtn.onclick = async () => {
      if (!currentTrimTask || !nativeApi?.exportGif) return;
      const start = parseHmsToSeconds(document.getElementById('trimStartTime').value);
      const end = parseHmsToSeconds(document.getElementById('trimEndTime').value);
      if (end <= start) return showToast('结束时间必须大于开始时间');
      if (end - start > 60) return showToast('为保证动图流畅生成，建议 GIF 时长不超过 60 秒');

      const progressText = document.getElementById('trimProgressText');
      if (progressText) {
        progressText.classList.remove('hidden');
        progressText.textContent = '🎞️ 正在通过双通道调色板渲染高清 GIF 动图，请稍候...';
      }
      doExportGifBtn.disabled = true;

      try {
        const res = await nativeApi.exportGif({
          filePath: currentTrimTask.savePath,
          startTime: start,
          endTime: end
        });
        showToast('🎉 高清 GIF 动图导出成功！');
        if (nativeApi.show) nativeApi.show(res.outputPath);
        closeTrimModal();
      } catch (err) {
        showToast(err.message || '导出 GIF 失败');
      } finally {
        doExportGifBtn.disabled = false;
        if (progressText) progressText.classList.add('hidden');
      }
    };
  }

  // Smart Floating Clipboard Quick-Action Toast Capsule
  let clipboardBubbleTimer = null;
  const bubble = document.getElementById('clipboardBubble');
  const bubbleTitle = document.getElementById('bubbleTitle');
  const bubbleUrl = document.getElementById('bubbleUrl');
  const bubbleDownloadVideo = document.getElementById('bubbleDownloadVideo');
  const bubbleDownloadAudio = document.getElementById('bubbleDownloadAudio');
  const bubbleClose = document.getElementById('bubbleClose');
  let currentBubbleUrl = '';

  if (nativeApi?.onClipboardDetected) {
    nativeApi.onClipboardDetected(data => {
      const url = typeof data === 'object' ? data.url : data;
      if (!url) return;
      currentBubbleUrl = url;

      if (bubbleUrl) bubbleUrl.textContent = url;
      if (bubbleTitle) bubbleTitle.textContent = t('bubbleTitle');
      if (bubbleDownloadVideo) bubbleDownloadVideo.textContent = t('bubbleDownloadVideo');
      if (bubbleDownloadAudio) bubbleDownloadAudio.textContent = t('bubbleDownloadAudio');
      if (bubble) bubble.classList.remove('hidden');

      clearTimeout(clipboardBubbleTimer);
      clipboardBubbleTimer = setTimeout(() => {
        if (bubble) bubble.classList.add('hidden');
      }, 5000);
    });
  }

  const bubbleInfoArea = document.getElementById('bubbleInfoArea');
  if (bubbleInfoArea) {
    bubbleInfoArea.onclick = async () => {
      if (bubble) bubble.classList.add('hidden');
      if (currentBubbleUrl) {
        if (nativeApi?.showMainWindow) await nativeApi.showMainWindow();
        openAddModal(currentBubbleUrl, 'video');
        playSound('pop');
      }
    };
  }

  if (bubbleDownloadVideo) {
    bubbleDownloadVideo.onclick = async () => {
      if (bubble) bubble.classList.add('hidden');
      if (currentBubbleUrl) {
        if (nativeApi?.showMainWindow) await nativeApi.showMainWindow();
        openAddModal(currentBubbleUrl, 'video');
        playSound('pop');
      }
    };
  }

  if (bubbleDownloadAudio) {
    bubbleDownloadAudio.onclick = async () => {
      if (bubble) bubble.classList.add('hidden');
      if (currentBubbleUrl) {
        if (nativeApi?.showMainWindow) await nativeApi.showMainWindow();
        openAddModal(currentBubbleUrl, 'audio');
        playSound('pop');
      }
    };
  }

  if (bubbleClose) {
    bubbleClose.onclick = () => {
      if (bubble) bubble.classList.add('hidden');
    };
  }

  // ==========================================================================
  // 🧲 BitTorrent & Magnet Selector Controllers
  // ==========================================================================
  let currentTorrentData = null;

  function openTorrentModal(initialInput = '') {
    const modal = document.getElementById('torrentModal');
    const input = document.getElementById('torrentInput');
    const metaCard = document.getElementById('torrentMetaCard');
    if (input && initialInput) input.value = initialInput;
    if (metaCard && !currentTorrentData) metaCard.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
    if (initialInput) handleParseTorrent(initialInput);
  }

  function closeTorrentModal() {
    const modal = document.getElementById('torrentModal');
    if (modal) modal.classList.add('hidden');
  }

  async function handleParseTorrent(rawInput) {
    if (!nativeApi?.parseTorrent) return;
    const input = rawInput || document.getElementById('torrentInput')?.value?.trim();
    if (!input) return showToast('请输入磁力链接或选择种子文件');

    const parseBtn = document.getElementById('parseTorrentBtn');
    if (parseBtn) { parseBtn.disabled = true; parseBtn.textContent = '解析中...'; }
    try {
      const data = await nativeApi.parseTorrent(input);
      currentTorrentData = data;
      renderTorrentData(data);
      showToast('✨ 种子/磁力元数据解析成功！');
    } catch (err) {
      showToast('解析失败: ' + (err.message || '未知错误'));
    } finally {
      if (parseBtn) { parseBtn.disabled = false; parseBtn.textContent = '🔍 解析内容'; }
    }
  }

  function renderTorrentData(data) {
    const metaCard = document.getElementById('torrentMetaCard');
    const titleEl = document.getElementById('torrentTitle');
    const totalSizeEl = document.getElementById('torrentTotalSize');
    const fileCountEl = document.getElementById('torrentFileCount');
    const listEl = document.getElementById('torrentFilesList');

    if (metaCard) metaCard.classList.remove('hidden');
    if (titleEl) titleEl.textContent = data.name || 'Torrent Download';
    if (totalSizeEl) totalSizeEl.textContent = data.totalSize ? formatBytes(data.totalSize) : '动态握手获取';
    if (fileCountEl) fileCountEl.textContent = data.files ? data.files.length : 1;

    if (listEl && data.files) {
      const isMagnet = data.type === 'magnet';
      listEl.innerHTML = data.files.map(f => `
        <div class="torrent-file-item" data-idx="${f.index}">
          <input type="checkbox" class="torrent-file-checkbox" ${f.selected ? 'checked' : ''} data-idx="${f.index}">
          <span class="torrent-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          <span class="torrent-file-size" style="${isMagnet ? 'color:#00f2fe; font-size:11px;' : ''}">${f.size ? formatBytes(f.size) : (isMagnet ? `⚡ ${data.trackersInjected || 35}+ Trackers 已就绪` : '动态获取')}</span>
        </div>
      `).join('');

      listEl.querySelectorAll('.torrent-file-checkbox').forEach(cb => {
        cb.onchange = () => {
          const idx = Number(cb.dataset.idx);
          if (currentTorrentData.files[idx]) {
            currentTorrentData.files[idx].selected = cb.checked;
          }
          updateTorrentSelectedCount();
        };
      });
    }
    updateTorrentSelectedCount();
  }

  function updateTorrentSelectedCount() {
    const selCountEl = document.getElementById('torrentSelectedCount');
    if (!currentTorrentData || !selCountEl) return;
    const count = currentTorrentData.files.filter(f => f.selected).length;
    selCountEl.textContent = count;
  }

  // Torrent Modal Events
  const openTorrentBtn = document.getElementById('openTorrentBtn');
  const closeTorrentModalBtn = document.getElementById('closeTorrentModal');
  const cancelTorrentBtn = document.getElementById('cancelTorrentBtn');
  const pickTorrentBtn = document.getElementById('pickTorrentBtn');
  const parseTorrentBtn = document.getElementById('parseTorrentBtn');
  const selectTorrentAll = document.getElementById('selectTorrentAll');
  const selectTorrentVideoOnly = document.getElementById('selectTorrentVideoOnly');
  const selectTorrentNone = document.getElementById('selectTorrentNone');
  const startTorrentDownloadBtn = document.getElementById('startTorrentDownloadBtn');

  if (openTorrentBtn) openTorrentBtn.onclick = () => openTorrentModal();
  if (closeTorrentModalBtn) closeTorrentModalBtn.onclick = closeTorrentModal;
  if (cancelTorrentBtn) cancelTorrentBtn.onclick = closeTorrentModal;

  if (pickTorrentBtn) {
    pickTorrentBtn.onclick = async () => {
      if (!nativeApi?.pickTorrentFile) return;
      const res = await nativeApi.pickTorrentFile();
      if (res) {
        document.getElementById('torrentInput').value = res.filePath;
        currentTorrentData = res;
        renderTorrentData(res);
        showToast('✨ 种子文件解析完成！');
      }
    };
  }

  if (parseTorrentBtn) parseTorrentBtn.onclick = () => handleParseTorrent();

  if (selectTorrentAll) {
    selectTorrentAll.onclick = () => {
      if (!currentTorrentData?.files) return;
      currentTorrentData.files.forEach(f => { f.selected = true; });
      document.querySelectorAll('.torrent-file-checkbox').forEach(cb => { cb.checked = true; });
      updateTorrentSelectedCount();
    };
  }

  if (selectTorrentVideoOnly) {
    selectTorrentVideoOnly.onclick = () => {
      if (!currentTorrentData?.files) return;
      const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm', '.ts', '.m4v'];
      currentTorrentData.files.forEach(f => {
        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
        f.selected = videoExts.includes(ext);
      });
      document.querySelectorAll('.torrent-file-checkbox').forEach(cb => {
        const idx = Number(cb.dataset.idx);
        cb.checked = !!currentTorrentData.files[idx]?.selected;
      });
      updateTorrentSelectedCount();
    };
  }

  if (selectTorrentNone) {
    selectTorrentNone.onclick = () => {
      if (!currentTorrentData?.files) return;
      currentTorrentData.files.forEach(f => { f.selected = false; });
      document.querySelectorAll('.torrent-file-checkbox').forEach(cb => { cb.checked = false; });
      updateTorrentSelectedCount();
    };
  }

  if (startTorrentDownloadBtn) {
    startTorrentDownloadBtn.onclick = async () => {
      if (!currentTorrentData || !nativeApi) return;
      const selected = currentTorrentData.files.filter(f => f.selected);
      if (selected.length === 0) return showToast('请至少勾选一个需要下载的文件');

      const isAudio = selected.every(f => ['.mp3', '.flac', '.wav', '.aac', '.m4a'].some(ext => f.name.toLowerCase().endsWith(ext)));
      try {
        const taskPayload = {
          url: currentTorrentData.url || currentTorrentData.filePath || ('magnet:?xt=urn:btih:' + currentTorrentData.hash),
          name: currentTorrentData.name || 'Torrent Download',
          size: selected.reduce((sum, f) => sum + (f.size || 0), 0),
          mode: isAudio ? 'audio' : 'video'
        };
        await nativeApi.addTask(taskPayload);
        closeTorrentModal();
        showToast('🚀 BT 种子/磁力任务已建立并加入满速下载队列！');
      } catch (err) {
        showToast(err.message || '添加任务失败');
      }
    };
  }

  // ==========================================================================
  // ⚡ Web Media Stream Sniffer Controllers
  // ==========================================================================
  function openWebSnifferModal(initialUrl = '') {
    const modal = document.getElementById('webSnifferModal');
    const input = document.getElementById('webSnifferUrlInput');
    if (input && initialUrl) input.value = initialUrl;
    if (modal) modal.classList.remove('hidden');
    renderSniffedStreamsList();
  }

  function closeWebSnifferModal() {
    const modal = document.getElementById('webSnifferModal');
    if (modal) modal.classList.add('hidden');
    if (nativeApi?.closeWebSniffer) nativeApi.closeWebSniffer();
  }

  function addSniffedStreamRow(stream) {
    if (sniffedStreamRecords.some(s => s.url === stream.url)) return;
    sniffedStreamRecords.unshift(stream);
    renderSniffedStreamsList();
    renderModalSniffedStreamsList();
    showToast('⚡ 捕获到底层媒体直链: ' + stream.url.slice(0, 35) + '...');
  }

  function renderSniffedStreamsList() {
    const listEl = document.getElementById('sniffedStreamsList');
    const countEl = document.getElementById('sniffedCount');
    if (countEl) countEl.textContent = sniffedStreamRecords.length;
    if (!listEl) return;

    if (sniffedStreamRecords.length === 0) {
      listEl.innerHTML = '<div class="empty-hint-text">暂无捕获到的媒体流，请在上方输入网址并启动浏览器播放视频</div>';
      return;
    }

    listEl.innerHTML = sniffedStreamRecords.map(s => {
      let typeName = 'VIDEO STREAM';
      if (s.url.includes('.m3u8')) typeName = 'HLS (m3u8)';
      else if (s.url.includes('.mpd')) typeName = 'DASH (mpd)';
      else if (s.url.includes('.mp4')) typeName = 'MP4 DIRECT';
      else if (s.mime?.includes('audio')) typeName = 'AUDIO STREAM';

      return `
        <div class="sniffer-stream-item" data-url="${escapeHtml(s.url)}">
          <div class="sniffer-stream-info">
            <div class="sniffer-stream-url" title="${escapeHtml(s.url)}">${escapeHtml(s.url)}</div>
            <div class="sniffer-stream-meta">
              <span class="stream-type-badge">${typeName}</span>
              <span>状态码: ${s.statusCode || 200}</span>
              <span>大小: ${s.size ? formatBytes(s.size) : '流式分片'}</span>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-shrink:0;">
            <button type="button" class="glass-btn mini-btn copy-stream-btn" data-url="${escapeHtml(s.url)}">📋 复制直链</button>
            <button type="button" class="liquid-btn primary-btn mini-btn download-stream-btn" data-url="${escapeHtml(s.url)}">📥 立即下载</button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.copy-stream-btn').forEach(btn => {
      btn.onclick = async () => {
        await navigator.clipboard.writeText(btn.dataset.url);
        showToast('📋 媒体直链已复制到剪贴板！');
      };
    });

    listEl.querySelectorAll('.download-stream-btn').forEach(btn => {
      btn.onclick = () => {
        const u = btn.dataset.url;
        closeWebSnifferModal();
        openAddModal(u);
      };
    });
  }

  // Web Sniffer Modal Events
  const openWebSnifferBtn = document.getElementById('openWebSnifferBtn');
  const closeWebSnifferModalBtn = document.getElementById('closeWebSnifferModal');
  const launchSnifferBrowserBtn = document.getElementById('launchSnifferBrowserBtn');

  if (openWebSnifferBtn) openWebSnifferBtn.onclick = () => openWebSnifferModal();
  if (closeWebSnifferModalBtn) closeWebSnifferModalBtn.onclick = closeWebSnifferModal;

  if (launchSnifferBrowserBtn) {
    launchSnifferBrowserBtn.onclick = () => {
      const url = document.getElementById('webSnifferUrlInput')?.value?.trim() || 'https://www.bilibili.com';
      if (nativeApi?.openWebSniffer) {
        nativeApi.openWebSniffer(url);
        showToast('🌐 嗅探专用浏览器已启动，播放网页视频将自动抓取底层直链！');
      }
    };
  }

  // ==========================================================================
  // 🖼️ Web Asset Scraper Controllers & Sub-Tabs
  // ==========================================================================
  let currentScrapedAssets = [];
  let selectedScrapedUrls = new Set();
  let currentAssetFilter = 'all';

  const subtabStreams = document.getElementById('subtabStreams');
  const subtabAssets = document.getElementById('subtabAssets');
  const paneStreams = document.getElementById('snifferPaneStreams');
  const paneAssets = document.getElementById('snifferPaneAssets');

  function switchSnifferSubTab(tabName) {
    if (subtabStreams) subtabStreams.classList.toggle('active', tabName === 'streams');
    if (subtabAssets) subtabAssets.classList.toggle('active', tabName === 'assets');
    if (paneStreams) paneStreams.classList.toggle('hidden', tabName !== 'streams');
    if (paneAssets) paneAssets.classList.toggle('hidden', tabName !== 'assets');
  }

  if (subtabStreams) subtabStreams.onclick = () => switchSnifferSubTab('streams');
  if (subtabAssets) subtabAssets.onclick = () => {
    switchSnifferSubTab('assets');
    if (currentScrapedAssets.length === 0) handleScrapePageAssets();
  };

  async function handleScrapePageAssets() {
    if (!nativeApi?.scrapeAssets) return;
    const btn = document.getElementById('scrapePageAssetsBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 抓取中...'; }
    try {
      const res = await nativeApi.scrapeAssets();
      if (res && res.assets) {
        currentScrapedAssets = res.assets;
        selectedScrapedUrls.clear();
        currentScrapedAssets.forEach(a => selectedScrapedUrls.add(a.url));
        const countBadge = document.getElementById('scrapedAssetsCount');
        if (countBadge) countBadge.textContent = currentScrapedAssets.length;
        renderScrapedAssetsGrid();
        updateSelectedAssetsCount();
        playSound('success');
        showToast(`✨ 成功从网页提纯提取 ${currentScrapedAssets.length} 项素材！`);
      }
    } catch (err) {
      showToast(err.message || '抓取网页素材失败，请确保已启动嗅探浏览器');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔍 一键抓取当前页面素材'; }
    }
  }

  function renderScrapedAssetsGrid() {
    const grid = document.getElementById('scrapedAssetsGrid');
    if (!grid) return;

    let filtered = currentScrapedAssets;
    if (currentAssetFilter !== 'all') {
      filtered = currentScrapedAssets.filter(a => a.type === currentAssetFilter);
    }

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-hint-text">未找到符合该筛选分类的素材</div>';
      return;
    }

    grid.innerHTML = filtered.map(a => {
      const isSelected = selectedScrapedUrls.has(a.url);
      const isImg = a.type === 'image';
      const thumb = isImg
        ? `<img class="scraped-asset-thumb" src="${escapeHtml(a.url)}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'80\\' height=\\'60\\'><rect width=\\'80\\' height=\\'60\\' fill=\\'%23222\\'/><text x=\\'40\\' y=\\'35\\' fill=\\'%23666\\' text-anchor=\\'middle\\' font-size=\\'12\\'>IMG</text></svg>'">`
        : `<div class="scraped-asset-icon-thumb">${a.type === 'video' ? '🎬' : a.type === 'audio' ? '🎵' : '📄'}</div>`;

      const dim = (a.width && a.height) ? `${a.width}×${a.height}` : a.type.toUpperCase();

      return `
        <div class="scraped-asset-card ${isSelected ? 'selected' : ''}" data-url="${escapeHtml(a.url)}">
          <input type="checkbox" class="scraped-asset-checkbox" ${isSelected ? 'checked' : ''} data-url="${escapeHtml(a.url)}">
          ${thumb}
          <div class="scraped-asset-meta" title="${escapeHtml(a.name || a.url)}">${escapeHtml(a.name || a.url)}</div>
          <div style="font-size:9.5px; color:var(--text-tertiary); display:flex; justify-content:space-between;">
            <span>${dim}</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.scraped-asset-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.tagName.toLowerCase() === 'input') return;
        const u = card.dataset.url;
        if (selectedScrapedUrls.has(u)) selectedScrapedUrls.delete(u);
        else selectedScrapedUrls.add(u);
        const cb = card.querySelector('.scraped-asset-checkbox');
        if (cb) cb.checked = selectedScrapedUrls.has(u);
        card.classList.toggle('selected', selectedScrapedUrls.has(u));
        updateSelectedAssetsCount();
      };
    });

    grid.querySelectorAll('.scraped-asset-checkbox').forEach(cb => {
      cb.onchange = () => {
        const u = cb.dataset.url;
        if (cb.checked) selectedScrapedUrls.add(u);
        else selectedScrapedUrls.delete(u);
        cb.closest('.scraped-asset-card')?.classList.toggle('selected', cb.checked);
        updateSelectedAssetsCount();
      };
    });
  }

  function updateSelectedAssetsCount() {
    const numEl = document.getElementById('selectedAssetNum');
    const dlBtn = document.getElementById('downloadSelectedAssetsBtn');
    const count = selectedScrapedUrls.size;
    if (numEl) numEl.textContent = count;
    if (dlBtn) dlBtn.disabled = count === 0;
  }

  const scrapePageAssetsBtn = document.getElementById('scrapePageAssetsBtn');
  const selectAllAssetsBtn = document.getElementById('selectAllAssetsBtn');
  const deselectAllAssetsBtn = document.getElementById('deselectAllAssetsBtn');
  const downloadSelectedAssetsBtn = document.getElementById('downloadSelectedAssetsBtn');

  if (scrapePageAssetsBtn) scrapePageAssetsBtn.onclick = handleScrapePageAssets;
  if (selectAllAssetsBtn) {
    selectAllAssetsBtn.onclick = () => {
      currentScrapedAssets.forEach(a => selectedScrapedUrls.add(a.url));
      renderScrapedAssetsGrid();
      updateSelectedAssetsCount();
    };
  }
  if (deselectAllAssetsBtn) {
    deselectAllAssetsBtn.onclick = () => {
      selectedScrapedUrls.clear();
      renderScrapedAssetsGrid();
      updateSelectedAssetsCount();
    };
  }

  document.querySelectorAll('.asset-filter-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('.asset-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentAssetFilter = chip.dataset.filter || 'all';
      renderScrapedAssetsGrid();
    };
  });

  if (downloadSelectedAssetsBtn) {
    downloadSelectedAssetsBtn.onclick = async () => {
      if (selectedScrapedUrls.size === 0) return showToast('请至少勾选一项素材');
      const urls = Array.from(selectedScrapedUrls);
      closeWebSnifferModal();
      openAddModal(urls.join('\n'));
      showToast(`📦 已将 ${urls.length} 项素材载入批量下载队列！`);
    };
  }

  // ==========================================================================
  // 🔄 Lossless Media Converter Controllers
  // ==========================================================================
  let currentConvertTask = null;

  function openConvertModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.savePath) return showToast('未找到可转换的本地文件');

    currentConvertTask = task;
    const modal = document.getElementById('convertModal');
    const titleEl = document.getElementById('convertSourceTitle');
    const sizeEl = document.getElementById('convertSourceSize');
    const pathEl = document.getElementById('convertSourcePath');
    const progressWrap = document.getElementById('convertProgressWrap');
    const convertBtn = document.getElementById('startConvertBtn');

    if (titleEl) titleEl.textContent = task.name || 'source_file';
    if (sizeEl) sizeEl.textContent = formatBytes(task.size || 0);
    if (pathEl) pathEl.textContent = task.savePath;
    if (progressWrap) progressWrap.classList.add('hidden');
    if (convertBtn) { convertBtn.disabled = false; convertBtn.textContent = '🚀 开始极速转换'; }

    if (modal) modal.classList.remove('hidden');
  }

  function closeConvertModal() {
    const modal = document.getElementById('convertModal');
    if (modal) modal.classList.add('hidden');
    currentConvertTask = null;
  }

  // Format selection cards
  document.querySelectorAll('.convert-format-card').forEach(card => {
    card.onclick = () => {
      document.querySelectorAll('.convert-format-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    };
  });

  const closeConvertModalBtn = document.getElementById('closeConvertModal');
  const cancelConvertBtn = document.getElementById('cancelConvertBtn');
  const startConvertBtn = document.getElementById('startConvertBtn');

  if (closeConvertModalBtn) closeConvertModalBtn.onclick = closeConvertModal;
  if (cancelConvertBtn) cancelConvertBtn.onclick = closeConvertModal;

  if (startConvertBtn) {
    startConvertBtn.onclick = async () => {
      if (!currentConvertTask || !nativeApi?.convertMedia) return;
      const targetFormat = document.querySelector('input[name="targetFormat"]:checked')?.value || 'mp4';
      const loudnorm = document.getElementById('convertLoudnorm')?.checked !== false;
      const progressWrap = document.getElementById('convertProgressWrap');
      const statusText = document.getElementById('convertStatusText');

      if (progressWrap) progressWrap.classList.remove('hidden');
      if (statusText) statusText.textContent = `⚡ 正在极速转码转换为 ${targetFormat.toUpperCase()}，请稍候...`;
      startConvertBtn.disabled = true;
      startConvertBtn.textContent = '⏳ 转换中...';

      try {
        const res = await nativeApi.convertMedia({
          filePath: currentConvertTask.savePath,
          targetFormat,
          loudnorm
        });
        if (res && res.success) {
          playSound('success');
          showToast(`🎉 格式转换完成！已保存为 ${res.outputName} (${formatBytes(res.size)})`);
          closeConvertModal();
          if (nativeApi?.show) nativeApi.show(res.outputPath);
        }
      } catch (err) {
        showToast('转换失败: ' + (err.message || '内核执行异常'));
        if (statusText) statusText.textContent = '❌ 转换失败: ' + err.message;
      } finally {
        startConvertBtn.disabled = false;
        startConvertBtn.textContent = '🚀 开始极速转换';
      }
    };
  }

  // ==========================================================================
  // 📋 Clipboard Memory Vault Controllers
  // ==========================================================================
  let clipboardHistoryData = [];

  function updateClipboardHistoryBadge() {
    const badge = document.getElementById('clipboardHistoryCountBadge');
    if (badge) {
      const count = clipboardHistoryData.length;
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
  }

  function openClipboardHistoryModal() {
    const modal = document.getElementById('clipboardHistoryModal');
    if (modal) modal.classList.remove('hidden');
    if (nativeApi?.getClipboardHistory) {
      nativeApi.getClipboardHistory().then(h => {
        clipboardHistoryData = h || [];
        renderClipboardHistoryList();
        updateClipboardHistoryBadge();
      });
    } else {
      renderClipboardHistoryList();
    }
  }

  function closeClipboardHistoryModal() {
    const modal = document.getElementById('clipboardHistoryModal');
    if (modal) modal.classList.add('hidden');
  }

  function renderClipboardHistoryList(query = '') {
    const listEl = document.getElementById('clipboardHistoryList');
    const countEl = document.getElementById('historyTotalCount');
    if (countEl) countEl.textContent = clipboardHistoryData.length;
    if (!listEl) return;

    let filtered = clipboardHistoryData;
    if (query) {
      const q = query.toLowerCase();
      filtered = clipboardHistoryData.filter(item => (item.title || '').toLowerCase().includes(q) || (item.url || '').toLowerCase().includes(q));
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-hint-text">暂无符合条件的剪贴板备忘记录</div>';
      return;
    }

    listEl.innerHTML = filtered.map(item => {
      let icon = '🔗';
      let siteName = '网页直链';
      if (item.site === 'bilibili') { icon = '📺'; siteName = '哔哩哔哩'; }
      else if (item.site === 'youtube') { icon = '▶️'; siteName = 'YouTube'; }
      else if (item.site === 'douyin') { icon = '🎵'; siteName = '抖音'; }
      else if (item.site === 'x') { icon = '🐦'; siteName = 'Twitter/X'; }
      else if (item.site === 'telegram') { icon = '✈️'; siteName = 'Telegram'; }
      else if (item.url?.startsWith('magnet:')) { icon = '🧲'; siteName = '磁力链接'; }

      const timeStr = item.time ? new Date(item.time).toLocaleString() : '';

      return `
        <div class="history-item-card" data-id="${escapeHtml(item.id)}">
          <div class="history-item-icon">${icon}</div>
          <div class="history-item-body">
            <div class="history-item-title">${escapeHtml(item.title || item.url)}</div>
            <div class="history-item-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</div>
            <div class="history-item-meta">
              <span>🏷️ ${siteName}</span>
              <span>⏰ ${timeStr}</span>
              ${item.count > 1 ? `<span>🔄 捕获 ${item.count} 次</span>` : ''}
            </div>
          </div>
          <div class="history-item-actions">
            <button type="button" class="glass-btn mini-btn history-copy-btn" data-url="${escapeHtml(item.url)}">📋 复制</button>
            <button type="button" class="liquid-btn primary-btn mini-btn history-dl-btn" data-url="${escapeHtml(item.url)}">⬇️ 智能透析</button>
            <button type="button" class="glass-btn mini-btn text-danger history-del-btn" data-id="${escapeHtml(item.id)}">✕</button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.history-copy-btn').forEach(btn => {
      btn.onclick = async () => {
        await navigator.clipboard.writeText(btn.dataset.url);
        showToast('📋 链接已复制到剪贴板！');
      };
    });

    listEl.querySelectorAll('.history-dl-btn').forEach(btn => {
      btn.onclick = () => {
        const u = btn.dataset.url;
        closeClipboardHistoryModal();
        openAddModal(u);
      };
    });

    listEl.querySelectorAll('.history-del-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        clipboardHistoryData = clipboardHistoryData.filter(i => i.id !== id);
        if (nativeApi?.deleteClipboardItem) await nativeApi.deleteClipboardItem(id);
        renderClipboardHistoryList(document.getElementById('historySearchInput')?.value?.trim() || '');
        updateClipboardHistoryBadge();
      };
    });
  }

  const openClipHistoryBtn = document.getElementById('openClipboardHistoryBtn');
  const closeClipHistoryModalBtn = document.getElementById('closeClipboardHistoryModal');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
  const batchDownloadHistoryBtn = document.getElementById('batchDownloadHistoryBtn');
  const historySearchInput = document.getElementById('historySearchInput');

  if (openClipHistoryBtn) openClipHistoryBtn.onclick = openClipboardHistoryModal;
  if (closeClipHistoryModalBtn) closeClipHistoryModalBtn.onclick = closeClipboardHistoryModal;
  if (closeHistoryBtn) closeHistoryBtn.onclick = closeClipboardHistoryModal;

  if (historySearchInput) {
    historySearchInput.oninput = () => renderClipboardHistoryList(historySearchInput.value.trim());
  }

  if (clearAllHistoryBtn) {
    clearAllHistoryBtn.onclick = async () => {
      clipboardHistoryData = [];
      if (nativeApi?.clearClipboardHistory) await nativeApi.clearClipboardHistory();
      renderClipboardHistoryList();
      updateClipboardHistoryBadge();
      playSound('delete');
      showToast('🧹 剪贴板备忘箱已全部清空！');
    };
  }

  if (batchDownloadHistoryBtn) {
    batchDownloadHistoryBtn.onclick = async () => {
      if (clipboardHistoryData.length === 0) return showToast('备忘箱为空');
      const urls = clipboardHistoryData.map(i => i.url);
      closeClipboardHistoryModal();
      openAddModal(urls.join('\n'));
      showToast(`🚀 已将备忘箱中全部 ${urls.length} 条链接载入批量任务卡！`);
    };
  }

  // ==========================================================================
  // 🧲 BitTorrent Trackers Sync
  // ==========================================================================
  const updateTrackersBtn = document.getElementById('updateTrackersBtn');
  if (updateTrackersBtn) {
    updateTrackersBtn.onclick = async () => {
      if (!nativeApi) return;
      updateTrackersBtn.disabled = true;
      updateTrackersBtn.textContent = '🔄 同步中...';
      try {
        const res = nativeApi.syncOnlineTrackers ? await nativeApi.syncOnlineTrackers() : await nativeApi.updateTrackers();
        const total = res.totalCount || res.count || 35;
        const badge = document.getElementById('trackersCountBadge');
        if (badge) badge.textContent = `${total} 个节点就绪`;
        playSound('success');
        showToast(`✨ 全球最佳 BT Trackers 节点库已同步更新 (${total} 个节点)！`);
      } catch (err) {
        showToast('Trackers 同步异常: ' + err.message);
      } finally {
        updateTrackersBtn.disabled = false;
        updateTrackersBtn.textContent = '🔄 同步最新';
      }
    };
  }

  // Browser Extension Export Buttons
  const exportExtBtn = document.getElementById('exportExtensionBtn');
  if (exportExtBtn) {
    exportExtBtn.onclick = async () => {
      if (!nativeApi?.exportExtension) return;
      try {
        const res = await nativeApi.exportExtension();
        showToast('📦 浏览器扩展程序已导出并自动定位文件夹！');
      } catch (e) {
        showToast('导出失败: ' + e.message);
      }
    };
  }

  const openExtGuideBtn = document.getElementById('openExtensionGuideBtn');
  if (openExtGuideBtn) {
    openExtGuideBtn.onclick = () => {
      if (nativeApi?.openExtensionGuide) nativeApi.openExtensionGuide();
    };
  }

  // Keyboard shortcut (ESC closes modals, Space toggles preview player)
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAddModal();
      closeSettingsModal();
      closePlaylistModal();
      closeHashModal();
      closePreviewModal();
      closeMobileCastModal();
      closeTrimModal();
      closeRefreshUrlModal();
      closeTorrentModal();
      closeWebSnifferModal();
      closeConvertModal();
      closeClipboardHistoryModal();
      clearTaskSelection();
      if (bubble) bubble.classList.add('hidden');
    }

    const previewModal = document.getElementById('previewModal');
    if (previewModal && !previewModal.classList.contains('hidden')) {
      const video = document.getElementById('previewVideoPlayer');
      const audio = document.getElementById('previewAudioPlayer');
      const activeMedia = (video && !video.classList.contains('hidden')) ? video : audio;
      if (activeMedia) {
        if (e.code === 'Space') {
          e.preventDefault();
          if (activeMedia.paused) activeMedia.play();
          else activeMedia.pause();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          activeMedia.currentTime = Math.max(0, activeMedia.currentTime - 5);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          activeMedia.currentTime = Math.min(activeMedia.duration || 0, activeMedia.currentTime + 5);
        } else if (e.code === 'ArrowUp') {
          e.preventDefault();
          activeMedia.volume = Math.min(1, activeMedia.volume + 0.1);
        } else if (e.code === 'ArrowDown') {
          e.preventDefault();
          activeMedia.volume = Math.max(0, activeMedia.volume - 0.1);
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          activeMedia.muted = !activeMedia.muted;
        } else if (e.code === 'KeyF' && video && !video.classList.contains('hidden')) {
          e.preventDefault();
          if (!document.fullscreenElement) video.requestFullscreen?.().catch(() => {});
          else document.exitFullscreen?.().catch(() => {});
        }
      }
    }
  });

  // Initialize Native Data & Start Waveform
  if (nativeApi) {
    nativeApi.onUpdate(updatedTask => {
      const idx = tasks.findIndex(t => t.id === updatedTask.id);
      const oldTask = idx >= 0 ? tasks[idx] : null;
      if (oldTask && oldTask.status !== 'completed' && updatedTask.status === 'completed') {
        playSound('success');
      }
      if (idx < 0) {
        tasks.unshift(updatedTask);
      } else {
        tasks[idx] = updatedTask;
      }
      renderTasks();
    });

    if (nativeApi.onRemove) {
      nativeApi.onRemove(removedId => {
        tasks = tasks.filter(t => t.id !== removedId);
        renderTasks();
      });
    }

    if (nativeApi.onStreamDetected) {
      nativeApi.onStreamDetected(stream => addSniffedStreamRow(stream));
    }

    if (nativeApi.onSpeedLimitChanged) {
      nativeApi.onSpeedLimitChanged(data => {
        const text = data.isPeak ? `⏱️ 已进入高峰限速时段 (${data.speedLimit} KB/s)` : `🚀 已进入低峰不限速时段`;
        showToast(text);
      });
    }

    if (nativeApi.onExternalAddTask) {
      nativeApi.onExternalAddTask(data => {
        if (data?.url) {
          playSound('pop');
          openAddModal(data.url, data.mode || 'video');
          showToast(currentLang === 'zh' ? '🔍 网页投递成功，已开启智能透析！' : '🔍 Web link received, smart analysis started!');
        }
      });
    }

    if (nativeApi.onClipboardHistoryUpdated) {
      nativeApi.onClipboardHistoryUpdated(history => {
        clipboardHistoryData = history || [];
        updateClipboardHistoryBadge();
        const historyModal = document.getElementById('clipboardHistoryModal');
        if (historyModal && !historyModal.classList.contains('hidden')) {
          renderClipboardHistoryList(document.getElementById('historySearchInput')?.value?.trim() || '');
        }
      });
    }

    if (nativeApi.onFloatingStats) {
      nativeApi.onFloatingStats(stats => {
        if (stats && typeof stats.totalSpeed === 'number') {
          backendTotalSpeed = stats.totalSpeed;
        }
      });
    }

    Promise.all([
      nativeApi.getSettings(),
      nativeApi.list(),
      nativeApi.listCookies(),
      nativeApi.getClipboardHistory ? nativeApi.getClipboardHistory() : Promise.resolve([])
    ])
      .then(([s, l, cookies, clipHistory]) => {
        settings = s || {};
        tasks = l || [];
        cookieProfiles = cookies || {};
        clipboardHistoryData = clipHistory || [];
        updateClipboardHistoryBadge();
        applyLanguage();
        runDiagnosticCheck(true);
        startSpeedWaveform();
      })
      .catch(err => {
        console.error('Initialization error:', err);
        applyLanguage();
        startSpeedWaveform();
      });
  } else {
    applyLanguage();
  }
});
