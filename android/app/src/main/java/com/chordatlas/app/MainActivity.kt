package com.chordatlas.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Hosts the bundled, offline web UI (App/web, copied into assets/web) in a WebView and bridges
 * a few native features: persistent storage, haptics, copying text, opening links, system-bar colours,
 * safe-area insets and the Android back button.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val prefs by lazy { getSharedPreferences("chordatlas", MODE_PRIVATE) }

    @Volatile private var insetTop = 0f
    @Volatile private var insetBottom = 0f

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applySystemBars(isSystemDark())

        webView = WebView(this)
        webView.setBackgroundColor(getColor(R.color.launch_bg))
        webView.overScrollMode = WebView.OVER_SCROLL_NEVER
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false
        setContentView(webView)

        // Serve assets from https://appassets.androidplatform.net/assets/... (a real origin, so storage persists)
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            textZoom = 100
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(false)
        }
        webView.addJavascriptInterface(Bridge(), "AndroidBridge")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == WebViewAssetLoader.DEFAULT_DOMAIN) return false
                openExternal(request.url.toString())
                return true
            }

            override fun onPageFinished(view: WebView, url: String?) {
                pushInsets()
            }
        }

        // Edge-to-edge: the page draws behind the status and navigation bars and pads itself
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val density = resources.displayMetrics.density
            insetTop = bars.top / density
            insetBottom = bars.bottom / density
            view.setPadding(bars.left, 0, bars.right, 0)
            pushInsets()
            insets
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val callback = this
                webView.evaluateJavascript(
                    "(window.ChordAtlasApp && window.ChordAtlasApp.androidBack) ? window.ChordAtlasApp.androidBack() : false"
                ) { result ->
                    if (result != "true") {
                        callback.isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        callback.isEnabled = true
                    }
                }
            }
        })

        val restored = savedInstanceState?.getString(KEY_URL)
        webView.loadUrl(if (restored != null && restored.startsWith(START_URL)) restored else START_URL)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) webView.url?.let { outState.putString(KEY_URL, it) }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("AndroidBridge")
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun isSystemDark(): Boolean =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    /** Transparent bars; dark icons on a light page, light icons on a dark page. */
    private fun applySystemBars(dark: Boolean) {
        val style = if (dark) {
            SystemBarStyle.dark(Color.TRANSPARENT)
        } else {
            SystemBarStyle.light(Color.TRANSPARENT, Color.argb(0x80, 0x1b, 0x1b, 0x1b))
        }
        enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    }

    private fun pushInsets() {
        if (!::webView.isInitialized) return
        webView.evaluateJavascript(
            "window.ChordAtlasApp && window.ChordAtlasApp.setInsets && window.ChordAtlasApp.setInsets($insetTop, $insetBottom)",
            null
        )
    }

    private fun haptic(style: String) {
        val constant = when (style) {
            "selection" -> HapticFeedbackConstants.CLOCK_TICK
            "medium" -> HapticFeedbackConstants.VIRTUAL_KEY
            "success" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
            else -> HapticFeedbackConstants.KEYBOARD_TAP
        }
        webView.performHapticFeedback(constant)
    }

    private fun openExternal(url: String) {
        val uri = Uri.parse(url)
        if (uri.scheme != "https" && uri.scheme != "http") return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: ActivityNotFoundException) {
            // no browser installed; ignore
        }
    }

    /** Methods callable from JavaScript as window.AndroidBridge.* (run on a background thread). */
    inner class Bridge {
        @JavascriptInterface
        fun getStore(): String = prefs.getString(KEY_STORE, "{}") ?: "{}"

        @JavascriptInterface
        fun getInsets(): String = "{\"top\":$insetTop,\"bottom\":$insetBottom}"

        @JavascriptInterface
        fun postMessage(json: String) {
            val msg = try { JSONObject(json) } catch (e: Exception) { return }
            when (msg.optString("type")) {
                "store" -> {
                    val value = msg.optString("value", "{}")
                    val valid = try { JSONObject(value); true } catch (e: Exception) { false }
                    if (valid) prefs.edit().putString(KEY_STORE, value).apply()
                }
                "haptic" -> runOnUiThread { haptic(msg.optString("style", "light")) }
                "open" -> runOnUiThread { openExternal(msg.optString("url")) }
                "copy" -> runOnUiThread {
                    val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("Chord Atlas", msg.optString("text")))
                }
                "theme" -> runOnUiThread { applySystemBars(msg.optBoolean("dark", isSystemDark())) }
            }
        }
    }

    companion object {
        // WebViewAssetLoader.DEFAULT_DOMAIN is appassets.androidplatform.net
        private const val START_URL = "https://appassets.androidplatform.net/assets/web/index.html"
        private const val KEY_URL = "url"
        private const val KEY_STORE = "store"
    }
}
