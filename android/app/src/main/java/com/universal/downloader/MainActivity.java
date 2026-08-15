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

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

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

        // Load Liquid Glass Mobile UI
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
                    if (webView != null && webView.getProgress() == 100) {
                        dispatchSharedTextToWeb(sharedText);
                    } else {
                        pendingSharedText = sharedText;
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
        public void shareFile(String filePath) {
            try {
                File file = new File(filePath);
                if (file.exists()) {
                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                    shareIntent.setType("video/*");
                    shareIntent.putExtra(Intent.EXTRA_STREAM, Uri.fromFile(file));
                    startActivity(Intent.createChooser(shareIntent, "分享到"));
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
