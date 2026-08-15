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
        public void resolveNativeMedia(final String rawUrl, final String callbackId) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        String targetUrl = rawUrl;
                        java.net.HttpURLConnection conn = (java.net.HttpURLConnection) new java.net.URL(rawUrl).openConnection();
                        conn.setInstanceFollowRedirects(false);
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)");
                        conn.connect();
                        int code = conn.getResponseCode();
                        if (code == 301 || code == 302 || code == 307) {
                            String loc = conn.getHeaderField("Location");
                            if (loc != null && !loc.isEmpty()) {
                                targetUrl = loc;
                            }
                        }
                        conn.disconnect();

                        String videoId = "";
                        java.util.regex.Matcher m = java.util.regex.Pattern.compile("/video/(\\d+)").matcher(targetUrl);
                        if (m.find()) {
                            videoId = m.group(1);
                        }

                        if (!videoId.isEmpty()) {
                            String apiUrl = "https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=" + videoId;
                            java.net.HttpURLConnection apiConn = (java.net.HttpURLConnection) new java.net.URL(apiUrl).openConnection();
                            apiConn.setRequestProperty("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)");
                            java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(apiConn.getInputStream()));
                            StringBuilder sb = new StringBuilder();
                            String line;
                            while ((line = reader.readLine()) != null) {
                                sb.append(line);
                            }
                            reader.close();
                            apiConn.disconnect();

                            org.json.JSONObject json = new org.json.JSONObject(sb.toString());
                            org.json.JSONArray items = json.optJSONArray("item_list");
                            if (items != null && items.length() > 0) {
                                org.json.JSONObject item = items.getJSONObject(0);
                                String title = item.optString("desc", "抖音无水印高清视频");
                                String cover = "";
                                org.json.JSONObject videoObj = item.optJSONObject("video");
                                if (videoObj != null) {
                                    org.json.JSONObject coverObj = videoObj.optJSONObject("cover");
                                    if (coverObj != null) {
                                        org.json.JSONArray covers = coverObj.optJSONArray("url_list");
                                        if (covers != null && covers.length() > 0) {
                                            cover = covers.getString(0);
                                        }
                                    }
                                    org.json.JSONObject playObj = videoObj.optJSONObject("play_addr");
                                    String playUrl = "";
                                    if (playObj != null) {
                                        org.json.JSONArray plays = playObj.optJSONArray("url_list");
                                        if (plays != null && plays.length() > 0) {
                                            playUrl = plays.getString(0).replace("playwm", "play");
                                        }
                                    }

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
                    } catch (Exception e) {
                        e.printStackTrace();
                    }

                    // Fallback callback
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (webView != null) {
                                webView.evaluateJavascript("window.onNativeMediaResolved && window.onNativeMediaResolved('" + callbackId + "', null);", null);
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

                        java.net.HttpURLConnection conn = (java.net.HttpURLConnection) new java.net.URL(downloadUrl).openConnection();
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)");
                        conn.connect();

                        final long totalSize = conn.getContentLengthLong() > 0 ? conn.getContentLengthLong() : 15 * 1024 * 1024;
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
                                final long speed = (downloaded - lastDownloaded) * 1000 / (now - lastTime);
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
