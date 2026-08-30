const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
app.use('/downloads', express.static('downloads'));

fs.ensureDirSync('./downloads');

// ============ BUILD APK FROM HTML ============
app.post('/build-apk', async (req, res) => {
    const { appName, pkgName, permissions, htmlContent } = req.body;

    if (!appName || !pkgName || !htmlContent) {
        return res.status(400).json({ error: 'Nama, Package, dan HTML wajib diisi!' });
    }

    try {
        const buildId = Date.now();
        const buildDir = path.join(__dirname, 'builds', String(buildId));
        const apkDir = path.join(buildDir, 'app');
        await fs.ensureDir(apkDir);

        // 1. AndroidManifest.xml
        const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkgName}"
    android:versionCode="1"
    android:versionName="1.0">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="35" />
    <uses-permission android:name="android.permission.INTERNET" />
    ${permissions ? permissions.split(',').map(p => `<uses-permission android:name="${p.trim()}" />`).join('\n    ') : ''}

    <application
        android:icon="@drawable/ic_launcher"
        android:label="${appName}"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen"
        android:usesCleartextTraffic="true"
        android:allowBackup="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;
        await fs.writeFile(path.join(apkDir, 'AndroidManifest.xml'), manifest);

        // 2. MainActivity.java
        const htmlEscaped = htmlContent.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        const mainActivity = `package ${pkgName};

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.view.Window;
import android.view.WindowManager;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setLoadWithOverviewMode(true);
        webView.getSettings().setUseWideViewPort(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        String html = "${htmlEscaped}";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        setContentView(webView);
    }
}`;
        await fs.writeFile(path.join(apkDir, 'MainActivity.java'), mainActivity);

        // 3. Folder res/drawable
        await fs.ensureDir(path.join(apkDir, 'res', 'drawable'));

        // 4. Ikon default
        const defaultIcon = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@android:color/black"/>\n    <foreground android:drawable="@android:drawable/ic_menu_edit"/>\n</adaptive-icon>';
        await fs.writeFile(path.join(apkDir, 'res', 'drawable', 'ic_launcher.xml'), defaultIcon);

        // 5. Buat ZIP
        const zipName = `${appName.replace(/\s/g, '')}.zip`;
        const zipPath = path.join(__dirname, 'downloads', zipName);

        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            res.download(zipPath, zipName, (err) => {
                if (err) console.error(err);
                fs.remove(buildDir).catch(console.error);
                fs.remove(zipPath).catch(console.error);
            });
        });

        archive.pipe(output);
        archive.directory(apkDir, false);
        archive.finalize();

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal build APK: ' + error.message });
    }
});

// ============ BUILD APK FROM URL ============
app.post('/build-apk-url', async (req, res) => {
    const { appName, pkgName, permissions, url } = req.body;

    if (!appName || !pkgName || !url) {
        return res.status(400).json({ error: 'Nama, Package, dan URL wajib diisi!' });
    }

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url);
        const htmlContent = await response.text();

        // Kirim ke endpoint build
        req.body.htmlContent = htmlContent;
        req.body.permissions = permissions || '';
        return app._router.handle(req, res);

    } catch (error) {
        res.status(500).json({ error: 'Gagal fetch URL: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 RIII Website running on http://localhost:${PORT}`);
    console.log(`📁 Builds: ./builds | Downloads: ./downloads`);
});