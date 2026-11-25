package com.boltaengi.battle;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Gravity;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String GAME_URL = "https://43.203.70.197.sslip.io/battle/";
    private static final String GAME_HOST = "43.203.70.197.sslip.io";
    private static final String SOCIAL_LOGIN_PROMPT = "boltaengi.openSocialLogin";
    private WebView webView;
    private View networkErrorView;
    private boolean mainFrameFailed;

    private static boolean isGameOrigin(String scheme, String authority) {
        return "https".equalsIgnoreCase(scheme)
            && (GAME_HOST.equalsIgnoreCase(authority) || (GAME_HOST + ":443").equalsIgnoreCase(authority));
    }

    private boolean isGameOrigin(Uri uri) {
        return uri != null && isGameOrigin(uri.getScheme(), uri.getEncodedAuthority());
    }

    private boolean isGameUrl(Uri uri) {
        if (!isGameOrigin(uri)) return false;
        String path = uri.getPath();
        return path != null && (path.equals("/battle") || path.startsWith("/battle/"));
    }

    private static boolean isSocialAuthorizationUrl(String value) {
        if (value == null) return false;
        try {
            URI uri = new URI(value);
            String path = uri.getRawPath();
            String query = uri.getRawQuery();
            if (!isGameOrigin(uri.getScheme(), uri.getRawAuthority()) || uri.getRawFragment() != null
                || query == null || !query.startsWith("ticket=") || query.length() <= "ticket=".length()
                || query.indexOf('&') >= 0) {
                return false;
            }
            return "/api/battle/auth/authorize/kakao".equals(path)
                || "/api/battle/auth/authorize/naver".equals(path)
                || "/api/battle/auth/authorize/google".equals(path)
                || "/api/battle/auth/authorize/apple".equals(path);
        } catch (URISyntaxException invalid) {
            return false;
        }
    }

    private boolean openSocialLogin(String url) {
        if (!isSocialAuthorizationUrl(url)) return false;
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        open.addCategory(Intent.CATEGORY_BROWSABLE);
        // Resolve a browser for the first-party handoff and all ensuing provider redirects.
        open.setSelector(new Intent(Intent.ACTION_VIEW, Uri.parse("https://browser.invalid/"))
            .addCategory(Intent.CATEGORY_BROWSABLE));
        try {
            startActivity(open);
            return true;
        } catch (ActivityNotFoundException | SecurityException unavailable) {
            return false;
        }
    }

    private WebResourceResponse missingBundledResource() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers,
            new java.io.ByteArrayInputStream(new byte[0]));
    }

    // 앱과 함께 묶은 정적 게임 파일만 제공한다. API는 기존 서버로 전송된다.
    // 동일 HTTPS origin을 유지하므로 기존 WebView 저장 데이터가 보존된다.
    private WebResourceResponse bundledGameResource(WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!"GET".equals(request.getMethod()) || !isGameUrl(uri)) return null;
        String path = uri.getPath();
        String relative = path.equals("/battle") || path.equals("/battle/")
            ? "index.html" : path.substring("/battle/".length());
        if (relative.indexOf('\\') >= 0 || relative.indexOf('\0') >= 0) return missingBundledResource();
        for (String part : relative.split("/")) {
            if (part.equals(".") || part.equals("..") || part.isEmpty()) return missingBundledResource();
        }
        boolean allowed = relative.equals("index.html") || relative.equals("privacy.html")
            || relative.startsWith("src/") || relative.startsWith("styles/")
            || relative.startsWith("assets/") || relative.startsWith("vendor/");
        if (!allowed) return missingBundledResource();
        String lower = relative.toLowerCase(java.util.Locale.ROOT);
        String mime = lower.endsWith(".html") ? "text/html"
            : lower.endsWith(".js") ? "text/javascript"
            : lower.endsWith(".css") ? "text/css"
            : lower.endsWith(".json") ? "application/json"
            : lower.endsWith(".png") ? "image/png"
            : lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg"
            : lower.endsWith(".mp3") ? "audio/mpeg"
            : lower.endsWith(".ogg") ? "audio/ogg"
            : "application/octet-stream";
        String encoding = mime.startsWith("text/") || mime.equals("application/json") ? "UTF-8" : null;
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        if ("text/html".equals(mime)) {
            headers.put("Content-Security-Policy", "frame-src 'none'; object-src 'none'");
        }
        try {
            InputStream content = getAssets().open("web/" + relative);
            return new WebResourceResponse(mime, encoding, 200, "OK", headers, content);
        } catch (IOException missing) {
            // 잘못 묶인 파일을 운영 서버의 오래된 파일로 조용히 대체하지 않는다.
            return missingBundledResource();
        }
    }

    private View createNetworkErrorView() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(32, 32, 32, 32);
        panel.setBackgroundColor(Color.rgb(17, 24, 39));
        TextView message = new TextView(this);
        message.setText("게임에 연결할 수 없습니다.\n네트워크를 확인하고 다시 시도해 주세요.");
        message.setTextColor(Color.WHITE);
        message.setTextSize(18);
        message.setGravity(Gravity.CENTER);
        panel.addView(message);
        Button retry = new Button(this);
        retry.setText("다시 시도");
        retry.setOnClickListener(v -> webView.loadUrl(GAME_URL));
        panel.addView(retry);
        panel.setVisibility(View.GONE);
        return panel;
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void setOrientation(final String mode) {
            runOnUiThread(() -> {
                int target = "landscape".equalsIgnoreCase(mode)
                    ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
                if (getRequestedOrientation() != target) {
                    setRequestedOrientation(target);
                }
                hideSystemBars();
            });
        }

        @JavascriptInterface
        public void vibrate(final int ms) {
            final long duration = Math.max(20L, Math.min(400L, (long) ms));
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(duration);
                }
            } catch (Exception ignored) {
            }
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController ctrl = getWindow().getInsetsController();
            if (ctrl != null) {
                ctrl.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                ctrl.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        webView.setFitsSystemWindows(true);
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return bundledGameResource(request);
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if (isGameUrl(uri)) return false;
                if ("https".equalsIgnoreCase(uri.getScheme()) || "mailto".equalsIgnoreCase(uri.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException ignored) {
                        // No browser installed; keep the current game screen.
                    }
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                // Some main-frame redirects or POST navigations do not invoke
                // shouldOverrideUrlLoading. Never expose the JS bridge to another origin.
                if (!isGameUrl(Uri.parse(url))) {
                    view.stopLoading();
                    mainFrameFailed = true;
                    networkErrorView.setVisibility(View.VISIBLE);
                    return;
                }
                mainFrameFailed = false;
                networkErrorView.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    mainFrameFailed = true;
                    networkErrorView.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) {
                    mainFrameFailed = true;
                    networkErrorView.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!mainFrameFailed && isGameUrl(Uri.parse(url))) {
                    networkErrorView.setVisibility(View.GONE);
                    // Unlike @JavascriptInterface, a JS prompt reports the caller's origin to Java.
                    view.evaluateJavascript("window.AndroidBridge.openSocialLogin = function(url) {"
                        + "return window.prompt('" + SOCIAL_LOGIN_PROMPT + "', String(url)) === '1'; };", null);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String value, JsPromptResult result) {
                if (!SOCIAL_LOGIN_PROMPT.equals(message)) return super.onJsPrompt(view, url, message, value, result);
                String top = view.getUrl();
                boolean trusted = !mainFrameFailed && url != null && isGameOrigin(Uri.parse(url))
                    && top != null && isGameUrl(Uri.parse(top));
                result.confirm(trusted && openSocialLogin(value) ? "1" : "0");
                return true;
            }
        });
        FrameLayout root = new FrameLayout(this);
        root.addView(webView);
        networkErrorView = createNetworkErrorView();
        root.addView(networkErrorView);
        setContentView(root);
        hideSystemBars();
        webView.loadUrl(GAME_URL);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    public void onBackPressed() {
        if (networkErrorView != null && networkErrorView.getVisibility() == View.VISIBLE) {
            confirmExit();
        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            confirmExit();
        }
    }

    private void confirmExit() {
        new AlertDialog.Builder(this)
            .setMessage("게임을 종료할까요? 진행 중인 대전은 중단될 수 있습니다.")
            .setNegativeButton("취소", null)
            .setPositiveButton("종료", (dialog, which) -> finish())
            .show();
    }
}
