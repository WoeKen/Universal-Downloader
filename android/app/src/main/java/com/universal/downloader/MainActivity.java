package com.universal.downloader;

import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;
    private final static int FILE_CHOOSER_RESULT_CODE = 10001;
    private String pendingSharedText = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Immersive Edge-to-Edge Fluid Setup
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(android.graphics.Color.parseColor("#090c10"));
            getWindow().setNavigationBarColor(android.graphics.Color.parseColor("#090c10"));
        }

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(android.graphics.Color.parseColor("#090c10"));
        setContentView(container);

        webView = new WebView(this);
        container.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        // High compatibility modern Android User Agent
        settings.setUserAgentString("Mozilla/5.0 (Linux; Android 14; Mobile; UniversalDownloader/1.2.7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36");

        // Bind Native Android Bridge
        webView.addJavascriptInterface(new AndroidNativeBridge(), "NativeAndroid");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return true;
                }
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

        // Load production offline assets
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

        if (Intent.ACTION_SEND.equals(action) && type != null) {
            if ("text/plain".equals(type)) {
                String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (sharedText != null && !sharedText.trim().isEmpty()) {
                    Matcher m = Pattern.compile("(https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+)").matcher(sharedText);
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
        public String getAppVersion() {
            try {
                android.content.pm.PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                return "v" + pInfo.versionName;
            } catch (Exception e) {
                return "v1.2.7";
            }
        }

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

                        // 1. Extract pure clean URL
                        Matcher urlMatcher = Pattern.compile("(https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+)").matcher(rawInput);
                        String cleanUrl = urlMatcher.find() ? urlMatcher.group(1).replaceAll("[\\u4e00-\\u9fa5)\\]}>,;。，！？、“”‘’]+$", "") : rawInput.trim();

                        // 2. Follow redirects
                        String currentUrl = cleanUrl;
                        for (int hop = 0; hop < 6; hop++) {
                            HttpURLConnection conn = (HttpURLConnection) new URL(currentUrl).openConnection();
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

                        // 3. Instagram Direct Video Resolution (High-Efficiency Embed Engine)
                        if (currentUrl.contains("instagram.com") || currentUrl.contains("instagr.am")) {
                            try {
                                String shortcode = "";
                                Matcher scMat = Pattern.compile("(?:reel|p|reels)/([A-Za-z0-9_-]+)").matcher(currentUrl);
                                if (scMat.find()) {
                                    shortcode = scMat.group(1);
                                }

                                if (!shortcode.isEmpty()) {
                                    String embedUrl = "https://www.instagram.com/reel/" + shortcode + "/embed/captioned/";
                                    HttpURLConnection igConn = (HttpURLConnection) new URL(embedUrl).openConnection();
                                    igConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                                    igConn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
                                    igConn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                                    igConn.setConnectTimeout(8000);
                                    igConn.setReadTimeout(8000);

                                    BufferedReader igReader = new BufferedReader(new InputStreamReader(igConn.getInputStream()));
                                    StringBuilder igHtml = new StringBuilder();
                                    String line;
                                    while ((line = igReader.readLine()) != null) {
                                        igHtml.append(line);
                                    }
                                    igReader.close();
                                    igConn.disconnect();
                                    String html = igHtml.toString();

                                    String igVideo = "";
                                    Matcher vMat = Pattern.compile("video_url\\*"\\s*:\\s*\\*"(https:[^"\\\\]+?)\\*"").matcher(html);
                                    if (vMat.find()) {
                                        igVideo = vMat.group(1).replace("\\/", "/").replace("\\u0026", "&").replace("\\u0025", "%").replace("\\", "");
                                    } else {
                                        Matcher vMat2 = Pattern.compile("<meta\\s+(?:property|name)=["'](?:og:video|og:video:secure_url)["']\\s+content=["']([^"']+)["']").matcher(html);
                                        if (vMat2.find()) igVideo = vMat2.group(1).replace("&amp;", "&");
                                    }

                                    String igCover = "";
                                    Matcher cMat = Pattern.compile("display_url\\*"\\s*:\\s*\\*"(https:[^"\\\\]+?)\\*"").matcher(html);
                                    if (cMat.find()) {
                                        igCover = cMat.group(1).replace("\\/", "/").replace("\\u0026", "&").replace("\\u0025", "%").replace("\\", "");
                                    } else {
                                        Matcher cMat2 = Pattern.compile("<meta\\s+(?:property|name)=["']og:image["']\\s+content=["']([^"']+)["']").matcher(html);
                                        if (cMat2.find()) igCover = cMat2.group(1).replace("&amp;", "&");
                                    }

                                    String igTitle = "Instagram 极清视频";
                                    Matcher tMat = Pattern.compile("<div class="Caption">.*?<span class="CaptionUsername">.*?</span>(.*?)</div>").matcher(html);
                                    if (tMat.find()) {
                                        String cleanCaption = tMat.group(1).replaceAll("<[^>]+>", "").trim();
                                        if (!cleanCaption.isEmpty()) {
                                            igTitle = cleanCaption.length() > 50 ? cleanCaption.substring(0, 50) + "..." : cleanCaption;
                                        }
                                    }

                                    if (!igVideo.isEmpty()) {
                                        final JSONObject result = new JSONObject();
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
                                }
                            } catch (Exception ignored) {}
                        }

                        // 4. Twitter / X Direct Video Resolution
                        if (currentUrl.contains("twitter.com") || currentUrl.contains("x.com")) {
                            try {
                                String tweetId = "";
                                Matcher tMatcher = Pattern.compile("status/(\\d+)").matcher(currentUrl);
                                if (tMatcher.find()) {
                                    tweetId = tMatcher.group(1);
                                }

                                if (!tweetId.isEmpty()) {
                                    String twApi = "https://api.vxtwitter.com/Twitter/status/" + tweetId;
                                    HttpURLConnection twConn = (HttpURLConnection) new URL(twApi).openConnection();
                                    twConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
                                    twConn.setConnectTimeout(6000);
                                    twConn.setReadTimeout(6000);

                                    BufferedReader twReader = new BufferedReader(new InputStreamReader(twConn.getInputStream()));
                                    StringBuilder twHtml = new StringBuilder();
                                    String line;
                                    while ((line = twReader.readLine()) != null) {
                                        twHtml.append(line);
                                    }
                                    twReader.close();
                                    twConn.disconnect();
                                    String html = twHtml.toString();

                                    String twVideo = "";
                                    Matcher vMat = Pattern.compile("<meta\\s+(?:property|name)=["'](?:og:video|og:video:secure_url|twitter:player:stream)["']\\s+content=["']([^"']+)["']").matcher(html);
                                    if (vMat.find()) twVideo = vMat.group(1).replace("&amp;", "&");

                                    String twCover = "";
                                    Matcher cMat = Pattern.compile("<meta\\s+(?:property|name)=["']og:image["']\\s+content=["']([^"']+)["']").matcher(html);
                                    if (cMat.find()) twCover = cMat.group(1).replace("&amp;", "&");

                                    String twTitle = "X / Twitter 极清视频";
                                    Matcher tMat = Pattern.compile("<meta\\s+(?:property|name)=["'](?:og:description|og:title)["']\\s+content=["']([^"']+)["']").matcher(html);
                                    if (tMat.find()) {
                                        String clean = tMat.group(1).replace("&amp;", "&").replaceAll("<[^>]+>", "").trim();
                                        if (!clean.isEmpty()) twTitle = clean.length() > 60 ? clean.substring(0, 60) + "..." : clean;
                                    }

                                    if (!twVideo.isEmpty()) {
                                        final JSONObject result = new JSONObject();
                                        result.put("platform", "twitter");
                                        result.put("title", twTitle);
                                        result.put("cover", twCover);
                                        result.put("downloadUrl", twVideo);
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
                                }
                            } catch (Exception ignored) {}
                        }

                        // 5. Generic Tube & Video Portals Resolution (Pornhub, Xvideos, etc.)
                        if (currentUrl.contains("pornhub.com") || currentUrl.contains("xvideos.com") || currentUrl.contains("spankbang.com") || currentUrl.contains("redtube.com")) {
                            try {
                                HttpURLConnection tubeConn = (HttpURLConnection) new URL(currentUrl).openConnection();
                                tubeConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                                tubeConn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
                                tubeConn.setConnectTimeout(8000);
                                tubeConn.setReadTimeout(8000);

                                BufferedReader tReader = new BufferedReader(new InputStreamReader(tubeConn.getInputStream()));
                                StringBuilder tHtml = new StringBuilder();
                                String line;
                                while ((line = tReader.readLine()) != null) {
                                    tHtml.append(line);
                                }
                                tReader.close();
                                tubeConn.disconnect();
                                String html = tHtml.toString();

                                String tubeVideo = "";
                                Matcher vMat = Pattern.compile(""videoUrl"\\s*:\\s*"(https:[^"]+?)"").matcher(html);
                                while (vMat.find()) {
                                    tubeVideo = vMat.group(1).replace("\\/", "/");
                                }
                                if (tubeVideo.isEmpty()) {
                                    Matcher vMat2 = Pattern.compile("<meta\\s+(?:property|name)=["'](?:og:video|og:video:url|og:video:secure_url)["']\\s+content=["']([^"']+)["']").matcher(html);
                                    if (vMat2.find()) tubeVideo = vMat2.group(1).replace("&amp;", "&");
                                }

                                String tubeCover = "";
                                Matcher cMat = Pattern.compile("<meta\\s+(?:property|name)=["']og:image["']\\s+content=["']([^"']+)["']").matcher(html);
                                if (cMat.find()) tubeCover = cMat.group(1).replace("&amp;", "&");

                                String tubeTitle = "高清在线视频";
                                Matcher titMat = Pattern.compile("<meta\\s+(?:property|name)=["']og:title["']\\s+content=["']([^"']+)["']").matcher(html);
                                if (titMat.find()) {
                                    tubeTitle = titMat.group(1).replace("&amp;", "&").replaceAll("<[^>]+>", "").trim();
                                }

                                if (!tubeVideo.isEmpty()) {
                                    final JSONObject result = new JSONObject();
                                    result.put("platform", "tube");
                                    result.put("title", tubeTitle);
                                    result.put("cover", tubeCover);
                                    result.put("downloadUrl", tubeVideo);
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

                        // 6. Douyin Resolution (Aweme Detail API with Guest Cookies)
                        String videoId = "";
                        Matcher m = Pattern.compile("(?:video/|modal_id=|item_ids=)(\\d+)").matcher(currentUrl);
                        if (m.find()) {
                            videoId = m.group(1);
                        }

                        if (!videoId.isEmpty()) {
                            CookieManager cookieManager = new CookieManager();
                            CookieHandler.setDefault(cookieManager);
                            try {
                                HttpURLConnection cookieConn = (HttpURLConnection) new URL("https://www.douyin.com/discover").openConnection();
                                cookieConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                                cookieConn.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9");
                                cookieConn.connect();
                                cookieConn.getResponseCode();
                                cookieConn.disconnect();
                            } catch (Exception ignored) {}

                            String apiUrl = "https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=" + videoId;
                            HttpURLConnection apiConn = (HttpURLConnection) new URL(apiUrl).openConnection();
                            apiConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                            apiConn.setRequestProperty("Referer", "https://www.douyin.com/video/" + videoId);
                            apiConn.setRequestProperty("Accept", "application/json, text/plain, */*");
                            apiConn.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9");

                            BufferedReader reader = new BufferedReader(new InputStreamReader(apiConn.getInputStream()));
                            StringBuilder sb = new StringBuilder();
                            String line;
                            while ((line = reader.readLine()) != null) {
                                sb.append(line);
                            }
                            reader.close();
                            apiConn.disconnect();

                            JSONObject json = new JSONObject(sb.toString());
                            JSONObject awemeDetail = json.optJSONObject("aweme_detail");
                            if (awemeDetail != null) {
                                String videoTitle = awemeDetail.optString("desc", "抖音无水印高清视频");
                                String cover = "";
                                JSONObject videoObj = awemeDetail.optJSONObject("video");
                                if (videoObj != null) {
                                    JSONObject coverObj = videoObj.optJSONObject("cover");
                                    if (coverObj != null) {
                                        JSONArray covers = coverObj.optJSONArray("url_list");
                                        if (covers != null && covers.length() > 0) cover = covers.getString(0);
                                    }
                                }

                                if (reqMode.equals("audio")) {
                                    JSONObject musicObj = awemeDetail.optJSONObject("music");
                                    if (musicObj != null) {
                                        JSONObject playObj = musicObj.optJSONObject("play_url");
                                        if (playObj != null) {
                                            JSONArray playList = playObj.optJSONArray("url_list");
                                            if (playList != null && playList.length() > 0) {
                                                String musicUrl = playList.getString(0);
                                                String musicTitle = musicObj.optString("title", videoTitle);
                                                String musicCover = cover;
                                                JSONObject coverLarge = musicObj.optJSONObject("cover_large");
                                                if (coverLarge != null) {
                                                    JSONArray cList = coverLarge.optJSONArray("url_list");
                                                    if (cList != null && cList.length() > 0) musicCover = cList.getString(0);
                                                }

                                                final JSONObject result = new JSONObject();
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
                                    JSONObject h264Obj = videoObj.optJSONObject("play_addr_h264");
                                    if (h264Obj != null) {
                                        JSONArray h264List = h264Obj.optJSONArray("url_list");
                                        if (h264List != null && h264List.length() > 0) playUrl = h264List.getString(0);
                                    }
                                    if (playUrl.isEmpty()) {
                                        JSONObject playObj = videoObj.optJSONObject("play_addr");
                                        if (playObj != null) {
                                            JSONArray playList = playObj.optJSONArray("url_list");
                                            if (playList != null && playList.length() > 0) playUrl = playList.getString(0);
                                        }
                                    }

                                    if (!playUrl.isEmpty()) {
                                        final JSONObject result = new JSONObject();
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

                    // Fallback to Universal Headless Chromium Web Stream Interception on UI Thread
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                Matcher urlMatcher = Pattern.compile("(https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+)").matcher(rawInput);
                                final String cleanUrl = urlMatcher.find() ? urlMatcher.group(1).replaceAll("[\\u4e00-\\u9fa5)\\]}>,;。，！？、“”‘’]+$", "") : rawInput.trim();

                                String detectedPlat = "web_video";
                                if (cleanUrl.contains("douyin.com")) detectedPlat = "douyin";
                                else if (cleanUrl.contains("tiktok.com")) detectedPlat = "tiktok";
                                else if (cleanUrl.contains("instagram.com") || cleanUrl.contains("instagr.am")) detectedPlat = "instagram";
                                else if (cleanUrl.contains("twitter.com") || cleanUrl.contains("x.com")) detectedPlat = "twitter";
                                else if (cleanUrl.contains("pornhub.com") || cleanUrl.contains("xvideos.com") || cleanUrl.contains("spankbang.com")) detectedPlat = "tube";
                                else if (cleanUrl.contains("bilibili.com")) detectedPlat = "bilibili";
                                else if (cleanUrl.contains("kuaishou.com")) detectedPlat = "kuaishou";
                                else if (cleanUrl.contains("xiaohongshu.com")) detectedPlat = "xiaohongshu";
                                final String platformTag = detectedPlat;

                                final WebView extractorView = new WebView(MainActivity.this);
                                WebSettings es = extractorView.getSettings();
                                es.setJavaScriptEnabled(true);
                                es.setDomStorageEnabled(true);
                                es.setMediaPlaybackRequiresUserGesture(false);
                                es.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                                es.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

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
                                        if (finalTitle.isEmpty()) {
                                            if (platformTag.equals("douyin")) finalTitle = "抖音无水印高清视频";
                                            else if (platformTag.equals("twitter")) finalTitle = "X / Twitter 极清视频";
                                            else if (platformTag.equals("instagram")) finalTitle = "Instagram 极清视频";
                                            else finalTitle = "高清多媒体视频";
                                        }

                                        if (!finalUrl.isEmpty()) {
                                            try {
                                                final JSONObject result = new JSONObject();
                                                result.put("platform", platformTag);
                                                result.put("title", finalTitle);
                                                result.put("cover", finalCover);
                                                result.put("downloadUrl", finalUrl);
                                                result.put("category", reqMode.equals("audio") ? "audio" : "video");

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
                                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                                        if (request != null && request.getUrl() != null) {
                                            String reqUrl = request.getUrl().toString();
                                            String lower = reqUrl.toLowerCase();
                                            boolean isMediaStream = lower.contains(".mp4") || lower.contains(".m3u8") || lower.contains(".m4v") ||
                                                lower.contains(".webm") || lower.contains(".flv") || lower.contains("mime_type=video") ||
                                                lower.contains("video/mp4") || lower.contains("phncdn.com") || lower.contains("twimg.com") ||
                                                lower.contains("cdninstagram.com") || lower.contains("douyinvod.com") || lower.contains("kspkg.com");

                                            if (isMediaStream && !lower.contains(".jpg") && !lower.contains(".png") && !lower.contains(".webp") && !lower.contains(".gif")) {
                                                capturedVideoUrl[0] = reqUrl.replace("playwm", "play");
                                                extractorView.postDelayed(finishCallback, 400);
                                            }
                                        }
                                        return super.shouldInterceptRequest(view, request);
                                    }

                                    @Override
                                    public void onPageFinished(WebView view, String url) {
                                        super.onPageFinished(view, url);
                                        view.evaluateJavascript(
                                            "(function() {" +
                                            "  var v = document.querySelector('video') || document.querySelector('video source');" +
                                            "  var src = v ? (v.currentSrc || v.src) : '';" +
                                            "  var poster = v ? (v.poster || '') : '';" +
                                            "  var metaV = document.querySelector('meta[property=\"og:video\"], meta[property=\"og:video:secure_url\"], meta[property=\"og:video:url\"], meta[name=\"twitter:player:stream\"]');" +
                                            "  if (!src && metaV) src = metaV.content;" +
                                            "  var metaImg = document.querySelector('meta[property=\"og:image\"], meta[name=\"twitter:image\"]');" +
                                            "  if (!poster && metaImg) poster = metaImg.content;" +
                                            "  var title = document.title || '';" +
                                            "  var metaT = document.querySelector('meta[property=\"og:title\"], meta[name=\"twitter:title\"]');" +
                                            "  if (metaT && metaT.content) title = metaT.content;" +
                                            "  return JSON.stringify({ src: src, poster: poster, title: title });" +
                                            "})()",
                                            new ValueCallback<String>() {
                                                @Override
                                                public void onReceiveValue(String val) {
                                                    if (val != null && !val.equals("null") && !val.isEmpty()) {
                                                        try {
                                                            String rawStr = val;
                                                            if (rawStr.startsWith("\"") && rawStr.endsWith("\"") && rawStr.length() >= 2) {
                                                                rawStr = rawStr.substring(1, rawStr.length() - 1).replace("\\\"", "\"").replace("\\\\", "\\");
                                                            }
                                                            JSONObject domJson = new JSONObject(rawStr);
                                                            String dSrc = domJson.optString("src");
                                                            String dPoster = domJson.optString("poster");
                                                            String dTitle = domJson.optString("title");
                                                            if (!dSrc.isEmpty() && capturedVideoUrl[0].isEmpty()) capturedVideoUrl[0] = dSrc.replace("playwm", "play");
                                                            if (!dPoster.isEmpty() && capturedCoverUrl[0].isEmpty()) capturedCoverUrl[0] = dPoster;
                                                            if (!dTitle.isEmpty() && capturedTitle[0].isEmpty()) {
                                                                capturedTitle[0] = dTitle.replace(" - 抖音", "").replace("在抖音记录美好生活", "").trim();
                                                            }
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
        public long getFileSize(String filePath) {
            try {
                if (filePath != null && !filePath.isEmpty()) {
                    File f = new File(filePath);
                    if (f.exists() && f.isFile()) {
                        return f.length();
                    }
                }
            } catch (Exception ignored) {}
            return 0;
        }

        @JavascriptInterface
        public void startDownload(final String taskId, final String downloadUrl, final String rawTitle, final boolean isVideo) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    InputStream in = null;
                    FileOutputStream out = null;
                    try {
                        String cleanTitle = (rawTitle != null && !rawTitle.trim().isEmpty())
                                ? rawTitle.replaceAll("[\\\\/:*?\"<>|]", "_").trim()
                                : ("Media_" + System.currentTimeMillis());

                        if (cleanTitle.length() > 50) cleanTitle = cleanTitle.substring(0, 50);

                        File downloadDir = new File(android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS), "UniversalDownloader");
                        if (!downloadDir.exists()) downloadDir.mkdirs();

                        String defaultExt = isVideo ? ".mp4" : ".mp3";
                        File targetFile = new File(downloadDir, cleanTitle + defaultExt);
                        int count = 1;
                        while (targetFile.exists()) {
                            targetFile = new File(downloadDir, cleanTitle + "_" + count + defaultExt);
                            count++;
                        }

                        HttpURLConnection conn = (HttpURLConnection) new URL(downloadUrl).openConnection();
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                        conn.setRequestProperty("Referer", downloadUrl);
                        conn.setConnectTimeout(15000);
                        conn.setReadTimeout(15000);
                        conn.connect();

                        int respCode = conn.getResponseCode();
                        if (respCode >= 400) {
                            throw new Exception("HTTP Server returned code: " + respCode);
                        }

                        long totalLength = conn.getContentLength();
                        if (totalLength <= 0) {
                            String lenHeader = conn.getHeaderField("Content-Length");
                            if (lenHeader != null) {
                                try { totalLength = Long.parseLong(lenHeader); } catch (Exception ignored) {}
                            }
                        }

                        in = conn.getInputStream();
                        out = new FileOutputStream(targetFile);
                        byte[] buffer = new byte[64 * 1024];
                        int bytesRead;
                        long downloaded = 0;
                        long lastUpdate = System.currentTimeMillis();

                        while ((bytesRead = in.read(buffer)) != -1) {
                            out.write(buffer, 0, bytesRead);
                            downloaded += bytesRead;

                            long now = System.currentTimeMillis();
                            if (now - lastUpdate > 300) {
                                lastUpdate = now;
                                final long fDownloaded = downloaded;
                                final long fTotal = totalLength;
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        if (webView != null) {
                                            webView.evaluateJavascript("window.onNativeDownloadProgress && window.onNativeDownloadProgress('" + taskId + "', " + fDownloaded + ", " + fTotal + ");", null);
                                        }
                                    }
                                });
                            }
                        }
                        out.flush();

                        // Scan into Android system media library
                        scanGalleryFile(targetFile.getAbsolutePath(), isVideo);

                        final String finalPath = targetFile.getAbsolutePath();
                        final long actualFileSize = targetFile.length();
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) {
                                    webView.evaluateJavascript("window.onNativeDownloadCompleted && window.onNativeDownloadCompleted('" + taskId + "', '" + finalPath.replace("\\", "\\\\").replace("'", "\\'") + "', " + actualFileSize + ");", null);
                                }
                            }
                        });

                    } catch (final Exception e) {
                        e.printStackTrace();
                        final String errorDetail = e.getMessage() != null ? e.getMessage() : "下载发生网络错误";
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) {
                                    webView.evaluateJavascript("window.onNativeDownloadFailed && window.onNativeDownloadFailed('" + taskId + "', '" + errorDetail.replace("'", "\\'").replace("\n", " ") + "');", null);
                                }
                            }
                        });
                    } finally {
                        try { if (in != null) in.close(); } catch (Exception ignored) {}
                        try { if (out != null) out.close(); } catch (Exception ignored) {}
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
                            uri = FileProvider.getUriForFile(
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
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        File file = new File(filePath);
                        if (!file.exists()) return;

                        Uri uri;
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                            uri = FileProvider.getUriForFile(
                                    MainActivity.this,
                                    getPackageName() + ".fileprovider",
                                    file
                            );
                        } else {
                            uri = Uri.fromFile(file);
                        }

                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri, "application/vnd.android.package-archive");
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception e) {
                        e.printStackTrace();
                        openDownloadedFile(filePath, "application/vnd.android.package-archive");
                    }
                }
            });
        }

        @JavascriptInterface
        public void downloadAndInstallApk(final String apkUrl) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) {
                                    webView.evaluateJavascript("window.showToast && window.showToast('🚀 正在启动极速下载最新版 APK...');", null);
                                }
                            }
                        });

                        File downloadDir = new File(android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS), "UniversalDownloader");
                        if (!downloadDir.exists()) downloadDir.mkdirs();

                        File targetApk = new File(downloadDir, "UniversalDownloader_vLatest.apk");
                        if (targetApk.exists()) targetApk.delete();

                        HttpURLConnection conn = (HttpURLConnection) new URL(apkUrl).openConnection();
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile)");
                        conn.setConnectTimeout(15000);
                        conn.setReadTimeout(15000);
                        conn.connect();

                        InputStream in = conn.getInputStream();
                        FileOutputStream out = new FileOutputStream(targetApk);
                        byte[] buffer = new byte[64 * 1024];
                        int bytesRead;

                        while ((bytesRead = in.read(buffer)) != -1) {
                            out.write(buffer, 0, bytesRead);
                        }
                        out.flush();
                        in.close();
                        out.close();
                        conn.disconnect();

                        final String downloadedApkPath = targetApk.getAbsolutePath();
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) {
                                    webView.evaluateJavascript("window.showToast && window.showToast('🎉 最新版 APK 下载完毕，正在拉起系统安装器...');", null);
                                }
                                installApk(downloadedApkPath);
                            }
                        });

                    } catch (final Exception e) {
                        e.printStackTrace();
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) {
                                    webView.evaluateJavascript("window.showToast && window.showToast('⚠️ 在线下载更新失败，正在唤起浏览器下载...');", null);
                                }
                                openDeepLink(apkUrl);
                            }
                        });
                    }
                }
            }).start();
        }
    }
}
}
