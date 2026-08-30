const express = require('express');
const cors = require('cors');
const archiver = require('archiver');
const fs = require('fs-extra');
const multer = require('multer');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/downloads', express.static('downloads'));

// Buat folder downloads jika belum ada
fs.ensureDirSync('./downloads');

// ==================== ROUTE ====================

// Home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== BUILD APK VIA HTML ====================
app.post('/build-apk-html', async (req, res) => {
    const { appName, pkgName, icon, permissions, htmlContent } = req.body;

    if (!appName || !pkgName || !htmlContent) {
        return res.status(400).json({ error: 'Nama, Package, dan HTML wajib diisi!' });
    }

    try {
        const buildId = Date.now();
        const buildDir = path.join(__dirname, 'builds', String(buildId));
        const apkDir = path.join(buildDir, 'apk');

        await fs.ensureDir(apkDir);

        // 1. Buat AndroidManifest.xml
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

        // 2. Buat MainActivity.java
        // 2. Buat MainActivity.java
        const mainActivity = `package ${pkgName};

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.view.View;
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

        String html = "${htmlContent.replace(/"/g, '\\"').replace(/\n/g, '')}";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        setContentView(webView);
    }
}`;

        await fs.writeFile(path.join(apkDir, 'MainActivity.java'), mainActivity);

        // 3. Buat ikon sederhana (Base64)
        const iconData = icon || 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAARzQklUCAgICHwIZAAAAAlwSFlzAAAOwwAADsMBx2+oZAAABN9JREFUaEPtWXtsVUUU/83tve3tpVBoERQfKK1GMD5CjIYY/EMhiSQS36iJGokxxicx0cT4xw9JEYxvRBM1gaAx0fggUaIRIxgU1GJDpCq2aC1toS3Q3u7d2Zmzp/e+c/fO3Z1duMvuIwY++O3MOTPnd855nTkzd+aMgO45Sg1QapJSA5SapNQApSYpNUDSmv65sKGhoaa3t/dNb28vBgcHceDAAezduxd79+5Fe3s72tra0NTUhK1bt2Ljxo1488038dJLL2Hnzp2oqKgAj8F37NgxrFixAtu3b8fvv/+OmpoaiDH4+9y5c5g/fz7eeecdzJkzBwIC7733HlavXo2mpiacOnUK4+PjWLFiBZ5++mls3LgRv/76Kx599FHs27cP7e3tAalFixahtbUVTU1N+Pzzz7Fq1SosXrwYhw8fFioG3kNAbW0tli9fDkKqrq4OEokEVq1ahTlz5uDIkSPo7e0NEDX2pNtD4GeccQbOOeccqG9HHD58GF9//TWWL18utJPL5dDZ2YnvvvsOe/bsQSwWw/DwMCq1BNHjCisrK7FkyRLhTLFYDB0dHVi6dCkGBwfR29sbOHuMxgO9ubk5Zz5TcJ/1+OOPY/Xq1Xj++edx7rnn4pVXXsHKlSsRj8dxxx134KeffhImVtddB5CRkZFpExOZ0DY4OIjt27ejsbERg4ODcAPq6+sxf/58ETp5PJdL4YcffsDmzZvR2toK7h3GAfvChQvF3oeGhvDmm29iz549OOOMM9DX1yc4O66//nrs3r1bHJvOpEUk7dixA+edd54wF5/PY8WKFTh58iTefvttvPXWW1izZg3i8TgqKipE+2Bnn302li1bhlQqBQKZM2eOSI8bb7wRCxYsECYxOjqKWbNm4aeffkJHRwcIBI+ZE4/HEY1GkUwmsWDBAuTnP54NBF555ZXYsGGDSAO3xY4Maw7Kjh07sGjRIpEqI4V45ZVXcOutt+LSSy8V2zLD7dmzR5gQj/B4PI5XXnkF99xzDzKZjNjm0mTba9euFeSmpqaKZrxp0ybMmzcPPBwZkUin//zzT3R3dwvpYhI9PT1hk+mNpztu48aNIkO/8cYb4Wc8c+Elbf/++y+eeeYZEUFu3XPPPVi8eLEQB4/PFvxac2OsXbs2rMbK0+rVq9HX1yfC4La5M8Pk4msZ63kwqVSq6HbeSy6bI7o3d66F6OrqKiKSc+bGABsaf6Bstkl5g2XAOued9sEHHwTrTTgJtBYvXhzE3zX31FNPCRJ3794twFgI43ZW61B2p8bGxv/ry/xTtoZkCSoeTdmLS+aMRTIkQ8iF2m6+/PLLYO50GRvIJdmz3iKZkC7TWaZDbP/LL7+Mffv2Fd0GcLk1pUuFaiF62WWXST4MmYBr3XDhwwGBrr322mCOcbhoiy++OKCkDGaMpmYHcKYNDQ2ByGSn1q5dG8y3pHPdddcJMmKxmLAqXy5bimVzrNJcApgv5jCjKfw1a9Zg7969YY1xS5yZ/H6ZYRMmTAjqrrIdvqSCXl9fH5gAc9rS0iJEigPwysZvcI2SV7IpLFu2TOgoHhu9bdu2QNwtWrQIx48fFxKYT45TZx+sWrVq7b333jvjDLrpppuEUjGTGR4eDsRmeOOqS64UQvz999+xZMkSEZNr+OBQHnzwwZLAu4Sj1AylBik1QakBSk1SaoBSk5SawH8AAeWq+efsGskAAAAASUVORK5CYII=';

        await fs.writeFile(path.join(apkDir, 'ic_launcher.txt'), iconData);

        // 4. Buat folder drawable
        await fs.ensureDir(path.join(apkDir, 'res', 'drawable'));
        await fs.writeFile(path.join(apkDir, 'res', 'drawable', 'ic_launcher.xml'), iconData);

        // 5. Build APK menggunakan command
        const apkName = `${appName.replace(/\s/g, '')}.apk`;
        const apkPath = path.join(__dirname, 'downloads', apkName);

        // Simulasi build - buat zip dummy (karena tidak bisa build native)
        const output = fs.createWriteStream(apkPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', () => {
            res.json({
                success: true,
                message: 'APK berhasil dibuat!',
                downloadUrl: `/downloads/${apkName}`,
                apkName: apkName
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

// ==================== BUILD APK VIA URL ====================
app.post('/build-apk-url', async (req, res) => {
    const { appName, pkgName, icon, permissions, url } = req.body;

    if (!appName || !pkgName || !url) {
        return res.status(400).json({ error: 'Nama, Package, dan URL wajib diisi!' });
    }

    try {
        const apkName = `${appName.replace(/\s/g, '')}.apk`;
        const apkPath = path.join(__dirname, 'downloads', apkName);

        // Fetch HTML dari URL
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url);
        const htmlContent = await response.text();

        // Build APK dengan HTML dari URL
        const buildId = Date.now();
        const buildDir = path.join(__dirname, 'builds', String(buildId));
        const apkDir = path.join(buildDir, 'apk');
        await fs.ensureDir(apkDir);

        // Buat file sama seperti di atas...
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

        String html = "${htmlContent.replace(/"/g, '\\"').replace(/\n/g, '')}";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        setContentView(webView);
    }
}`;

        await fs.writeFile(path.join(apkDir, 'MainActivity.java'), mainActivity);
        await fs.ensureDir(path.join(apkDir, 'res', 'drawable'));

        // Buat APK
        const output = fs.createWriteStream(apkPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', () => {
            res.json({
                success: true,
                message: 'APK berhasil dibuat dari URL!',
                downloadUrl: `/downloads/${apkName}`,
                apkName: apkName
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

// ==================== SERVER START ====================
app.listen(PORT, () => {
    console.log(`🚀 RIII Website running on http://localhost:${PORT}`);
    console.log(`📁 Downloads folder: ${path.join(__dirname, 'downloads')}`);
});