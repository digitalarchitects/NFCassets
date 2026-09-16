(async function () {
    const user = await AT.requireLogin();
    if (!user) return;
    AT.renderNav('scan', user);

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const id = params.get('id');

    let asset = null;

    async function loadAsset() {
        let res;
        if (code) {
            res = await AT.apiFetch(`/api/assets/lookup/${encodeURIComponent(code)}`);
        } else if (id) {
            res = await AT.apiFetch(`/api/assets/${encodeURIComponent(id)}`);
        } else {
            document.getElementById('not-found').classList.remove('d-none');
            document.getElementById('not-found').textContent = 'No asset specified.';
            return;
        }

        if (!res || !res.ok) {
            document.getElementById('not-found').classList.remove('d-none');
            return;
        }

        const data = await res.json();
        asset = data.asset;
        renderAsset();
        loadHistory();
    }

    const statusColors = { active: 'bg-success', missing: 'bg-danger', retired: 'bg-secondary' };

    function renderAsset() {
        document.getElementById('asset-view').classList.remove('d-none');
        document.getElementById('asset-title').textContent = asset.description || asset.asset_no;
        document.getElementById('asset-no').textContent = asset.asset_no;
        document.getElementById('asset-serial').textContent = asset.serial_no || '-';
        document.getElementById('asset-owner').textContent = asset.owner || '-';
        document.getElementById('asset-location').textContent = asset.locationName || asset.location || '-';

        // Resolved names from JOINs
        const makeModel = [asset.makeName, asset.modelName].filter(Boolean).join(' ');
        document.getElementById('asset-make-model').textContent = makeModel || '-';
        document.getElementById('asset-category').textContent = asset.categoryName || '-';

        const statusBadge = document.getElementById('asset-status');
        statusBadge.textContent = asset.status;
        statusBadge.className = `badge ${statusColors[asset.status] || 'bg-secondary'}`;

        document.getElementById('new-owner').value = asset.owner || '';
        // Location dropdown pre-selected
        const locSel = document.getElementById('new-location-id');
        if (asset.location_id && locSel.options.length > 0) {
            locSel.value = asset.location_id;
        }

        const photoEl = document.getElementById('asset-photo');
        if (asset.photo_path) {
            photoEl.src = `/uploads/${asset.photo_path}`;
            photoEl.classList.remove('d-none');
        }

        if ('NDEFReader' in window) {
            document.getElementById('write-tag-btn').classList.remove('d-none');
        }
    }

    function showMessage(msg, isError) {
        const el = document.getElementById('action-msg');
        el.textContent = msg;
        el.className = `alert mt-3 ${isError ? 'alert-danger' : 'alert-info'}`;
        el.classList.remove('d-none');
    }

    function getGps() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                () => resolve(null),
                { timeout: 5000 }
            );
        });
    }

    document.getElementById('verify-btn').addEventListener('click', async () => {
        const gps = await getGps();
        const payload = { assetId: asset.id, latitude: gps?.latitude ?? null, longitude: gps?.longitude ?? null };

        if (!navigator.onLine) {
            await window.OfflineQueue.add(payload);
            showMessage('Offline: verification saved locally and will sync automatically.', false);
            return;
        }

        try {
            const res = await AT.apiFetch('/api/verification', { method: 'POST', body: payload });
            if (res && res.ok) {
                showMessage('Asset verified as present.', false);
            } else {
                showMessage('Verification failed.', true);
            }
        } catch (err) {
            await window.OfflineQueue.add(payload);
            showMessage('Network unavailable: verification saved locally and will sync automatically.', false);
        }
    });

    document.getElementById('transfer-toggle-btn').addEventListener('click', () => {
        document.getElementById('transfer-panel').classList.toggle('d-none');
    });

    document.getElementById('history-toggle-btn').addEventListener('click', () => {
        document.getElementById('history-panel').classList.toggle('d-none');
    });

    document.getElementById('transfer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const gps = await getGps();
        const newOwner = document.getElementById('new-owner').value.trim();
        const locationId = document.getElementById('new-location-id').value || null;
        const gpsStr = gps ? `${gps.latitude},${gps.longitude}` : null;

        const res = await AT.apiFetch(`/api/assets/${asset.id}/transfer`, {
            method: 'POST',
            body: { newOwner, locationId, gps: gpsStr },
        });

        if (res && res.ok) {
            const data = await res.json();
            asset = data.asset;
            renderAsset();
            loadHistory();
            showMessage('Asset transferred.', false);
            document.getElementById('transfer-panel').classList.add('d-none');
        } else {
            showMessage('Transfer failed.', true);
        }
    });

    document.getElementById('photo-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('photo-input');
        if (!fileInput.files.length) return;

        const formData = new FormData();
        formData.append('photo', fileInput.files[0]);

        const res = await AT.apiFetch(`/api/assets/${asset.id}/photo`, {
            method: 'POST',
            body: formData,
        });

        if (res && res.ok) {
            const data = await res.json();
            asset.photo_path = data.photoPath;
            renderAsset();
            showMessage('Photo uploaded.', false);
        } else {
            showMessage('Photo upload failed.', true);
        }
    });

    document.getElementById('write-tag-btn').addEventListener('click', async () => {
        try {
            const writer = new NDEFReader();
            const url = `${window.location.origin}/asset.html?code=${asset.guid}`;
            await writer.write({
                records: [
                    { recordType: 'url', data: url },
                    { recordType: 'text', data: asset.guid },
                ],
            });
            showMessage('Tag written successfully.', false);
        } catch (err) {
            showMessage(`Writing tag failed: ${err.message}`, true);
        }
    });

    async function loadHistory() {
        const res = await AT.apiFetch(`/api/history/${asset.id}`);
        if (!res || !res.ok) return;
        const data = await res.json();
        const list = document.getElementById('history-list');
        list.innerHTML = data.history
            .map(
                (h) => `<div class="history-item">
                <div><strong>${AT.escapeHtml(h.action)}</strong> ${h.username ? `by ${AT.escapeHtml(h.username)}` : ''}</div>
                <div class="text-muted small">${new Date(h.created).toLocaleString()}</div>
                ${h.old_value ? `<div class="small">From: ${AT.escapeHtml(h.old_value)}</div>` : ''}
                ${h.new_value ? `<div class="small">To: ${AT.escapeHtml(h.new_value)}</div>` : ''}
            </div>`
            )
            .join('') || '<p class="text-muted">No history yet.</p>';
    }

    // Load locations for transfer dropdown
    try {
        const res = await AT.apiFetch('/api/lists/all');
        if (res && res.ok) {
            const data = await res.json();
            const sel = document.getElementById('new-location-id');
            sel.innerHTML = '<option value="">(no change)</option>' + data.locations.map(l => `<option value="${l.id}">${AT.escapeHtml(l.name)}</option>`).join('');
        }
    } catch (e) { /* dropdown will be empty — still works */ }

    loadAsset();
})();
