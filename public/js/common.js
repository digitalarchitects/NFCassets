// Shared helpers: CSRF-aware fetch wrapper, auth guard, nav bar.
(function (window) {
    let csrfToken = null;

    async function getCsrfToken() {
        if (csrfToken) return csrfToken;
        const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
        const data = await res.json();
        csrfToken = data.csrfToken;
        return csrfToken;
    }

    async function apiFetch(url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const headers = Object.assign({}, options.headers);
        let body = options.body;

        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            headers['CSRF-Token'] = await getCsrfToken();
            if (body && !(body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(body);
            }
        }

        const res = await fetch(url, {
            ...options,
            method,
            headers,
            body,
            credentials: 'same-origin',
        });

        if (res.status === 401 && !url.includes('/auth/')) {
            window.location.href = '/login.html';
            return null;
        }

        return res;
    }

    async function requireLogin() {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!res.ok) {
            window.location.href = '/login.html';
            return null;
        }
        const data = await res.json();
        return data.user;
    }

    function renderNav(activePage, user) {
        const el = document.getElementById('nav-placeholder');
        if (!el) return;
        const isAdmin = user && user.role === 'admin';
        el.innerHTML = `
        <nav class="navbar navbar-expand navbar-dark bg-dark mb-3">
          <div class="container-fluid">
            <a class="navbar-brand" href="/index.html">Asset Tracker</a>
            <div class="navbar-nav">
              <a class="nav-link ${activePage === 'dashboard' ? 'active' : ''}" href="/index.html">Dashboard</a>
              <a class="nav-link ${activePage === 'scan' ? 'active' : ''}" href="/scan.html">Scan</a>
              <a class="nav-link ${activePage === 'assets' ? 'active' : ''}" href="/assets.html">Assets</a>
            </div>
            <div class="d-flex align-items-center">
              <span class="text-light me-3">${user ? user.username : ''}${isAdmin ? ' (admin)' : ''}</span>
              <button class="btn btn-outline-light btn-sm" id="logout-btn">Logout</button>
            </div>
          </div>
        </nav>`;

        document.getElementById('logout-btn').addEventListener('click', async () => {
            await apiFetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login.html';
        });
    }

    window.AT = { apiFetch, requireLogin, renderNav, getCsrfToken };

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.warn('Service worker registration failed:', err);
            });
        });
    }
})(window);
