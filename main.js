// ===== DOM READY =====
document.addEventListener('DOMContentLoaded', function() {

    // ===== LOGIN SYSTEM (Tanpa Captcha & Username) =====
    const loginBtn = document.getElementById('loginBtn');
    const loginSection = document.getElementById('loginSection');
    const mainContent = document.getElementById('mainContent');
    const userGreeting = document.getElementById('userGreeting');

    loginBtn.addEventListener('click', function() {
        // Login success - langsung
        loginSection.style.display = 'none';
        mainContent.style.display = 'block';
        userGreeting.innerHTML = `👋 Hallo <span class="username">Fahri Novianzz</span>, selamat datang di RIII Website!`;
        
        // Simpan ke localStorage
        localStorage.setItem('riii_user', 'Fahri Novianzz');
        localStorage.setItem('riii_logged', 'true');
    });

    // Cek session
    if (localStorage.getItem('riii_logged') === 'true') {
        const name = localStorage.getItem('riii_user') || 'Fahri Novianzz';
        loginSection.style.display = 'none';
        mainContent.style.display = 'block';
        userGreeting.innerHTML = `👋 Hallo <span class="username">${name}</span>, selamat datang di RIII Website!`;
    }

    // ===== TABS =====
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const target = this.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(target).classList.add('active');
        });
    });

    // ===== BUILD APK - HTML METHOD =====
    const buildFormHtml = document.getElementById('buildFormHtml');
    const buildFormUrl = document.getElementById('buildFormUrl');
    const methodHtmlBtn = document.getElementById('methodHtmlBtn');
    const methodUrlBtn = document.getElementById('methodUrlBtn');

    methodHtmlBtn.addEventListener('click', function() {
        methodHtmlBtn.classList.add('active');
        methodUrlBtn.classList.remove('active');
        buildFormHtml.style.display = 'flex';
        buildFormUrl.style.display = 'none';
    });

    methodUrlBtn.addEventListener('click', function() {
        methodUrlBtn.classList.add('active');
        methodHtmlBtn.classList.remove('active');
        buildFormHtml.style.display = 'none';
        buildFormUrl.style.display = 'flex';
    });

    // Submit HTML
    buildFormHtml.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('.btn-build');
        btn.disabled = true;
        btn.textContent = '⏳ Building...';

        const data = {
            appName: document.getElementById('appName').value,
            pkgName: document.getElementById('pkgName').value,
            icon: document.getElementById('iconData').value,
            permissions: document.getElementById('permissions').value,
            htmlContent: document.getElementById('htmlContent').value
        };

        try {
            const res = await fetch('/build-apk-html', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                showDownload(result.downloadUrl, result.apkName);
            } else {
                alert('❌ ' + result.error);
            }
        } catch (err) {
            alert('❌ Gagal build APK: ' + err.message);
        }

        btn.disabled = false;
        btn.textContent = '🚀 BUILD APK';
    });

    // Submit URL
    buildFormUrl.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('.btn-build');
        btn.disabled = true;
        btn.textContent = '⏳ Building...';

        const data = {
            appName: document.getElementById('appNameUrl').value,
            pkgName: document.getElementById('pkgNameUrl').value,
            icon: document.getElementById('iconDataUrl').value,
            permissions: document.getElementById('permissionsUrl').value,
            url: document.getElementById('urlContent').value
        };

        try {
            const res = await fetch('/build-apk-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                showDownload(result.downloadUrl, result.apkName);
            } else {
                alert('❌ ' + result.error);
            }
        } catch (err) {
            alert('❌ Gagal build APK: ' + err.message);
        }

        btn.disabled = false;
        btn.textContent = '🚀 BUILD APK FROM URL';
    });

    function showDownload(url, name) {
        const box = document.getElementById('downloadBox');
        const link = document.getElementById('downloadLink');
        const info = document.getElementById('apkInfo');
        box.classList.add('show');
        link.href = url;
        link.download = name;
        info.textContent = `📦 ${name} | Ukuran: ~2.5 MB`;
    }

    console.log('🔥 RIII Website loaded successfully!');
});