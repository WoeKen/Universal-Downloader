// Universal Downloader Content Script - Smart Video Badge & Instant Delivery
(function() {
  function showFloatingToast(text) {
    let toast = document.getElementById('ud-floating-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ud-floating-toast';
      toast.style = 'position:fixed;bottom:36px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(18,24,38,0.94);backdrop-filter:blur(20px);color:#00f2fe;border:1px solid rgba(0,242,254,0.4);border-radius:30px;padding:10px 20px;font-size:13px;font-weight:700;box-shadow:0 12px 40px rgba(0,0,0,0.6);transition:all 0.3s ease;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(12px)';
    }, 2500);
  }

  function attachVideoBadge(video) {
    if (video.dataset.udAttached) return;
    video.dataset.udAttached = "true";

    const badge = document.createElement('div');
    badge.className = 'ud-floating-video-badge';
    badge.innerHTML = `<span>⚡ 全能下载</span>`;
    badge.title = "点击直接投递到全能下载器桌面端";

    badge.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      badge.innerHTML = `<span>⏳ 投递中...</span>`;
      
      const targetUrl = window.location.href;
      const title = document.title || '';

      chrome.runtime.sendMessage({ action: "downloadUrl", url: targetUrl, title }, (res) => {
        if (res && res.success) {
          badge.innerHTML = `<span>✓ 已投递</span>`;
          showFloatingToast('✨ 已成功投递至全能下载器，正在下载中！');
          setTimeout(() => { badge.innerHTML = `<span>⚡ 全能下载</span>`; }, 2000);
        } else {
          badge.innerHTML = `<span>⚠️ 投递异常</span>`;
          showFloatingToast('⚠️ 投递失败：请确保全能下载器客户端正在运行');
          setTimeout(() => { badge.innerHTML = `<span>⚡ 全能下载</span>`; }, 2500);
        }
      });
    };

    if (video.parentElement) {
      const computed = window.getComputedStyle(video.parentElement);
      if (computed.position === 'static') {
        video.parentElement.style.position = 'relative';
      }
      video.parentElement.appendChild(badge);
    }
  }

  function scanVideos() {
    document.querySelectorAll('video').forEach(attachVideoBadge);
  }

  setInterval(scanVideos, 2000);
  scanVideos();
})();
