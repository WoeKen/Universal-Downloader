package com.universal.downloader;

import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import java.io.File;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private String pendingSharedText = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Enable Hardware GPU Acceleration for 120Hz smooth animations
        getWindow().setFlags(android.view.WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED, 
                               android.view.WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);

        webView = new WebView(this);
        webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setLoadsImagesAutomatically(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.addJavascriptInterface(new AndroidNativeBridge(), "NativeAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (pendingSharedText != null) {
                    dispatchSharedTextToWeb(pendingSharedText);
                    pendingSharedText = null;
                }
            }
        });

        // Load Liquid Glass Mobile UI with zero-latency asset pipeline
        webView.loadUrl("file:///android_asset/index.html");

        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        // 1. System Share Sheet Interception (ACTION_SEND from TikTok, Douyin, YouTube, etc.)
        if (Intent.ACTION_SEND.equals(action) && type != null) {
            if ("text/plain".equals(type)) {
                String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (sharedText != null && !sharedText.trim().isEmpty()) {
                    java.util.regex.Matcher m = java.util.regex.Pattern.compile("(https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+)").matcher(sharedText);
                    String cleanUrl = m.find() ? m.group(1).replaceAll("[\\u4e00-\\u9fa5)\\]}>,;。，！？、“”‘’]+$", "") : sharedText;
                    if (webView != null && webView.getProgress() == 100) {
                        dispatchSharedTextToWeb(cleanUrl);
                    } else {
                        pendingSharedText = cleanUrl;
                    }
                }
            }
        } else if (Intent.ACTION_VIEW.equals(action)) {
            Uri data = intent.getData();
            if (data != null) {
                String uriString = data.toString();
                dispatchSharedTextToWeb(uriString);
            }
        }
    }

    private void dispatchSharedTextToWeb(final String text) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null) {
                    String escaped = text.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n");
                    webView.evaluateJavascript("window.onAndroidSharedText && window.onAndroidSharedText('" + escaped + "');", null);
                }
            }
        });
    }

    // Native Bridge Interface for JavaScript
    public class AndroidNativeBridge {

        @JavascriptInterface
        public void scanGalleryFile(String filePath, boolean isVideo) {
            try {
                File file = new File(filePath);
                if (file.exists()) {
                    String mimeType = isVideo ? "video/mp4" : "audio/mpeg";
                    MediaScannerConnection.scanFile(MainActivity.this,
                            new String[]{file.getAbsolutePath()},
                            new String[]{mimeType},
                            null);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void openDeepLink(String url) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                try {
                    // Fallback to web browser if native app not installed
                    if (url.startsWith("tg://")) {
                        Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://t.me/woeken318"));
                        webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(webIntent);
                    } else if (url.startsWith("whatsapp://")) {
                        Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/12498978869"));
                        webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(webIntent);
                    }
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
        }

        @JavascriptInterface
        public void resolveNativeMedia(final String rawInput, final String callbackId) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        // 1. Extract pure clean URL from messy Chinese/emoji text
                        java.util.regex.Matcher urlMatcher = java.util.regex.Pattern.compile("(https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+)").matcher(rawInput);
                        String cleanUrl = urlMatcher.find() ? urlMatcher.group(1).replaceAll("[\\u4e00-\\u9fa5)\\]}>,;。，！？、“”‘’]+$", "") : rawInput.trim();

                        // 2. Follow redirects to find target long URL & video ID
                        String currentUrl = cleanUrl;
                        String cookiesHeader = "";
                        for (int hop = 0; hop < 6; hop++) {
                            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) new java.net.URL(currentUrl).openConnection();
                            conn.setInstanceFollowRedirects(false);
                            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                            conn.connect();
                            int code = conn.getResponseCode();
                            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                                String loc = conn.getHeaderField("Location");
                                conn.disconnect();
                                if (loc != null && !loc.isEmpty()) {
                                    currentUrl = loc;
                                    continue;
                                }
                            }
                            conn.disconnect();
                            break;
                        }

                        // 3. Extract Video ID from redirected Long URL
                        String videoId = "";
                        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?:video/|modal_id=|item_ids=)(\\d+)").matcher(currentUrl);
                        if (m.find()) {
                            videoId = m.group(1);
                        }

                        if (!videoId.isEmpty()) {
                            // Step A: Fetch anonymous guest cookies from Douyin discover
                            java.net.CookieManager cookieManager = new java.net.CookieManager();
                            java.net.CookieHandler.setDefault(cookieManager);
                            try {
                                java.net.HttpURLConnection cookieConn = (java.net.HttpURLConnection) new java.net.URL("https://www.douyin.com/discover").openConnection();
                                cookieConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                                cookieConn.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9");
                                cookieConn.connect();
                                cookieConn.getResponseCode();
                                cookieConn.disconnect();
                            } catch (Exception ignored) {}

                            // Step B: Query official Web Aweme Detail API
                            String apiUrl = "https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=" + videoId;
                            java.net.HttpURLConnection apiConn = (java.net.HttpURLConnection) new java.net.URL(apiUrl).openConnection();
                            apiConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                            apiConn.setRequestProperty("Referer", "https://www.douyin.com/video/" + videoId);
                            apiConn.setRequestProperty("Accept", "application/json, text/plain, */*");
                            apiConn.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9");

                            java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(apiConn.getInputStream()));
                            StringBuilder sb = new StringBuilder();
                            String line;
                            while ((line = reader.readLine()) != null) {
                                sb.append(line);
                            }
                            reader.close();
                            apiConn.disconnect();

                            org.json.JSONObject json = new org.json.JSONObject(sb.toString());
                            org.json.JSONObject awemeDetail = json.optJSONObject("aweme_detail");
                            if (awemeDetail != null) {
                                String title = awemeDetail.optString("desc", "抖音无水印高清视频");
                                org.json.JSONObject videoObj = awemeDetail.optJSONObject("video");
                                if (videoObj != null) {
                                    String cover = "";
                                    org.json.JSONObject coverObj = videoObj.optJSONObject("cover");
                                    if (coverObj != null) {
                                        org.json.JSONArray covers = coverObj.optJSONArray("url_list");
                                        if (covers != null && covers.length() > 0) cover = covers.getString(0);
                                    }

                                    String playUrl = "";
                                    org.json.JSONObject h264Obj = videoObj.optJSONObject("play_addr_h264");
                                    if (h264Obj != null) {
                                        org.json.JSONArray h264List = h264Obj.optJSONArray("url_list");
                                        if (h264List != null && h264List.length() > 0) playUrl = h264List.getString(0);
                                    }
                                    if (playUrl.isEmpty()) {
                                        org.json.JSONObject playObj = videoObj.optJSONObject("play_addr");
                                        if (playObj != null) {
                                            org.json.JSONArray playList = playObj.optJSONArray("url_list");
                                            if (playList != null && playList.length() > 0) playUrl = playList.getString(0);
                                        }
                                    }

                                    if (!playUrl.isEmpty()) {
                                        final org.json.JSONObject result = new org.json.JSONObject();
                                        result.put("platform", "douyin");
                                        result.put("title", title);
                                        result.put("cover", cover);
                                        result.put("downloadUrl", playUrl);
                                        result.put("category", "video");

                                        runOnUiThread(new Runnable() {
                                            @Override
                                            public void run() {
                                                if (webView != null) {
                                                    String escaped = result.toString().replace("\\", "\\\\").replace("'", "\\'");
                                                    webView.evaluateJavascript("window.onNativeMediaResolved && window.onNativeMediaResolved('" + callbackId + "', '" + escaped + "');", null);
                                                }
                                            }
                                        });
                                        return;
                                    }
                                }
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }

                    // Fallback to Headless Web Stream Interception on UI Thread
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                java.util.regex.Matcher urlMatcher = java.util.regex.Pattern.compile("(https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+)").matcher(rawInput);
                                final String cleanUrl = urlMatcher.find() ? urlMatcher.group(1).replaceAll("[\\u4e00-\\u9fa5)\\]}>,;。，！？、“”‘’]+$", "") : rawInput.trim();

                                final WebView extractorView = new WebView(MainActivity.this);
                                WebSettings es = extractorView.getSettings();
                                es.setJavaScriptEnabled(true);
                                es.setDomStorageEnabled(true);
                                es.setMediaPlaybackRequiresUserGesture(false);
                                es.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                                es.setUserAgentString("Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.48");

                                final boolean[] resolved = {false};
                                final String[] capturedVideoUrl = {""};
                                final String[] capturedCoverUrl = {""};
                                final String[] capturedTitle = {""};

                                final Runnable finishCallback = new Runnable() {
                                    @Override
                                    public void run() {
                                        if (resolved[0]) return;
                                        resolved[0] = true;
                                        try {
                                            extractorView.stopLoading();
                                            extractorView.destroy();
                                        } catch (Exception ignored) {}

                                        String finalUrl = capturedVideoUrl[0];
                                        String finalCover = capturedCoverUrl[0];
                                        String finalTitle = capturedTitle[0];
                                        if (finalTitle.isEmpty()) finalTitle = "抖音无水印高清视频";

                                        if (!finalUrl.isEmpty()) {
                                            try {
                                                final org.json.JSONObject result = new org.json.JSONObject();
                                                result.put("platform", "douyin");
                                                result.put("title", finalTitle);
                                                result.put("cover", finalCover);
                                                result.put("downloadUrl", finalUrl);
                                                result.put("category", "video");

                                                if (webView != null) {
                                                    String escaped = result.toString().replace("\\", "\\\\").replace("'", "\\'");
                                                    webView.evaluateJavascript("window.onNativeMediaResolved && window.onNativeMediaResolved('" + callbackId + "', '" + escaped + "');", null);
                                                }
                                                return;
                                            } catch (Exception ignored) {}
                                        }

                                        if (webView != null) {
                                            webView.evaluateJavascript("window.onNativeMediaResolved && window.onNativeMediaResolved('" + callbackId + "', null);", null);
                                        }
                                    }
                                };

                                extractorView.postDelayed(finishCallback, 8000);

                                extractorView.setWebViewClient(new WebViewClient() {
                                    @Override
                                    public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, android.webkit.WebResourceRequest request) {
                                        if (request != null && request.getUrl() != null) {
                                            String reqUrl = request.getUrl().toString();
                                            if (reqUrl.contains("play/?video_id=") || reqUrl.contains("douyinvod.com") || reqUrl.contains(".mp4") || reqUrl.contains("mime_type=video_mp4")) {
                                                capturedVideoUrl[0] = reqUrl.replace("playwm", "play");
                                                extractorView.postDelayed(finishCallback, 500);
                                            }
                                        }
                                        return super.shouldInterceptRequest(view, request);
                                    }

                                    @Override
                                    public void onPageFinished(WebView view, String url) {
                                        super.onPageFinished(view, url);
                                        view.evaluateJavascript(
                                            "(function() {" +
                                            "  var v = document.querySelector('video');" +
                                            "  var src = v ? (v.currentSrc || v.src) : '';" +
                                            "  var poster = v ? v.poster : '';" +
                                            "  var title = document.title || '';" +
                                            "  return JSON.stringify({ src: src, poster: poster, title: title });" +
                                            "})()",
                                            new android.webkit.ValueCallback<String>() {
                                                @Override
                                                public void onReceiveValue(String val) {
                                                    if (val != null && !val.equals("null") && !val.isEmpty()) {
                                                        try {
                                                            String rawStr = val;
                                                            if (rawStr.startsWith("\"") && rawStr.endsWith("\"")) {
                                                                rawStr = org.json.JSONObject.stringToValue(rawStr).toString();
                                                            }
                                                            org.json.JSONObject domJson = new org.json.JSONObject(rawStr);
                                                            String dSrc = domJson.optString("src");
                                                            String dPoster = domJson.optString("poster");
                                                            String dTitle = domJson.optString("title");
                                                            if (!dSrc.isEmpty() && capturedVideoUrl[0].isEmpty()) capturedVideoUrl[0] = dSrc.replace("playwm", "play");
                                                            if (!dPoster.isEmpty()) capturedCoverUrl[0] = dPoster;
                                                            if (!dTitle.isEmpty()) capturedTitle[0] = dTitle.replace(" - 抖音", "").replace("在抖音记录美好生活", "").trim();
                                                        } catch (Exception ignored) {}
                                                    }
                                                    if (!capturedVideoUrl[0].isEmpty()) {
                                                        extractorView.post(finishCallback);
                                                    }
                                                }
                                            }
                                        );
                                    }
                                });

                                extractorView.loadUrl(cleanUrl);
                            } catch (Exception e) {
                                e.printStackTrace();
                                if (webView != null) {
                                    webView.evaluateJavascript("window.onNativeMediaResolved && window.onNativeMediaResolved('" + callbackId + "', null);", null);
                                }
                            }
                        }
                    });
                }
            }).start();
        }

        @JavascriptInterface
        public void startDownload(final String taskId, final String downloadUrl, final String rawTitle, final boolean isVideo) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    java.io.InputStream in = null;
                    java.io.FileOutputStream out = null;
                    try {
                        File downloadDir = new File(android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS), "UniversalDownloader");
                        if (!downloadDir.exists()) {
                            downloadDir.mkdirs();
                        }

                        String safeTitle = (rawTitle != null ? rawTitle : "download_" + System.currentTimeMillis()).replaceAll("[\\\\/:*?\"<>|]", "_").trim();
                        if (safeTitle.length() > 60) safeTitle = safeTitle.substring(0, 60);
                        String ext = isVideo ? ".mp4" : ".mp3";
                        final File targetFile = new File(downloadDir, safeTitle + ext);

                        // Follow all redirects with proper User-Agent & Referer
                        String currentUrl = downloadUrl;
                        java.net.HttpURLConnection conn = null;
                        for (int i = 0; i < 5; i++) {
                            conn = (java.net.HttpURLConnection) new java.net.URL(currentUrl).openConnection();
                            conn.setInstanceFollowRedirects(true);
                            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                            conn.setRequestProperty("Referer", "https://www.douyin.com/");
                            conn.setRequestProperty("Accept", "*/*");
                            conn.connect();
                            int code = conn.getResponseCode();
                            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                                String loc = conn.getHeaderField("Location");
                                conn.disconnect();
                                if (loc != null && !loc.isEmpty()) {
                                    currentUrl = loc;
                                    continue;
                                }
                            }
                            break;
                        }

                        final long totalSize = conn.getContentLengthLong() > 0 ? conn.getContentLengthLong() : 11 * 1024 * 1024;
                        in = conn.getInputStream();
                        out = new java.io.FileOutputStream(targetFile);

                        byte[] buffer = new byte[64 * 1024];
                        int bytesRead;
                        long downloaded = 0;
                        long lastTime = System.currentTimeMillis();
                        long lastDownloaded = 0;

                        while ((bytesRead = in.read(buffer)) != -1) {
                            out.write(buffer, 0, bytesRead);
                            downloaded += bytesRead;

                            long now = System.currentTimeMillis();
                            if (now - lastTime >= 250) {
                                final long speed = (downloaded - lastDownloaded) * 1000 / Math.max(1, now - lastTime);
                                final long curDownloaded = downloaded;
                                final int progress = (int) (downloaded * 100 / Math.max(1, totalSize));
                                lastTime = now;
                                lastDownloaded = downloaded;

                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        if (webView != null) {
                                            webView.evaluateJavascript("window.onNativeDownloadProgress && window.onNativeDownloadProgress('" + taskId + "', " + progress + ", " + curDownloaded + ", " + totalSize + ", " + speed + ");", null);
                                        }
                                    }
                                });
                            }
                        }

                        out.flush();
                        out.close();
                        in.close();

                        // 100% Real Physical File Saved: Register into Android System MediaStore & Gallery
                        final String absolutePath = targetFile.getAbsolutePath();
                        String mimeType = isVideo ? "video/mp4" : "audio/mpeg";
                        MediaScannerConnection.scanFile(MainActivity.this,
                                new String[]{absolutePath},
                                new String[]{mimeType},
                                null);

                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) {
                                    webView.evaluateJavascript("window.onNativeDownloadCompleted && window.onNativeDownloadCompleted('" + taskId + "', '" + absolutePath.replace("\\", "\\\\").replace("'", "\\'") + "');", null);
                                }
                            }
                        });

                    } catch (Exception e) {
                        e.printStackTrace();
                        try {
                            if (out != null) out.close();
                            if (in != null) in.close();
                        } catch (Exception ex) {}
                    }
                }
            }).start();
        }
    }
}
