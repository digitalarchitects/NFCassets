(async function () {
    const user = await AT.requireLogin();
    if (!user) return;
    if (user.role !== 'admin') {
        document.body.innerHTML = '<div class="container mt-5"><div class="alert alert-danger">Access denied</div></div>';
        return;
    }
    AT.renderNav('ldap', user);

    // Load current config
    const cfgRes = await AT.apiFetch('/api/admin/ldap/config');
    if (cfgRes && cfgRes.ok) {
        const cfg = await cfgRes.json();
        document.getElementById('ldap-url').value = cfg.url || '';
        document.getElementById('ldap-base-dn').value = cfg.baseDn || '';
        document.getElementById('ldap-bind-dn').value = cfg.bindDn || '';
        if (cfg.hasPassword) {
            document.getElementById('ldap-password').placeholder = '(saved)';
        }
    }

    function showStatus(msg, isError) {
        const el = document.getElementById('status-msg');
        el.textContent = msg;
        el.className = `alert ${isError ? 'alert-danger' : 'alert-success'}`;
        el.classList.remove('d-none');
    }

    document.getElementById('test-btn').addEventListener('click', async () => {
        showStatus('Testing...', false);
        const body = {
            url: document.getElementById('ldap-url').value,
            baseDn: document.getElementById('ldap-base-dn').value,
            bindDn: document.getElementById('ldap-bind-dn').value,
            password: document.getElementById('ldap-password').value || undefined,
        };
        const res = await AT.apiFetch('/api/admin/ldap/test', { method: 'POST', body });
        if (!res) return;
        const data = await res.json();
        if (data.connected) {
            showStatus(`Connected! ${data.userCount}`, false);
        } else {
            showStatus(`Connection failed: ${data.error}`, true);
        }
    });

    document.getElementById('import-btn').addEventListener('click', async () => {
        if (!confirm('Run LDAP import now? This will create/update users from the directory.')) return;
        showStatus('Importing...', false);
        document.getElementById('import-result').classList.add('d-none');

        const res = await AT.apiFetch('/api/admin/ldap/import', { method: 'POST' });
        if (!res) return;
        const data = await res.json();
        if (data.error) {
            showStatus(data.error, true);
            return;
        }

        document.getElementById('res-created').textContent = data.usersCreated;
        document.getElementById('res-updated').textContent = data.usersUpdated;
        document.getElementById('res-issues').textContent = data.issuesCreated;
        document.getElementById('res-errors').textContent = data.errors?.length ? data.errors.join('; ') : '';
        document.getElementById('import-result').classList.remove('d-none');
        showStatus('Import complete.', false);
    });
})();
