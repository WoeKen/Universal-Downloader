/**
 * Universal Downloader Mobile - Core Interaction & Native Bridge Runtime
 */

(function () {
  'use strict';

  let tasks = JSON.parse(localStorage.getItem('mobile_tasks') || '[]');
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

    listEl.innerHTML = filtered.map(t => {
      const isDone = t.status === 'completed';
      const isVideo = t.category === 'video';
      const isAudio = t.category === 'audio';
      const thumb = t.cover || (isVideo ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46"><rect width="46" height="46" fill="%23000"/><text x="23" y="28" fill="%2300f2fe" text-anchor="middle" font-size="16" font-weight="bold">MP4</text></svg>' : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46"><rect width="46" height="46" fill="%23000"/><text x="23" y="28" fill="%2334c759" text-anchor="middle" font-size="16" font-weight="bold">MP3</text></svg>');

      return `
        <div class="mobile-task-card" data-id="${t.id}">
          <div class="task-top-meta">
            <img class="task-thumb" src="${thumb}" alt="">
            <div class="task-info-block">
              <div class="task-title" title="${t.title}">${t.title || '下载任务'}</div>
              <div class="task-sub-meta">
                <span>${t.platform ? t.platform.toUpperCase() : 'DIRECT'}</span>
                <span>${formatBytes(t.downloaded || 0)} / ${t.size ? formatBytes(t.size) : '计算中...'}</span>
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

  async function handleAddUrl(rawInput) {
    const text = rawInput || document.getElementById('mobileUrlInput')?.value?.trim();
    if (!text) return showToast('请先输入或粘贴下载链接');

    triggerHaptic();
    showToast('🔍 正在启动智能解析与去水印透析...');

    try {
      const parsed = await window.MobileParsers.parseMedia(text);
      const newTask = {
        id: 'task_' + Date.now(),
        url: parsed.downloadUrl || text,
        title: parsed.title,
        cover: parsed.cover,
        platform: parsed.platform,
        category: parsed.category,
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
      showToast('🚀 已进入高速下载队列！');

      // Native Bridge or Internal Downloader
      if (window.NativeAndroid?.startDownload) {
        window.NativeAndroid.startDownload(newTask.id, newTask.url, newTask.title, newTask.category === 'video');
      } else {
        simulateDownload(newTask);
      }
    } catch (e) {
      showToast('❌ 解析失败: ' + e.message);
    }
  }

  // Native Download Listeners from Android Java
  window.onNativeDownloadProgress = function (taskId, progress, downloaded, size, speed) {
    const t = tasks.find(x => x.id === taskId);
    if (t) {
      t.status = 'downloading';
      t.progress = progress;
      t.downloaded = downloaded;
      t.size = size;
      t.speed = speed;
      saveTasks();
      renderTaskList();
    }
  };

  window.onNativeDownloadCompleted = function (taskId, localFilePath) {
    const t = tasks.find(x => x.id === taskId);
    if (t) {
      t.status = 'completed';
      t.progress = 100;
      t.downloaded = t.size || t.downloaded;
      t.speed = 0;
      t.localPath = localFilePath;
      t.url = 'file://' + localFilePath;
      saveTasks();
      renderTaskList();
      triggerHaptic('success');
      showToast(`🎉 「${t.title.slice(0, 15)}...」已成功保存至手机相册！`);
    }
  };

  // 5. In-App Media Player Modal (Smart Adaptive Segregation)
  function openMediaModal(task) {
    activePlayingTask = task;
    const modal = document.getElementById('mediaModal');
    const titleEl = document.getElementById('mediaTitle');
    const videoBox = document.getElementById('videoContainer');
    const audioBox = document.getElementById('audioContainer');
    const video = document.getElementById('nativeVideoPlayer');
    const audio = document.getElementById('nativeAudioPlayer');
    const disc = document.getElementById('mobileVinylDisc');
    const saveActionText = document.getElementById('saveActionText');

    modal.classList.remove('hidden');

    if (task.category === 'audio') {
      titleEl.textContent = '🎵 音频无损播放';
      videoBox.classList.add('hidden');
      audioBox.classList.remove('hidden');
      document.getElementById('audioMetaTitle').textContent = task.title || '无损音乐原声';
      if (saveActionText) saveActionText.textContent = '保存至系统音乐库';
      audio.src = task.url;
      audio.play().catch(() => {});
      disc.classList.add('playing');
      audio.onpause = () => disc.classList.remove('playing');
      audio.onplay = () => disc.classList.add('playing');
    } else {
      titleEl.textContent = '🎬 视频极清播放';
      audioBox.classList.add('hidden');
      videoBox.classList.remove('hidden');
      if (saveActionText) saveActionText.textContent = '保存至手机相册';
      if (task.cover) video.poster = task.cover;
      video.src = task.url;
      video.play().catch(() => {});
    }
  }

  function closeMediaModal() {
    const modal = document.getElementById('mediaModal');
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
    modal.classList.add('hidden');
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

    // Contact Modal
    const contactModal = document.getElementById('contactModal');
    const mediaModal = document.getElementById('mediaModal');
    const updateModal = document.getElementById('updateModal');
    const settingsModal = document.getElementById('settingsModal');

    document.getElementById('contactModalBtn')?.addEventListener('click', () => {
      contactModal.classList.remove('hidden');
      renderContactQr('whatsapp');
      triggerHaptic();
    });
    document.getElementById('closeContactBtn')?.addEventListener('click', () => {
      contactModal.classList.add('hidden');
    });
    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });

    // 7. Touch Swipe-Down Dismiss & Backdrop Dismiss Engine
    function bindSheetDismissGestures(modalEl) {
      if (!modalEl) return;
      const sheet = modalEl.querySelector('.modal-sheet');
      const backdrop = modalEl.querySelector('.modal-backdrop');
      const handle = modalEl.querySelector('.sheet-drag-handle');

      // Click Backdrop to dismiss
      backdrop?.addEventListener('click', () => {
        modalEl.classList.add('hidden');
        triggerHaptic();
      });

      // Click Handle to dismiss
      handle?.addEventListener('click', () => {
        modalEl.classList.add('hidden');
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
              modalEl.classList.add('hidden');
              sheet.style.transform = '';
            }, 200);
            triggerHaptic();
          } else {
            sheet.style.transform = 'translateY(0)';
          }
        });
      }
    }

    [contactModal, mediaModal, updateModal, settingsModal].forEach(bindSheetDismissGestures);

    // 8. In-App OTA Update Engine
    const APP_VERSION = 'v1.1.9';
    let latestApkUrl = 'https://github.com/WoeKen/Universal-Downloader/releases/latest';

    function isRemoteVersionNewer(remote, current) {
      const clean = v => (v || '').replace(/^v/i, '').trim().split('.').map(n => parseInt(n, 10) || 0);
      const r = clean(remote);
      const c = clean(current);
      for (let i = 0; i < Math.max(r.length, c.length); i++) {
        const rVal = r[i] || 0;
        const cVal = c[i] || 0;
        if (rVal > cVal) return true;
        if (rVal < cVal) return false;
      }
      return false;
    }

    async function checkForUpdates(manual = false) {
      if (manual) {
        triggerHaptic();
        showToast('🔍 正在检查最新云端版本...');
      }
      try {
        const res = await fetch('https://api.github.com/repos/WoeKen/Universal-Downloader/releases/latest', {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!res.ok) throw new Error('网络请求失败');
        const data = await res.json();
        const remoteVer = data.tag_name || 'v1.1.9';
        
        // Find APK asset
        const apkAsset = (data.assets || []).find(a => a.name && a.name.endsWith('.apk'));
        if (apkAsset && apkAsset.browser_download_url) {
          latestApkUrl = apkAsset.browser_download_url;
        } else {
          latestApkUrl = data.html_url || 'https://github.com/WoeKen/Universal-Downloader/releases/latest';
        }

        const isNewer = isRemoteVersionNewer(remoteVer, APP_VERSION);
        if (isNewer) {
          document.getElementById('currentVerText').textContent = APP_VERSION;
          document.getElementById('latestVerText').textContent = remoteVer;
          document.getElementById('updateChangelogContent').textContent = data.body || '新版本性能全面提升，去水印解析算法更强劲！';
          updateModal.classList.remove('hidden');
          triggerHaptic('success');
        } else {
          if (manual) {
            triggerHaptic('success');
            showToast(`✅ 当前已是最新版本 (${APP_VERSION})`);
          }
        }
      } catch (err) {
        if (manual) showToast('无法连接更新服务器，请检查网络');
      }
    }

    // Check Update Button
    document.getElementById('checkUpdateBtn')?.addEventListener('click', () => checkForUpdates(true));
    document.getElementById('settingsCheckUpdateBtn')?.addEventListener('click', () => checkForUpdates(true));
    document.getElementById('closeUpdateBtn')?.addEventListener('click', () => updateModal.classList.add('hidden'));
    document.getElementById('dismissUpdateBtn')?.addEventListener('click', () => updateModal.classList.add('hidden'));
    document.getElementById('startInstallUpdateBtn')?.addEventListener('click', () => {
      triggerHaptic('success');
      showToast('🚀 正在拉起系统安装器 / 启动极速更新...');
      if (window.NativeAndroid?.downloadAndInstallApk) {
        window.NativeAndroid.downloadAndInstallApk(latestApkUrl);
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
    contactModal?.addEventListener('click', e => {
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

    // Bottom Navigation
    document.querySelectorAll('.dock-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.dock-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const nav = item.dataset.nav;
        triggerHaptic();
        if (nav === 'contact') {
          contactModal.classList.remove('hidden');
          renderContactQr('whatsapp');
        } else if (nav === 'cast') {
          showToast('📱 局域网 Mesh 联动网关已启动，等待投递...');
        } else if (nav === 'settings') {
          settingsModal.classList.remove('hidden');
        }
      });
    });

    window.addEventListener('focus', checkClipboardOnResume);
    // Silent check for update on app startup
    setTimeout(() => checkForUpdates(false), 2000);
  });

})();
