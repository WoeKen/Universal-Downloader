// Background service worker for Universal Downloader Extension (MV3)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ud_download_link",
    title: "🚀 使用全能下载器极速下载链接",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "ud_download_media",
    title: "🎬 使用全能下载器嗅探下载此媒体",
    contexts: ["video", "audio", "image"]
  });

  chrome.contextMenus.create({
    id: "ud_download_page",
    title: "✨ 解析此网页中的视频/媒体",
    contexts: ["page"]
  });
});

async function sendToDownloader(url, title = '') {
  try {
    const res = await fetch('http://127.0.0.1:19876/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title })
    });
    const data = await res.json();
    return !!(data && data.success);
  } catch (err) {
    // If desktop local server is not listening, fallback to system protocol handler
    const protocolUrl = `all-download://?url=${encodeURIComponent(url)}`;
    chrome.tabs.create({ url: protocolUrl, active: false }, (newTab) => {
      setTimeout(() => {
        if (newTab && newTab.id) {
          chrome.tabs.remove(newTab.id).catch(() => {});
        }
      }, 2500);
    });
    return false;
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  let targetUrl = '';
  if (info.menuItemId === "ud_download_link") {
    targetUrl = info.linkUrl;
  } else if (info.menuItemId === "ud_download_media") {
    targetUrl = info.srcUrl;
  } else if (info.menuItemId === "ud_download_page") {
    targetUrl = info.pageUrl || tab.url;
  }

  if (targetUrl) {
    sendToDownloader(targetUrl, tab?.title || '');
  }
});

// Receive messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadUrl" && request.url) {
    sendToDownloader(request.url, request.title || sender.tab?.title || '').then(success => {
      sendResponse({ success });
    });
    return true; // Keep message channel open for async response
  }
});
