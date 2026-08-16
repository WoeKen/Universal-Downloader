package com.universal.downloader;

import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
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
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
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
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, android.webkit.WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    Uri reqUri = request.getUrl();
                    if ("localhost".equals(reqUri.getHost()) && "/local-media".equals(reqUri.getPath())) {
                        String pathParam = reqUri.getQueryParameter("path");
                        if (pathParam != null && !pathParam.isEmpty()) {
                            try {
                                File mediaFile = new File(pathParam);
                                if (mediaFile.exists() && mediaFile.canRead()) {
                                    String mime = "video/mp4";
                                    String lower = mediaFile.getName().toLowerCase();
                                    if (lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.endsWith(".wav") || lower.endsWith(".ogg") || lower.endsWith(".flac") || lower.endsWith(".aac")) {
                                        mime = "audio/mpeg";
                                    } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".gif") || lower.endsWith(".svg")) {
                                        mime = "image/jpeg";
                                    } else if (lower.endsWith(".webm") || lower.endsWith(".mkv")) {
                                        mime = "video/webm";
                                    }

                                    long fileLength = mediaFile.length();
                                    java.io.InputStream is = new java.io.FileInputStream(mediaFile);
                                    int statusCode = 200;
                                    String statusMsg = "OK";
                                    java.util.Map<String, String> responseHeaders = new java.util.HashMap<>();
                                    responseHeaders.put("Access-Control-Allow-Origin", "*");
                                    responseHeaders.put("Accept-Ranges", "bytes");

                                    // Handle Range header for instant seeking
                                    String rangeHeader = request.getRequestHeaders() != null ? request.getRequestHeaders().get("Range") : null;
                                    if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
                                        try {
                                            String[] parts = rangeHeader.substring(6).split("-");
                                            long start = Long.parseLong(parts[0]);
                                            long end = parts.length > 1 && !parts[1].isEmpty() ? Long.parseLong(parts[1]) : fileLength - 1;
                                            if (start < fileLength) {
                                                is.skip(start);
                                                statusCode = 206;
                                                statusMsg = "Partial Content";
                                                responseHeaders.put("Content-Range", "bytes " + start + "-" + end + "/" + fileLength);
                                                responseHeaders.put("Content-Length", String.valueOf(end - start + 1));
                                            }
                                        } catch (Exception ignored) {}
                                    } else {
                                        responseHeaders.put("Content-Length", String.valueOf(fileLength));
                                    }

                                    return new android.webkit.WebResourceResponse(mime, "UTF-8", statusCode, statusMsg, responseHeaders, is);
                                }
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

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
            resolveNativeMedia(rawInput, callbackId, "auto");
        }

        @JavascriptInterface
        public void resolveNativeMedia(final String rawInput, final String callbackId, final String formatMode) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        final String reqMode = (formatMode != null && !formatMode.isEmpty()) ? formatMode : "auto";

                        // 1. Extract pure clean URL from messy Chinese/emoji text
                        java.util.regex.Matcher urlMatcher = java.util.regex.Pattern.compile("(https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+)").matcher(rawInput);
                        String cleanUrl = urlMatcher.find() ? urlMatcher.group(1).replaceAll("[\\u4e00-\\u9fa5)\\]}>,;。，！？、“”‘’]+$", "") : rawInput.trim();

                        // 2. Follow redirects to find target long URL & video ID
                        String currentUrl = cleanUrl;
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

                        // 3. Instagram Resolution
                        if (currentUrl.contains("instagram.com") || currentUrl.contains("instagr.am")) {
                            try {
                                java.net.HttpURLConnection igConn = (java.net.HttpURLConnection) new java.net.URL(currentUrl).openConnection();
                                igConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                                igConn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
                                igConn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                                java.io.BufferedReader igReader = new java.io.BufferedReader(new java.io.InputStreamReader(igConn.getInputStream()));
                                StringBuilder igHtml = new StringBuilder();
                                String line;
                                while ((line = igReader.readLine()) != null) {
                                    igHtml.append(line);
                                }
                                igReader.close();
                                igConn.disconnect();
                                String html = igHtml.toString();

                                String igVideo = "";
                                java.util.regex.Matcher vMat = java.util.regex.Pattern.compile("<meta\\s+(?:property|name)=[\"'](?:og:video|og:video:secure_url)[\"']\\s+content=[\"']([^\"']+)[\"']").matcher(html);
                                if (vMat.find()) igVideo = vMat.group(1).replace("&amp;", "&");

                                String igCover = "";
                                java.util.regex.Matcher cMat = java.util.regex.Pattern.compile("<meta\\s+(?:property|name)=[\"']og:image[\"']\\s+content=[\"']([^\"']+)[\"']").matcher(html);
                                if (cMat.find()) igCover = cMat.group(1).replace("&amp;", "&");

                                String igTitle = "Instagram 极清视频";
                                java.util.regex.Matcher tMat = java.util.regex.Pattern.compile("<meta\\s+(?:property|name)=[\"']og:title[\"']\\s+content=[\"']([^\"']+)[\"']").matcher(html);
                                if (tMat.find()) igTitle = tMat.group(1).replace("&amp;", "&");

                                if (!igVideo.isEmpty()) {
                                    final org.json.JSONObject result = new org.json.JSONObject();
                                    result.put("platform", "instagram");
                                    result.put("title", igTitle);
                                    result.put("cover", igCover);
                                    result.put("downloadUrl", igVideo);
                                    result.put("category", reqMode.equals("audio") ? "audio" : "video");

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
                            } catch (Exception ignored) {}
                        }

                        // 4. Douyin Resolution (Aweme Detail API with Guest Cookies)
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
                                String videoTitle = awemeDetail.optString("desc", "抖音无水印高清视频");
                                String cover = "";
                                org.json.JSONObject videoObj = awemeDetail.optJSONObject("video");
                                if (videoObj != null) {
                                    org.json.JSONObject coverObj = videoObj.optJSONObject("cover");
                                    if (coverObj != null) {
                                        org.json.JSONArray covers = coverObj.optJSONArray("url_list");
                                        if (covers != null && covers.length() > 0) cover = covers.getString(0);
                                    }
                                }

                                // If User requested Audio Mode (MP3 extract)
                                if (reqMode.equals("audio")) {
                                    org.json.JSONObject musicObj = awemeDetail.optJSONObject("music");
                                    if (musicObj != null) {
                                        org.json.JSONObject playObj = musicObj.optJSONObject("play_url");
                                        if (playObj != null) {
                                            org.json.JSONArray playList = playObj.optJSONArray("url_list");
                                            if (playList != null && playList.length() > 0) {
                                                String musicUrl = playList.getString(0);
                                                String musicTitle = musicObj.optString("title", videoTitle);
                                                String musicCover = cover;
                                                org.json.JSONObject coverLarge = musicObj.optJSONObject("cover_large");
                                                if (coverLarge != null) {
                                                    org.json.JSONArray cList = coverLarge.optJSONArray("url_list");
                                                    if (cList != null && cList.length() > 0) musicCover = cList.getString(0);
                                                }

                                                final org.json.JSONObject result = new org.json.JSONObject();
                                                result.put("platform", "douyin");
                                                result.put("title", musicTitle);
                                                result.put("cover", musicCover);
                                                result.put("downloadUrl", musicUrl);
                                                result.put("category", "audio");

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

                                if (videoObj != null) {
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
                                        result.put("title", videoTitle);
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
                                                            if (rawStr.startsWith("\"") && rawStr.endsWith("\"") && rawStr.length() >= 2) {
                                                                rawStr = rawStr.substring(1, rawStr.length() - 1).replace("\\\"", "\"").replace("\\\\", "\\");
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

                        // Follow all redirects with proper User-Agent
                        String currentUrl = downloadUrl;
                        java.net.HttpURLConnection conn = null;
                        for (int i = 0; i < 6; i++) {
                            conn = (java.net.HttpURLConnection) new java.net.URL(currentUrl).openConnection();
                            conn.setInstanceFollowRedirects(true);
                            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
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

                        // 1. Filename & Extension Resolution from Content-Disposition / URL / Content-Type
                        String finalFileName = "";
                        String cd = conn.getHeaderField("Content-Disposition");
                        if (cd != null && cd.contains("filename=")) {
                            java.util.regex.Matcher m = java.util.regex.Pattern.compile("filename\\*?=['\"]?(?:UTF-8'')?([^;'\"]+)").matcher(cd);
                            if (m.find()) {
                                try {
                                    finalFileName = java.net.URLDecoder.decode(m.group(1), "UTF-8");
                                } catch (Exception ignored) {
                                    finalFileName = m.group(1);
                                }
                            }
                        }

                        if (finalFileName.isEmpty()) {
                            try {
                                String path = new java.net.URL(currentUrl).getPath();
                                String lastPart = path.substring(path.lastIndexOf('/') + 1);
                                if (lastPart.contains(".") && !lastPart.endsWith(".")) {
                                    finalFileName = java.net.URLDecoder.decode(lastPart, "UTF-8");
                                }
                            } catch (Exception ignored) {}
                        }

                        String contentType = conn.getContentType();
                        String mimeType = "application/octet-stream";
                        String detectedExt = "";

                        if (contentType != null) {
                            String lower = contentType.toLowerCase();
                            if (lower.contains("video/mp4")) { detectedExt = ".mp4"; mimeType = "video/mp4"; }
                            else if (lower.contains("video/webm")) { detectedExt = ".webm"; mimeType = "video/webm"; }
                            else if (lower.contains("video")) { detectedExt = ".mp4"; mimeType = "video/mp4"; }
                            else if (lower.contains("audio/mpeg") || lower.contains("audio/mp3")) { detectedExt = ".mp3"; mimeType = "audio/mpeg"; }
                            else if (lower.contains("audio/ogg")) { detectedExt = ".ogg"; mimeType = "audio/ogg"; }
                            else if (lower.contains("audio/wav")) { detectedExt = ".wav"; mimeType = "audio/wav"; }
                            else if (lower.contains("audio")) { detectedExt = ".mp3"; mimeType = "audio/mpeg"; }
                            else if (lower.contains("application/vnd.android.package-archive")) { detectedExt = ".apk"; mimeType = "application/vnd.android.package-archive"; }
                            else if (lower.contains("image/jpeg")) { detectedExt = ".jpg"; mimeType = "image/jpeg"; }
                            else if (lower.contains("image/png")) { detectedExt = ".png"; mimeType = "image/png"; }
                            else if (lower.contains("image/webp")) { detectedExt = ".webp"; mimeType = "image/webp"; }
                            else if (lower.contains("image/gif")) { detectedExt = ".gif"; mimeType = "image/gif"; }
                            else if (lower.contains("application/pdf")) { detectedExt = ".pdf"; mimeType = "application/pdf"; }
                            else if (lower.contains("application/zip")) { detectedExt = ".zip"; mimeType = "application/zip"; }
                        }

                        if (finalFileName.isEmpty()) {
                            String safeTitle = (rawTitle != null ? rawTitle : "download_" + System.currentTimeMillis()).replaceAll("[\\\\/:*?\"<>|]", "_").trim();
                            if (safeTitle.length() > 60) safeTitle = safeTitle.substring(0, 60);
                            if (safeTitle.matches(".*\\.[a-zA-Z0-9]{2,5}$")) {
                                finalFileName = safeTitle;
                            } else {
                                String ext = !detectedExt.isEmpty() ? detectedExt : (isVideo ? ".mp4" : ".bin");
                                finalFileName = safeTitle + ext;
                            }
                        }

                        final File targetFile = new File(downloadDir, finalFileName.replaceAll("[\\\\/:*?\"<>|]", "_"));

                        final long totalSize = conn.getContentLengthLong() > 0 ? conn.getContentLengthLong() : 10 * 1024 * 1024;
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

                        // Register MediaStore for Video / Audio / Images
                        final String absolutePath = targetFile.getAbsolutePath();
                        String lowerName = finalFileName.toLowerCase();
                        if (lowerName.endsWith(".mp4") || lowerName.endsWith(".mkv") || lowerName.endsWith(".webm")) {
                            MediaScannerConnection.scanFile(MainActivity.this, new String[]{absolutePath}, new String[]{"video/mp4"}, null);
                        } else if (lowerName.endsWith(".mp3") || lowerName.endsWith(".flac") || lowerName.endsWith(".wav") || lowerName.endsWith(".m4a")) {
                            MediaScannerConnection.scanFile(MainActivity.this, new String[]{absolutePath}, new String[]{"audio/mpeg"}, null);
                        } else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".png") || lowerName.endsWith(".webp") || lowerName.endsWith(".gif")) {
                            MediaScannerConnection.scanFile(MainActivity.this, new String[]{absolutePath}, new String[]{"image/jpeg"}, null);
                        }

                        final String finalMime = mimeType;
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) {
                                    webView.evaluateJavascript("window.onNativeDownloadCompleted && window.onNativeDownloadCompleted('" + taskId + "', '" + absolutePath.replace("\\", "\\\\").replace("'", "\\'") + "', '" + finalMime + "');", null);
                                }
                            }
                        });

                    } catch (Exception e) {
                        e.printStackTrace();
                        try {
                            if (out != null) out.close();
                            if (in != null) in.close();
                        } catch (Exception ex) {}

                        final String errorDetail = (e.getMessage() != null && !e.getMessage().isEmpty()) ? e.getMessage() : "下载连接超时或网络异常";
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) {
                                    webView.evaluateJavascript("window.onNativeDownloadFailed && window.onNativeDownloadFailed('" + taskId + "', '" + errorDetail.replace("'", "\\'").replace("\n", " ") + "');", null);
                                }
                            }
                        });
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public void openDownloadedFile(final String filePath, final String mimeType) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        File file = new File(filePath);
                        if (!file.exists()) return;

                        Uri uri;
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                            uri = androidx.core.content.FileProvider.getUriForFile(
                                    MainActivity.this,
                                    getPackageName() + ".fileprovider",
                                    file
                            );
                        } else {
                            uri = Uri.fromFile(file);
                        }

                        String effectiveMime = (mimeType != null && !mimeType.isEmpty() && !mimeType.equals("null")) ? mimeType : "*/*";
                        String lowerPath = filePath.toLowerCase();
                        if (lowerPath.endsWith(".apk")) {
                            effectiveMime = "application/vnd.android.package-archive";
                        } else if (lowerPath.endsWith(".mp4") || lowerPath.endsWith(".mkv") || lowerPath.endsWith(".webm") || lowerPath.endsWith(".mov") || lowerPath.endsWith(".3gp")) {
                            effectiveMime = "video/*";
                        } else if (lowerPath.endsWith(".mp3") || lowerPath.endsWith(".m4a") || lowerPath.endsWith(".wav") || lowerPath.endsWith(".flac") || lowerPath.endsWith(".ogg") || lowerPath.endsWith(".aac")) {
                            effectiveMime = "audio/*";
                        } else if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg") || lowerPath.endsWith(".png") || lowerPath.endsWith(".webp") || lowerPath.endsWith(".gif")) {
                            effectiveMime = "image/*";
                        } else if (lowerPath.endsWith(".pdf")) {
                            effectiveMime = "application/pdf";
                        } else if (lowerPath.endsWith(".zip")) {
                            effectiveMime = "application/zip";
                        }

                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri, effectiveMime);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(Intent.createChooser(intent, "打开文件: " + file.getName()));
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }

        @JavascriptInterface
        public void playMediaFile(final String filePath, final boolean isVideo) {
            openDownloadedFile(filePath, isVideo ? "video/*" : "audio/*");
        }

        @JavascriptInterface
        public void installApk(final String filePath) {
            openDownloadedFile(filePath, "application/vnd.android.package-archive");
        }
    }
}
