(async function () {
    const user = await AT.requireLogin();
    if (!user) return;
    AT.renderNav('assets', user);

    const isAdmin = user.role === 'admin';
    if (isAdmin) {
        document.getElementById('add-toggle-btn').classList.remove('d-none');
    }

    const statusColors = { active: 'bg-success', missing: 'bg-danger', retired: 'bg-secondary' };

    async function search() {
        const q = document.getElementById('search-input').value.trim();
        const status = document.getElementById('status-filter').value;
        const qs = new URLSearchParams();
        if (q) qs.set('q', q);
        if (status) qs.set('status', status);

        const res = await AT.apiFetch(`/api/assets?${qs.toString()}`);
        if (!res || !res.ok) return;
        const data = await res.json();

        const rows = document.getElementById('asset-rows');
        rows.innerHTML = data.assets
            .map(
                (a) => `<tr style="cursor:pointer" onclick="window.location.href='/asset.html?id=${a.id}'">
                <td>${a.asset_no}</td>
                <td>${a.description || ''}</td>
                <td>${a.owner || ''}</td>
                <td>${a.location || ''}</td>
                <td><span class="badge ${statusColors[a.status] || 'bg-secondary'}">${a.status}</span></td>
            </tr>`
            )
            .join('') || '<tr><td colspan="5" class="text-muted">No assets found.</td></tr>';
    }

    document.getElementById('search-btn').addEventListener('click', search);
    document.getElementById('search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') search();
    });
    document.getElementById('status-filter').addEventListener('change', search);

    if (isAdmin) {
        document.getElementById('add-toggle-btn').addEventListener('click', () => {
            document.getElementById('add-panel').classList.toggle('d-none');
        });

        document.getElementById('add-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const res = await AT.apiFetch('/api/assets', {
                method: 'POST',
                body: {
                    assetNo: document.getElementById('new-asset-no').value.trim(),
                    serialNo: document.getElementById('new-serial-no').value.trim(),
                    description: document.getElementById('new-description').value.trim(),
                    owner: document.getElementById('new-owner').value.trim(),
                    location: document.getElementById('new-location').value.trim(),
                },
            });
            if (res && res.ok) {
                document.getElementById('add-form').reset();
                search();
            } else {
                const data = res ? await res.json() : {};
                alert(data.error || 'Failed to create asset');
            }
        });

        document.getElementById('import-btn').addEventListener('click', async () => {
            const fileInput = document.getElementById('csv-input');
            if (!fileInput.files.length) return;
            const text = await fileInput.files[0].text();

            const csrfToken = await AT.getCsrfToken();
            const res = await fetch('/api/assets/import', {
                method: 'POST',
                headers: { 'Content-Type': 'text/csv', 'CSRF-Token': csrfToken },
                credentials: 'same-origin',
                body: text,
            });

            const data = await res.json();
            const resultEl = document.getElementById('import-result');
            if (res.ok) {
                resultEl.textContent = `Imported ${data.created}, skipped ${data.skipped}.`;
                search();
            } else {
                resultEl.textContent = data.error || 'Import failed';
            }
        });
    }

    search();
})();
