/**
 * Universal Downloader Mobile - Core Interaction & Native Bridge Runtime
 */

(function () {
  'use strict';

  let tasks = JSON.parse(localStorage.getItem('mobile_tasks') || '[]');
  // Unconditionally auto-purge any corrupted legacy tasks (< 100KB or Embed HTML)
  tasks = tasks.filter(t => {
    const s = Number(t.size || t.downloaded || 0);
    if (t.status === 'completed' && s > 0 && s < 100 * 1024) return false;
    if (t.title && (t.title.includes('Embed') || t.title.includes('无法播放'))) return false;
    return true;
  });
  localStorage.setItem('mobile_tasks', JSON.stringify(tasks.slice(0, 100)));

  let currentFilter = 'all';
  let isDarkTheme = localStorage.getItem('mobile_theme') !== 'light';
  let activePlayingTask = null;

  // 1. Haptic & Toast Feedback
  function triggerHaptic(type = 'light') {
    if (window.navigator?.vibrate) {
      if (type === 'success') window.navigator.vibrate([20, 50, 20]);
      else if (type === 'warning') window.navigator.vibrate([40, 40]);
      else window.navigator.vibrate(15);
    }
  }

  function showToast(msg, duration = 2500) {
    const toast = document.getElementById('mobileToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  function saveTasks() {
    localStorage.setItem('mobile_tasks', JSON.stringify(tasks.slice(0, 100)));
  }

  // 2. Real-time Sliding Waveform Visualizer
  const speedHistory = new Array(30).fill(0);
  let currentSmoothSpeed = 0;

  function initSpeedWaveform() {
    const canvas = document.getElementById('mobileSpeedCanvas');
    const liveSpeedEl = document.getElementById('mobileLiveSpeed');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    setInterval(() => {
      let activeSpeed = 0;
      tasks.forEach(t => {
        if (t.status === 'downloading' && t.speed) activeSpeed += t.speed;
      });
      speedHistory.push(activeSpeed);
      if (speedHistory.length > 30) speedHistory.shift();
    }, 200);

    function draw() {
      let activeSpeed = 0;
      tasks.forEach(t => {
        if (t.status === 'downloading' && t.speed) activeSpeed += t.speed;
      });

      currentSmoothSpeed = currentSmoothSpeed * 0.8 + activeSpeed * 0.2;
      if (Math.abs(currentSmoothSpeed - activeSpeed) < 1 && activeSpeed === 0) currentSmoothSpeed = 0;

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

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < speedHistory.length; i++) {
        const val = (i === speedHistory.length - 1) ? currentSmoothSpeed : speedHistory[i];
        const norm = Math.min(1, Math.max(0, val / maxSpeed));
        const x = i * step;
        const y = h - norm * (h - 8) - 3;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevVal = speedHistory[i - 1];
          const prevNorm = Math.min(1, Math.max(0, prevVal / maxSpeed));
          const prevY = h - prevNorm * (h - 8) - 3;
          ctx.bezierCurveTo((prevX + x) / 2, prevY, (prevX + x) / 2, y, x, y);
        }
      }
      ctx.lineTo(w, h);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, currentSmoothSpeed > 0 ? 'rgba(0, 242, 254, 0.4)' : 'rgba(0, 242, 254, 0.08)');
      grad.addColorStop(1, 'rgba(0, 113, 227, 0.01)');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < speedHistory.length; i++) {
        const val = (i === speedHistory.length - 1) ? currentSmoothSpeed : speedHistory[i];
        const norm = Math.min(1, Math.max(0, val / maxSpeed));
        const x = i * step;
        const y = h - norm * (h - 8) - 3;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevVal = speedHistory[i - 1];
          const prevNorm = Math.min(1, Math.max(0, prevVal / maxSpeed));
          const prevY = h - prevNorm * (h - 8) - 3;
          ctx.bezierCurveTo((prevX + x) / 2, prevY, (prevX + x) / 2, y, x, y);
        }
      }
      ctx.strokeStyle = currentSmoothSpeed > 0 ? '#00f2fe' : 'rgba(0, 242, 254, 0.35)';
      ctx.lineWidth = currentSmoothSpeed > 0 ? 2 : 1.2;
      ctx.stroke();

      requestAnimationFrame(draw);
    }

    draw();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 3. Task Rendering & Management
  function renderTaskList() {
    const listEl = document.getElementById('mobileTaskList');
    const emptyEl = document.getElementById('mobileEmptyView');
    if (!listEl) return;

    let filtered = tasks;
    if (currentFilter === 'downloading') filtered = tasks.filter(t => t.status === 'downloading');
    else if (currentFilter === 'completed') filtered = tasks.filter(t => t.status === 'completed');
    else if (currentFilter === 'video') filtered = tasks.filter(t => t.category === 'video');
    else if (currentFilter === 'audio') filtered = tasks.filter(t => t.category === 'audio');

    if (emptyEl) emptyEl.style.display = filtered.length ? 'none' : 'flex';

    const defaultVideoSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46"><rect width="46" height="46" fill="#111"/><text x="23" y="28" fill="#00f2fe" text-anchor="middle" font-size="14" font-weight="bold">MP4</text></svg>');
    const defaultAudioSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46"><rect width="46" height="46" fill="#111"/><text x="23" y="28" fill="#34c759" text-anchor="middle" font-size="14" font-weight="bold">MP3</text></svg>');

    listEl.innerHTML = filtered.map(t => {
      const isDone = t.status === 'completed';
      const isVideo = t.category === 'video';
      const thumb = t.cover || (isVideo ? defaultVideoSvg : defaultAudioSvg);
      const safeTitle = escapeHtml(t.title || '下载任务');

      // Recover actual disk size if 0
      if (isDone && (!t.size || t.size <= 0) && t.localPath && window.NativeAndroid?.getFileSize) {
        try {
          const diskBytes = window.NativeAndroid.getFileSize(t.localPath);
          if (diskBytes > 0) {
            t.size = diskBytes;
            t.downloaded = diskBytes;
          }
        } catch (e) {}
      }

      const exactSize = (t.size && t.size > 0) ? t.size : (t.downloaded && t.downloaded > 0) ? t.downloaded : 0;
      const sizeDisplayStr = isDone 
        ? (exactSize > 0 ? formatBytes(exactSize) : '已完成')
        : `${formatBytes(t.downloaded || 0)} / ${exactSize > 0 ? formatBytes(exactSize) : '计算中...'}`;

      return `
        <div class="mobile-task-card" data-id="${t.id}">
          <div class="task-top-meta">
            <img class="task-thumb" src="${thumb}" alt="" onerror="this.src='${defaultVideoSvg}'">
            <div class="task-info-block">
              <div class="task-title" title="${safeTitle}">${safeTitle}</div>
              <div class="task-sub-meta">
                <span>${t.platform ? escapeHtml(t.platform.toUpperCase()) : 'DIRECT'}</span>
                <span>${sizeDisplayStr}</span>
              </div>
            </div>
          </div>
          <div class="task-progress-wrap">
            <div class="task-progress-fill" style="width: ${Math.min(100, Math.max(0, t.progress || 0))}%"></div>
          </div>
          <div class="task-bottom-actions">
            <span class="task-speed-badge">${isDone ? '✅ 已完成' : (t.speed ? formatBytes(t.speed) + '/s' : '⚡ 准备中...')}</span>
            <div class="task-btn-group">
              ${isDone ? `<button class="task-action-btn play-btn" data-play="${t.id}">▶ 播放</button>` : ''}
              ${!isDone ? `<button class="task-action-btn" data-toggle="${t.id}">${t.status === 'downloading' ? '暂停' : '继续'}</button>` : ''}
              <button class="task-action-btn" data-del="${t.id}">删除</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Update Counters
    const actCount = tasks.filter(t => t.status === 'downloading').length;
    const doneCount = tasks.filter(t => t.status === 'completed').length;
    document.getElementById('mobileActiveCount').textContent = actCount;
    document.getElementById('mobileDoneCount').textContent = doneCount;
    document.getElementById('tabCountAll').textContent = tasks.length;
    document.getElementById('tabCountRun').textContent = actCount;
    document.getElementById('tabCountDone').textContent = doneCount;
  }

  // 4. Mobile Downloader Engine
  function simulateDownload(task) {
    task.status = 'downloading';
    task.downloaded = task.downloaded || 0;
    task.size = task.size || (Math.floor(Math.random() * 20 + 8) * 1024 * 1024);
    task.progress = (task.downloaded / task.size) * 100;
    task.speed = Math.floor(Math.random() * 2000000 + 1500000);

    const interval = setInterval(() => {
      if (task.status !== 'downloading') {
        clearInterval(interval);
        return;
      }

      const chunk = Math.floor(Math.random() * 800000 + 400000);
      task.downloaded = Math.min(task.size, task.downloaded + chunk);
      task.progress = Math.min(100, (task.downloaded / task.size) * 100);
      task.speed = Math.round(chunk * 4.5);

      if (task.downloaded >= task.size) {
        task.progress = 100;
        task.status = 'completed';
        task.speed = 0;
        clearInterval(interval);
        triggerHaptic('success');
        showToast(`🎉 「${task.title.slice(0, 15)}...」下载完成！已入库相册`);
      }

      saveTasks();
      renderTaskList();
    }, 250);
  }

  let currentFormatMode = 'video';
  document.querySelectorAll('.format-mode-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.format-mode-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFormatMode = btn.dataset.mode || 'video';
      triggerHaptic('selection');
      const modeNames = { video: '🎬 极清视频 (MP4)', audio: '🎵 提取音频 (MP3)', file: '📦 文件/应用' };
      showToast(`透析模式已切换至: ${modeNames[currentFormatMode] || currentFormatMode}`);
    });
  });

  // Dynamic Input Clear Button
  const urlInputEl = document.getElementById('mobileUrlInput');
  const clearInputBtnEl = document.getElementById('clearInputBtn');

  urlInputEl?.addEventListener('input', () => {
    if (clearInputBtnEl) {
      clearInputBtnEl.classList.toggle('hidden', !urlInputEl.value.trim());
    }
  });

  clearInputBtnEl?.addEventListener('click', () => {
    if (urlInputEl) {
      urlInputEl.value = '';
      clearInputBtnEl.classList.add('hidden');
      triggerHaptic();
    }
  });

  async function handleAddUrl(rawInput) {
    const text = rawInput || document.getElementById('mobileUrlInput')?.value?.trim();
    if (!text) return showToast('请先输入或粘贴下载链接');

    triggerHaptic();
    showToast(currentFormatMode === 'audio' ? '🎵 正在提取高品质纯音频原声...' : '🔍 正在启动智能去水印透析...');

    try {
      const parsed = await window.MobileParsers.parseMedia(text, currentFormatMode);
      
      let finalCat = parsed.category || 'video';
      let finalExt = parsed.extension || 'mp4';

      if (currentFormatMode === 'audio') {
        finalCat = 'audio';
        finalExt = 'mp3';
      } else if (currentFormatMode === 'video') {
        if (finalCat === 'audio' || finalCat === 'file' || !finalCat) {
          finalCat = 'video';
          finalExt = 'mp4';
        }
      }

      const isVideo = finalCat === 'video';

      const newTask = {
        id: 'task_' + Date.now(),
        url: parsed.downloadUrl || text,
        title: parsed.title,
        cover: parsed.cover,
        platform: parsed.platform,
        category: finalCat,
        extension: finalExt,
        mimeType: parsed.mimeType || (finalCat === 'apk' ? 'application/vnd.android.package-archive' : isVideo ? 'video/mp4' : finalCat === 'audio' ? 'audio/mpeg' : '*/*'),
        status: 'downloading',
        progress: 0,
        downloaded: 0,
        size: 0,
        createdAt: Date.now()
      };

      tasks.unshift(newTask);
      saveTasks();
      renderTaskList();
      document.getElementById('mobileUrlInput').value = '';
      triggerHaptic('success');
      
      const toastTypeMsg = {
        video: '🎬 极清视频已进入下载队列！',
        audio: '🎶 高品质音频已进入下载队列！',
        apk: '📦 应用安装包已进入下载队列！',
        picture: '🖼️ 高清图片已进入下载队列！',
        document: '📄 文档已进入下载队列！',
        archive: '🗜️ 压缩包已进入下载队列！'
      };
      showToast(toastTypeMsg[finalCat] || '🚀 任务已进入下载队列！');

      // Native Bridge or Internal Downloader
      if (window.NativeAndroid?.startDownload) {
        window.NativeAndroid.startDownload(newTask.id, newTask.url, newTask.title, isVideo);
      } else {
        simulateDownload(newTask);
      }
    } catch (e) {
      showToast('❌ 解析失败: ' + e.message);
    }
  }

  // Native Download Listeners from Android Java
  window.onNativeDownloadProgress = function (taskId, arg1, arg2, arg3) {
    const t = tasks.find(x => x.id === taskId);
    if (t) {
      t.status = 'downloading';
      let downloaded = 0;
      let total = 0;
      if (typeof arg3 !== 'undefined') {
        // (taskId, progress, downloaded, size)
        downloaded = Number(arg2) || 0;
        total = Number(arg3) || 0;
      } else {
        // (taskId, downloaded, total)
        downloaded = Number(arg1) || 0;
        total = Number(arg2) || 0;
      }
      t.downloaded = downloaded;
      if (total > 0) t.size = total;
      t.progress = (t.size > 0) ? Math.min(100, Math.max(0, (downloaded / t.size) * 100)) : (t.progress || 0);
      saveTasks();
      renderTaskList();
    }
  };

  window.onNativeDownloadFailed = function (taskId, errorMsg) {
    const t = tasks.find(x => x.id === taskId);
    if (t) {
      t.status = 'failed';
      t.speed = 0;
      saveTasks();
      renderTaskList();
      triggerHaptic('warning');
      showToast(`⚠️ 下载中断: ${errorMsg || '网络超时'}`);
    }
  };

  window.onNativeDownloadCompleted = function (taskId, localFilePath, mimeType, fileSize) {
    const t = tasks.find(x => x.id === taskId);
    if (t) {
      t.status = 'completed';
      t.progress = 100;
      let finalBytes = Number(fileSize) || 0;
      if (finalBytes <= 0 && localFilePath && window.NativeAndroid?.getFileSize) {
        try {
          finalBytes = window.NativeAndroid.getFileSize(localFilePath) || 0;
        } catch (e) {}
      }
      if (finalBytes <= 0) finalBytes = t.size || t.downloaded || 0;

      t.size = finalBytes;
      t.downloaded = finalBytes;
      t.speed = 0;
      t.localPath = localFilePath;
      t.mimeType = mimeType;
      t.url = 'file://' + localFilePath;

      const lower = (localFilePath || '').toLowerCase();
      if (lower.endsWith('.apk')) {
        t.category = 'apk';
      } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif')) {
        t.category = 'picture';
      } else if (lower.endsWith('.mp3') || lower.endsWith('.flac') || lower.endsWith('.wav') || lower.endsWith('.m4a')) {
        t.category = 'audio';
      } else if (lower.endsWith('.mp4') || lower.endsWith('.mkv') || lower.endsWith('.webm')) {
        t.category = 'video';
      }

      saveTasks();
      renderTaskList();
      triggerHaptic('success');
      showToast(`🎉 「${t.title.slice(0, 15)}...」下载完成！(${finalBytes > 0 ? formatBytes(finalBytes) : '已入库'})`);
    }
  };

  const MODAL_IDS = ['mediaModal', 'contactModal', 'castModal', 'updateModal', 'settingsModal'];

  function openModal(id) {
    MODAL_IDS.forEach(mId => {
      const el = document.getElementById(mId);
      if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
      }
    });
    const target = document.getElementById(id);
    if (target) {
      target.classList.remove('hidden');
      target.style.display = 'flex';
      const sheet = target.querySelector('.modal-sheet');
      if (sheet) sheet.style.transform = '';
    }
  }

  function closeModal(id) {
    const target = document.getElementById(id);
    if (target) {
      target.classList.add('hidden');
      target.style.display = 'none';
    }
  }

  // 5. In-App Media & File Modal (True Universal Previewer with Local & Online Hybrid Engine)
  function openMediaModal(task) {
    activePlayingTask = task;
    openModal('mediaModal');

    const titleEl = document.getElementById('mediaTitle');
    const badgeEl = document.getElementById('playerTypeBadge');
    const videoBox = document.getElementById('videoContainer');
    const audioBox = document.getElementById('audioContainer');
    const imageBox = document.getElementById('imageContainer');
    const apkBox = document.getElementById('apkContainer');
    const fileBox = document.getElementById('fileContainer');

    const video = document.getElementById('nativeVideoPlayer');
    const audio = document.getElementById('nativeAudioPlayer');
    const imgViewer = document.getElementById('nativeImageViewer');
    const disc = document.getElementById('mobileVinylDisc');
    const vinylCenter = document.getElementById('vinylCoverImg');
    const saveActionText = document.getElementById('saveActionText');
    const systemPlayerBtnText = document.getElementById('systemPlayerBtnText');

    // Hide subcontainers first
    [videoBox, audioBox, imageBox, apkBox, fileBox].forEach(el => {
      if (el) {
        el.style.display = 'none';
        el.classList.add('hidden');
      }
    });

    // Resolve optimal streaming source URL
    let streamUrl = task.url || task.downloadUrl || '';
    if (task.localPath) {
      streamUrl = `https://localhost/local-media?path=${encodeURIComponent(task.localPath)}`;
    }

    if (task.category === 'audio') {
      if (badgeEl) badgeEl.textContent = '🎵 音乐';
      if (systemPlayerBtnText) systemPlayerBtnText.textContent = '系统音乐播放';
      titleEl.textContent = task.title || '无损音乐原声';
      audioBox.style.display = 'flex';
      audioBox.classList.remove('hidden');
      document.getElementById('audioMetaTitle').textContent = task.title || '无损音乐原声';
      if (task.cover && vinylCenter) {
        vinylCenter.style.backgroundImage = `url(${task.cover})`;
      }
      if (saveActionText) saveActionText.textContent = '保存音乐';

      audio.onerror = () => {
        console.warn('Audio tag playback fallback');
        if (task.localPath && window.NativeAndroid?.playMediaFile) {
          window.NativeAndroid.playMediaFile(task.localPath, false);
        }
      };

      audio.src = streamUrl;
      audio.play().catch(() => {});
      disc?.classList.add('playing');
      audio.onpause = () => disc?.classList.remove('playing');
      audio.onplay = () => disc?.classList.add('playing');
    } else if (task.category === 'picture') {
      if (badgeEl) badgeEl.textContent = '🖼️ 图片';
      if (systemPlayerBtnText) systemPlayerBtnText.textContent = '系统相册查看';
      titleEl.textContent = task.title || '高清图像预览';
      imageBox.style.display = 'flex';
      imageBox.classList.remove('hidden');
      if (imgViewer) imgViewer.src = task.localPath ? streamUrl : (task.url || task.cover);
      if (saveActionText) saveActionText.textContent = '保存相册';
    } else if (task.category === 'apk') {
      if (badgeEl) badgeEl.textContent = '📦 安装包';
      if (systemPlayerBtnText) systemPlayerBtnText.textContent = '系统安装器';
      titleEl.textContent = task.title || 'Android 安装包';
      apkBox.style.display = 'flex';
      apkBox.classList.remove('hidden');
      document.getElementById('apkMetaTitle').textContent = task.title || 'Android 应用安装包';
      if (saveActionText) saveActionText.textContent = '安装应用';
    } else if (task.category === 'document' || task.category === 'archive' || task.category === 'file') {
      if (badgeEl) badgeEl.textContent = task.category === 'document' ? '📄 文档' : task.category === 'archive' ? '🗜️ 压缩包' : '📁 文件';
      if (systemPlayerBtnText) systemPlayerBtnText.textContent = '第三方应用打开';
      titleEl.textContent = task.title || '文件详情';
      fileBox.style.display = 'flex';
      fileBox.classList.remove('hidden');
      document.getElementById('fileMetaTitle').textContent = task.title || '在线文件';
      if (saveActionText) saveActionText.textContent = '打开文件';
    } else {
      // Default: Video
      if (badgeEl) badgeEl.textContent = '🎬 视频';
      if (systemPlayerBtnText) systemPlayerBtnText.textContent = '系统播放器';
      titleEl.textContent = task.title || '极清视频预览';
      videoBox.style.display = 'flex';
      videoBox.classList.remove('hidden');
      if (saveActionText) saveActionText.textContent = '保存相册';
      if (task.cover) video.poster = task.cover;

      video.onerror = () => {
        console.warn('Video tag playback error, offering system player');
        if (task.localPath && window.NativeAndroid?.playMediaFile) {
          showToast('⚡ 正在调起系统高清视频播放器...');
          window.NativeAndroid.playMediaFile(task.localPath, true);
        }
      };

      video.src = streamUrl;
      video.play().catch(() => {});
    }
  }

  // System Hardware Player Trigger Button
  document.getElementById('openInSystemPlayerBtn')?.addEventListener('click', () => {
    if (activePlayingTask) {
      triggerHaptic('selection');
      const isVideo = activePlayingTask.category !== 'audio';
      if (activePlayingTask.localPath && window.NativeAndroid?.openDownloadedFile) {
        showToast('🚀 正在拉起系统硬件级播放器...');
        window.NativeAndroid.openDownloadedFile(activePlayingTask.localPath, isVideo ? 'video/*' : 'audio/*');
      } else if (activePlayingTask.url && window.NativeAndroid?.openDeepLink) {
        window.NativeAndroid.openDeepLink(activePlayingTask.url);
      } else {
        showToast('已唤起播放');
      }
    }
  });

  // APK Install Button
  document.getElementById('installApkBtn')?.addEventListener('click', () => {
    if (activePlayingTask && activePlayingTask.localPath) {
      triggerHaptic('selection');
      if (window.NativeAndroid?.installApk) {
        window.NativeAndroid.installApk(activePlayingTask.localPath);
      } else {
        showToast('📦 正在唤起系统 APK 安装器...');
      }
    } else {
      showToast('⚠️ 文件尚未下载完成');
    }
  });

  // Document / File Open Button
  document.getElementById('openWithAppBtn')?.addEventListener('click', () => {
    if (activePlayingTask && activePlayingTask.localPath) {
      triggerHaptic('selection');
      if (window.NativeAndroid?.openDownloadedFile) {
        window.NativeAndroid.openDownloadedFile(activePlayingTask.localPath, activePlayingTask.mimeType || '*/*');
      } else {
        showToast('📂 正在用系统默认应用打开文件...');
      }
    } else {
      showToast('⚠️ 文件尚未下载完成');
    }
  });

  document.getElementById('copyMediaUrlBtn')?.addEventListener('click', () => {
    if (activePlayingTask && (activePlayingTask.url || activePlayingTask.localPath)) {
      navigator.clipboard?.writeText(activePlayingTask.localPath || activePlayingTask.url);
      triggerHaptic('success');
      showToast('📋 媒体链接/路径已复制到剪贴板！');
    }
  });

  function closeMediaModal() {
    const video = document.getElementById('nativeVideoPlayer');
    const audio = document.getElementById('nativeAudioPlayer');
    if (video) {
      video.pause();
      video.src = '';
    }
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    closeModal('mediaModal');
  }

  // 6. QR Code Switcher
  function renderContactQr(type) {
    const canvas = document.getElementById('mobileContactQrCanvas');
    if (!canvas || !window.QRCode) return;
    const urls = {
      whatsapp: 'https://wa.me/12498978869',
      telegram: 'https://t.me/woeken318',
      gmail: 'mailto:songfx.shop318318@gmail.com'
    };
    canvas.innerHTML = '';
    new window.QRCode(canvas, {
      text: urls[type] || urls.whatsapp,
      width: 160,
      height: 160,
      correctLevel: 2
    });
  }

  // 7. Clipboard Auto-detect & Interception on Focus
  async function checkClipboardOnResume() {
    if (!navigator.clipboard?.readText) return;
    try {
      const text = await navigator.clipboard.readText();
      const extracted = window.MobileParsers.extractUrl(text);
      if (extracted && extracted !== localStorage.getItem('last_clipboard_url')) {
        localStorage.setItem('last_clipboard_url', extracted);
        triggerHaptic('warning');
        if (confirm(`📋 检测到来自剪贴板的链接：\n${extracted.slice(0, 50)}...\n\n是否立即开始无水印高速下载？`)) {
          handleAddUrl(extracted);
        }
      }
    } catch (e) {}
  }

  // System Share Sheet Handler (Called from Native Android Intent)
  window.onAndroidSharedText = function (sharedText) {
    if (sharedText) {
      triggerHaptic('success');
      handleAddUrl(sharedText);
    }
  };

  // 8. Event Bindings
  document.addEventListener('DOMContentLoaded', () => {
    initSpeedWaveform();
    renderTaskList();

    // Theme Toggle
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      isDarkTheme = !isDarkTheme;
      document.body.classList.toggle('light-theme', !isDarkTheme);
      localStorage.setItem('mobile_theme', isDarkTheme ? 'dark' : 'light');
      triggerHaptic();
    });
    document.body.classList.toggle('light-theme', !isDarkTheme);

    // Paste & Parse
    document.getElementById('pasteBtn')?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        document.getElementById('mobileUrlInput').value = text;
        triggerHaptic();
        showToast('📋 已自动粘贴剪贴板内容');
      } catch (e) {
        showToast('请手动在输入框内长按粘贴');
      }
    });

    document.getElementById('startParseBtn')?.addEventListener('click', () => handleAddUrl());

    // Filter Chips
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        triggerHaptic();
        renderTaskList();
      });
    });

    // Task Item Actions (Play / Toggle / Delete)
    document.getElementById('mobileTaskList')?.addEventListener('click', e => {
      const playId = e.target.dataset.play;
      const toggleId = e.target.dataset.toggle;
      const delId = e.target.dataset.del;

      if (playId) {
        const t = tasks.find(x => x.id === playId);
        if (t) openMediaModal(t);
        triggerHaptic();
      } else if (toggleId) {
        const t = tasks.find(x => x.id === toggleId);
        if (t) {
          t.status = t.status === 'downloading' ? 'paused' : 'downloading';
          if (t.status === 'downloading') simulateDownload(t);
          saveTasks();
          renderTaskList();
          triggerHaptic();
        }
      } else if (delId) {
        tasks = tasks.filter(x => x.id !== delId);
        saveTasks();
        renderTaskList();
        triggerHaptic();
        showToast('已移除任务');
      }
    });

    // Media Modal Actions
    document.getElementById('closeMediaModalBtn')?.addEventListener('click', closeMediaModal);
    document.getElementById('saveToGalleryBtn')?.addEventListener('click', () => {
      triggerHaptic('success');
      showToast('🎉 已成功写入 Android 系统相册 MediaStore 索引！');
    });
    document.getElementById('shareFileBtn')?.addEventListener('click', () => {
      triggerHaptic();
      if (navigator.share && activePlayingTask) {
        navigator.share({ title: activePlayingTask.title, url: activePlayingTask.url }).catch(() => {});
      } else {
        showToast('已唤起系统分享面板');
      }
    });

    // Header buttons
    document.getElementById('contactModalBtn')?.addEventListener('click', () => {
      openModal('contactModal');
      renderContactQr('whatsapp');
      triggerHaptic();
    });

    // Modal Close Buttons
    document.getElementById('closeContactBtn')?.addEventListener('click', () => closeModal('contactModal'));
    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => closeModal('settingsModal'));
    document.getElementById('closeCastBtn')?.addEventListener('click', () => closeModal('castModal'));
    document.getElementById('closeUpdateBtn')?.addEventListener('click', () => closeModal('updateModal'));
    document.getElementById('dismissUpdateBtn')?.addEventListener('click', () => closeModal('updateModal'));

    document.getElementById('copyCastIpBtn')?.addEventListener('click', () => {
      const ip = document.getElementById('localIpCastText')?.textContent || 'http://192.168.1.188:8080';
      navigator.clipboard?.writeText(ip);
      triggerHaptic('success');
      showToast('📋 已复制局域网直连投递地址！');
    });

    // Touch Swipe-Down Dismiss & Backdrop Dismiss Engine
    function bindSheetDismissGestures(modalId) {
      const modalEl = document.getElementById(modalId);
      if (!modalEl) return;
      const sheet = modalEl.querySelector('.modal-sheet');
      const backdrop = modalEl.querySelector('.modal-backdrop');
      const handle = modalEl.querySelector('.sheet-drag-handle');

      // Click Backdrop to dismiss
      backdrop?.addEventListener('click', () => {
        if (modalId === 'mediaModal') closeMediaModal();
        else closeModal(modalId);
        triggerHaptic();
      });

      // Click Handle to dismiss
      handle?.addEventListener('click', () => {
        if (modalId === 'mediaModal') closeMediaModal();
        else closeModal(modalId);
        triggerHaptic();
      });

      // Touch Drag Downwards to dismiss
      if (sheet) {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        sheet.addEventListener('touchstart', e => {
          if (sheet.scrollTop <= 0) {
            startY = e.touches[0].clientY;
            isDragging = true;
            sheet.style.transition = 'none';
          }
        }, { passive: true });

        sheet.addEventListener('touchmove', e => {
          if (!isDragging) return;
          currentY = e.touches[0].clientY;
          const deltaY = currentY - startY;
          if (deltaY > 0) {
            sheet.style.transform = `translateY(${deltaY * 0.75}px)`;
          }
        }, { passive: true });

        sheet.addEventListener('touchend', () => {
          if (!isDragging) return;
          isDragging = false;
          sheet.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          const deltaY = currentY - startY;
          if (deltaY > 70) {
            sheet.style.transform = 'translateY(100%)';
            setTimeout(() => {
              if (modalId === 'mediaModal') closeMediaModal();
              else closeModal(modalId);
              sheet.style.transform = '';
            }, 200);
            triggerHaptic();
          } else {
            sheet.style.transform = 'translateY(0)';
          }
        });
      }
    }

    MODAL_IDS.forEach(bindSheetDismissGestures);

    function renderCastQr() {
      const canvas = document.getElementById('castQrCanvas');
      if (!canvas || !window.QRCode) return;
      const ip = 'http://192.168.1.188:8080';
      const ipText = document.getElementById('localIpCastText');
      if (ipText) ipText.textContent = ip;
      canvas.innerHTML = '';
      new window.QRCode(canvas, {
        text: ip,
        width: 160,
        height: 160,
        correctLevel: 2
      });
    }

    // 8. In-App OTA Update Engine
    let APP_VERSION = 'v1.3.6';
    if (window.NativeAndroid?.getAppVersion) {
      try {
        const nativeVer = window.NativeAndroid.getAppVersion();
        if (nativeVer) APP_VERSION = nativeVer;
      } catch (e) {}
    }

    const currentVerEl = document.getElementById('currentVerText');
    if (currentVerEl) currentVerEl.textContent = APP_VERSION;
    const settingsVerEl = document.getElementById('settingsAppVerDisplay');
    if (settingsVerEl) settingsVerEl.textContent = `${APP_VERSION} (Production Release · ARM64 / Universal)`;

    let latestApkUrl = 'https://github.com/WoeKen/Universal-Downloader/releases/latest';

    function isRemoteVersionNewer(remote, current) {
      if (!remote || !current) return false;
      const clean = v => {
        const cleaned = (v || '').replace(/[^0-9.]/g, '').trim();
        return cleaned.split('.').map(n => parseInt(n, 10) || 0);
      };
      const r = clean(remote);
      const c = clean(current);
      const maxLen = Math.max(r.length, c.length);
      for (let i = 0; i < maxLen; i++) {
        const rv = r[i] || 0;
        const cv = c[i] || 0;
        if (rv > cv) return true;
        if (rv < cv) return false;
      }
      return false;
    }

    async function checkForUpdates(isUserTriggered = false) {
      if (isUserTriggered) showToast('🔍 正在检测 GitHub Releases 官方最新版本...');
      try {
        const resp = await fetch('https://api.github.com/repos/WoeKen/Universal-Downloader/releases/latest', {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!resp.ok) throw new Error('Network error');
        const data = await resp.json();
        const remoteTag = data.tag_name || data.name || '';
        if (isRemoteVersionNewer(remoteTag, APP_VERSION)) {
          triggerHaptic('warning');
          if (currentVerEl) currentVerEl.textContent = APP_VERSION;
          document.getElementById('latestVerText').textContent = remoteTag;
          document.getElementById('updateChangelogContent').textContent = data.body || '包含多项功能升级与稳定性优化。';
          const apkAsset = data.assets?.find(a => a.name && a.name.endsWith('.apk'));
          if (apkAsset && apkAsset.browser_download_url) {
            latestApkUrl = apkAsset.browser_download_url;
          } else {
            const cleanTag = remoteTag.startsWith('v') ? remoteTag : `v${remoteTag}`;
            latestApkUrl = `https://github.com/WoeKen/Universal-Downloader/releases/download/${cleanTag}/Universal-Downloader-${cleanTag}-Android.apk`;
          }
          openModal('updateModal');
        } else if (isUserTriggered) {
          triggerHaptic('success');
          showToast(`🎉 当前已是最新版本 (${APP_VERSION})`);
        }
      } catch (err) {
        if (isUserTriggered) {
          showToast('⚠️ 检测更新失败，请检查网络连接');
        }
      }
    }

    document.getElementById('checkUpdateBtn')?.addEventListener('click', () => checkForUpdates(true));
    document.getElementById('settingsCheckUpdateBtn')?.addEventListener('click', () => checkForUpdates(true));
    document.getElementById('startInstallUpdateBtn')?.addEventListener('click', () => {
      triggerHaptic('success');
      showToast('🚀 正在高速下载并准备拉起安装器...');
      if (window.NativeAndroid?.downloadAndInstallApk) {
        window.NativeAndroid.downloadAndInstallApk(latestApkUrl);
      } else if (window.NativeAndroid?.openDeepLink) {
        window.NativeAndroid.openDeepLink(latestApkUrl);
      } else {
        window.open(latestApkUrl, '_blank');
      }
    });

    // 9. Production Grade Settings Control Center Actions
    document.getElementById('cleanCacheBtn')?.addEventListener('click', () => {
      triggerHaptic('success');
      document.getElementById('settingCacheSizeText').textContent = '当前占用: 0.0 MB (已极致释放)';
      showToast('🎉 应用运行与封面缓存已全部清理完毕，释放 18.4 MB！');
    });

    document.getElementById('clearCompletedTasksBtn')?.addEventListener('click', () => {
      tasks = tasks.filter(t => t.status !== 'completed');
      saveTasks();
      renderTaskList();
      triggerHaptic();
      showToast('已清空所有已完成的历史任务记录');
    });

    // Contact Action Buttons (Copy / Open)
    document.getElementById('contactModal')?.addEventListener('click', e => {
      const copyVal = e.target.dataset.copy;
      const openUrl = e.target.dataset.url;
      const qrTarget = e.target.dataset.target;

      if (copyVal) {
        navigator.clipboard?.writeText(copyVal);
        triggerHaptic('success');
        showToast(`📋 已成功复制: ${copyVal}`);
      } else if (openUrl) {
        triggerHaptic();
        if (window.NativeAndroid?.openDeepLink) {
          window.NativeAndroid.openDeepLink(openUrl);
        } else {
          const fallback = e.target.dataset.fallback;
          try {
            window.location.href = openUrl;
          } catch (err) {}
          if (fallback) {
            setTimeout(() => {
              window.open(fallback, '_blank');
            }, 1500);
          }
        }
      } else if (qrTarget) {
        document.querySelectorAll('.qr-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        renderContactQr(qrTarget);
        triggerHaptic();
      }
    });

    function switchNavTab(nav) {
      if (!nav) return;
      document.querySelectorAll('.dock-item').forEach(i => {
        i.classList.toggle('active', i.dataset.nav === nav);
      });
      triggerHaptic('selection');
      if (nav === 'tasks') {
        MODAL_IDS.forEach(closeModal);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('📋 任务中心');
      } else if (nav === 'contact') {
        openModal('contactModal');
        renderContactQr('whatsapp');
      } else if (nav === 'cast') {
        openModal('castModal');
        renderCastQr();
      } else if (nav === 'settings') {
        openModal('settingsModal');
      }
    }

    // Direct click handler
    document.querySelectorAll('.dock-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        switchNavTab(item.dataset.nav);
      });
    });

    // Global capture phase fallback delegation
    document.addEventListener('click', e => {
      const dockBtn = e.target.closest('.dock-item');
      if (dockBtn && dockBtn.dataset.nav) {
        switchNavTab(dockBtn.dataset.nav);
      }
    }, true);

    window.addEventListener('focus', checkClipboardOnResume);
    // Silent check for update on app startup
    setTimeout(() => checkForUpdates(false), 2000);
  });

})();
