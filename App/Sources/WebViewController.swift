import UIKit
import WebKit

/// Hosts the bundled, offline web UI (App/web) and bridges a few native features:
/// persistent storage (UserDefaults), haptics, copy, and opening external links in Safari.
final class WebViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private var webView: WKWebView!
    private let storeKey = "chordatlas.store.v1"

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let content = WKUserContentController()
        content.addUserScript(WKUserScript(source: bootstrapScript(),
                                           injectionTime: .atDocumentStart,
                                           forMainFrameOnly: true))
        content.add(WeakMessageHandler(self), name: "native")
        config.userContentController = content

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(named: "LaunchBackground") ?? .systemBackground
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") else {
            assertionFailure("web/index.html missing from bundle")
            return
        }
        webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .default }

    /// Injects saved data before the page's scripts run.
    private func bootstrapScript() -> String {
        var json = "{}"
        if let saved = UserDefaults.standard.string(forKey: storeKey),
           let data = saved.data(using: .utf8),
           (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] != nil {
            json = saved
        }
        return "window.__NATIVE__ = true; window.__NATIVE_STORE__ = \(json);"
    }

    // MARK: - JS → native

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "store":
            if let value = body["value"] as? String { UserDefaults.standard.set(value, forKey: storeKey) }
        case "haptic":
            haptic(body["style"] as? String ?? "light")
        case "copy":
            if let text = body["text"] as? String { UIPasteboard.general.string = text }
        case "open":
            if let s = body["url"] as? String, let url = URL(string: s), ["http", "https"].contains(url.scheme ?? "") {
                UIApplication.shared.open(url)
            }
        default:
            break
        }
    }

    private func haptic(_ style: String) {
        switch style {
        case "selection":
            UISelectionFeedbackGenerator().selectionChanged()
        case "success":
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "medium":
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        default:
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    // MARK: - Navigation: keep the app inside the bundle, send web links to Safari

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.allow); return }
        if url.isFileURL || url.scheme == "about" {
            decisionHandler(.allow)
        } else {
            if ["http", "https"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}

/// Avoids a retain cycle between WKUserContentController and the view controller.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}
