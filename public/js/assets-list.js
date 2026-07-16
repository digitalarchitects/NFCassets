(async function () {
    const user = await AT.requireLogin();
    if (!user) return;
    AT.renderNav('assets', user);

    const isAdmin = user.role === 'admin';
    if (isAdmin) {
        document.getElementById('add-toggle-btn').classList.remove('d-none');
    }

    let allMakes = [];
    let allModels = [];

    // Load master lists for dropdowns
    async function loadListData() {
        const res = await AT.apiFetch('/api/lists/all');
        if (!res || !res.ok) return;
        const data = await res.json();

        allMakes = data.makes;
        allModels = data.models;

        // Populate filter dropdowns
        populateDropdown('filter-location', data.locations);
        populateDropdown('filter-make', data.makes);
        populateDropdown('filter-category', data.categories);

        // Populate add form dropdowns
        populateDropdown('new-location', data.locations);
        populateDropdown('new-category', data.categories);

        const makeSel = document.getElementById('new-make');
        makeSel.innerHTML = '<option value="">Make</option>' + data.makes.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        document.getElementById('new-model').innerHTML = '<option value="">Model (select make first)</option>';

        // Wire make → model filter
        makeSel.addEventListener('change', () => {
            const makeId = parseInt(makeSel.value);
            const modelSel = document.getElementById('new-model');
            if (!makeId) {
                modelSel.innerHTML = '<option value="">Model (select make first)</option>';
                return;
            }
            const filtered = allModels.filter(m => m.make_id === makeId);
            if (filtered.length === 0) {
                modelSel.innerHTML = '<option value="">No models available</option>';
            } else {
                modelSel.innerHTML = '<option value="">Select model</option>' + filtered.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
            }
        });
    }

    function populateDropdown(id, items) {
        const sel = document.getElementById(id);
        sel.innerHTML = `<option value="">${sel.options[0]?.text || 'All'}</option>` + items.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    }

    const statusColors = { active: 'bg-success', missing: 'bg-danger', retired: 'bg-secondary' };

    async function search() {
        const q = document.getElementById('search-input').value.trim();
        const status = document.getElementById('status-filter').value;
        const locationId = document.getElementById('filter-location').value;
        const makeId = document.getElementById('filter-make').value;
        const categoryId = document.getElementById('filter-category').value;

        const qs = new URLSearchParams();
        if (q) qs.set('q', q);
        if (status) qs.set('status', status);
        if (locationId) qs.set('locationId', locationId);
        if (makeId) qs.set('makeId', makeId);
        if (categoryId) qs.set('categoryId', categoryId);

        const res = await AT.apiFetch(`/api/assets?${qs.toString()}`);
        if (!res || !res.ok) return;
        const data = await res.json();

        const rows = document.getElementById('asset-rows');
        rows.innerHTML = data.assets
            .map(
                (a) => `<tr style="cursor:pointer" onclick="window.location.href='/asset.html?id=${a.id}'">
                <td>${a.asset_no}</td>
                <td>${a.description || ''}</td>
                <td>${[a.makeName, a.modelName].filter(Boolean).join(' ') || '-'}</td>
                <td>${a.owner || ''}</td>
                <td>${a.locationName || a.location || ''}</td>
                <td>${a.categoryName || '-'}</td>
                <td><span class="badge ${statusColors[a.status] || 'bg-secondary'}">${a.status}</span></td>
            </tr>`
            )
            .join('') || '<tr><td colspan="7" class="text-muted">No assets found.</td></tr>';
    }

    document.getElementById('search-btn').addEventListener('click', search);
    document.getElementById('search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') search();
    });
    document.getElementById('status-filter').addEventListener('change', search);
    document.querySelectorAll('.filter-dropdown').forEach(d => d.addEventListener('change', search));

    if (isAdmin) {
        document.getElementById('add-toggle-btn').addEventListener('click', () => {
            document.getElementById('add-panel').classList.toggle('d-none');
        });

        document.getElementById('add-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const makeId = document.getElementById('new-make').value;
            const modelId = document.getElementById('new-model').value;
            const res = await AT.apiFetch('/api/assets', {
                method: 'POST',
                body: {
                    assetNo: document.getElementById('new-asset-no').value.trim(),
                    serialNo: document.getElementById('new-serial-no').value.trim(),
                    description: document.getElementById('new-description').value.trim(),
                    owner: document.getElementById('new-owner').value.trim(),
                    locationId: document.getElementById('new-location').value || null,
                    categoryId: document.getElementById('new-category').value || null,
                    makeId: makeId || null,
                    modelId: modelId || null,
                },
            });
            if (res && res.ok) {
                document.getElementById('add-form').reset();
                document.getElementById('new-model').innerHTML = '<option value="">Model (select make first)</option>';
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

    await loadListData();
    search();
})();
