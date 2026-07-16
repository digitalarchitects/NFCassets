(async function () {
    const user = await AT.requireLogin();
    if (!user) return;
    if (user.role !== 'admin') {
        document.body.innerHTML = '<div class="container mt-5"><div class="alert alert-danger">Access denied</div></div>';
        return;
    }
    AT.renderNav('lists', user);

    let selectedMakeId = null;

    // ─── Tab switching ──────────────────────────────────────────────────
    document.querySelectorAll('#list-tabs .nav-link').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#list-tabs .nav-link').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById('tab-locations').classList.toggle('d-none', tab !== 'locations');
            document.getElementById('tab-makes').classList.toggle('d-none', tab !== 'makes');
            document.getElementById('tab-categories').classList.toggle('d-none', tab !== 'categories');
            if (tab === 'locations') loadLocations();
            if (tab === 'makes') loadMakes();
            if (tab === 'categories') loadCategories();
        });
    });

    // ─── Locations ──────────────────────────────────────────────────────
    async function loadLocations() {
        const res = await AT.apiFetch('/api/lists/locations');
        if (!res || !res.ok) return;
        const data = await res.json();
        const rows = document.getElementById('loc-rows');
        rows.innerHTML = data.locations.map(l => `
            <tr class="${l.active ? '' : 'table-secondary text-muted'}">
                <td>${l.name}</td>
                <td><span class="badge ${l.active ? 'bg-success' : 'bg-secondary'}">${l.active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-outline-secondary btn-sm loc-rename" data-id="${l.id}" data-name="${l.name}">Rename</button>
                    ${l.active
                        ? `<button class="btn btn-outline-danger btn-sm loc-deactivate" data-id="${l.id}">Deactivate</button>`
                        : `<button class="btn btn-outline-success btn-sm loc-activate" data-id="${l.id}">Activate</button>`
                    }
                </td>
            </tr>`).join('') || '<tr><td colspan="3" class="text-muted">No locations yet.</td></tr>';

        wireLocationButtons();
    }

    function wireLocationButtons() {
        document.querySelectorAll('.loc-rename').forEach(btn => {
            btn.addEventListener('click', async () => {
                const name = prompt('New name:', btn.dataset.name);
                if (!name) return;
                const res = await AT.apiFetch(`/api/lists/locations/${btn.dataset.id}`, { method: 'PUT', body: { name } });
                if (res && res.ok) loadLocations();
                else alert((await res?.json())?.error || 'Failed');
            });
        });
        document.querySelectorAll('.loc-deactivate').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Deactivate this location?')) return;
                const res = await AT.apiFetch(`/api/lists/locations/${btn.dataset.id}`, { method: 'PUT', body: { active: 0 } });
                if (res && res.ok) loadLocations();
                else alert((await res?.json())?.error || 'Failed');
            });
        });
        document.querySelectorAll('.loc-activate').forEach(btn => {
            btn.addEventListener('click', async () => {
                const res = await AT.apiFetch(`/api/lists/locations/${btn.dataset.id}`, { method: 'PUT', body: { active: 1 } });
                if (res && res.ok) loadLocations();
                else alert((await res?.json())?.error || 'Failed');
            });
        });
    }

    document.getElementById('loc-add-btn').addEventListener('click', () => {
        document.getElementById('loc-add-form').classList.toggle('d-none');
    });
    document.getElementById('loc-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('loc-name').value.trim();
        const res = await AT.apiFetch('/api/lists/locations', { method: 'POST', body: { name } });
        if (res && res.ok) {
            document.getElementById('loc-name').value = '';
            document.getElementById('loc-add-form').classList.add('d-none');
            loadLocations();
        } else {
            const err = document.getElementById('loc-error');
            err.textContent = (await res?.json())?.error || 'Failed';
            err.classList.remove('d-none');
        }
    });

    // ─── Makes ──────────────────────────────────────────────────────────
    async function loadMakes() {
        const res = await AT.apiFetch('/api/lists/makes');
        if (!res || !res.ok) return;
        const data = await res.json();
        const rows = document.getElementById('make-rows');
        rows.innerHTML = data.makes.map(m => `
            <tr class="make-row ${m.active ? '' : 'table-secondary text-muted'}" data-id="${m.id}">
                <td>${m.name} <span class="badge bg-info ms-1">${m.models.length} models</span></td>
                <td>
                    <button class="btn btn-outline-secondary btn-sm make-rename" data-id="${m.id}" data-name="${m.name}">Rename</button>
                    ${m.active
                        ? `<button class="btn btn-outline-danger btn-sm make-deactivate" data-id="${m.id}">Deactivate</button>`
                        : `<button class="btn btn-outline-success btn-sm make-activate" data-id="${m.id}">Activate</button>`
                    }
                </td>
            </tr>`).join('') || '<tr><td colspan="2" class="text-muted">No makes yet.</td></tr>';

        wireMakeButtons(data.makes);

        // Select first make by default or reselect
        if (selectedMakeId) document.querySelector(`.make-row[data-id="${selectedMakeId}"]`)?.classList.add('table-active');
        if (!selectedMakeId && data.makes.length > 0) selectMake(data.makes[0].id);
    }

    function wireMakeButtons(makes) {
        document.querySelectorAll('.make-row').forEach(row => {
            row.addEventListener('click', () => selectMake(parseInt(row.dataset.id)));
        });
        document.querySelectorAll('.make-rename').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const name = prompt('New name:', btn.dataset.name);
                if (!name) return;
                const res = await AT.apiFetch(`/api/lists/makes/${btn.dataset.id}`, { method: 'PUT', body: { name } });
                if (res && res.ok) loadMakes();
                else alert((await res?.json())?.error || 'Failed');
            });
        });
        document.querySelectorAll('.make-deactivate, .make-activate').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const active = btn.classList.contains('make-deactivate') ? 0 : 1;
                if (active === 0 && !confirm('Deactivate this make? Its models will be hidden from dropdowns.')) return;
                const res = await AT.apiFetch(`/api/lists/makes/${btn.dataset.id}`, { method: 'PUT', body: { active } });
                if (res && res.ok) loadMakes();
                else alert((await res?.json())?.error || 'Failed');
            });
        });
    }

    function selectMake(makeId) {
        selectedMakeId = makeId;
        document.querySelectorAll('.make-row').forEach(r => r.classList.remove('table-active'));
        document.querySelector(`.make-row[data-id="${makeId}"]`)?.classList.add('table-active');
        document.getElementById('model-add-btn').disabled = false;
        // Load models for this make from the cached makes data
        loadMakes().then(() => {
            // Reload from fresh API for model details
            loadModelsForMake(makeId);
        });
    }

    async function loadModelsForMake(makeId) {
        const res = await AT.apiFetch(`/api/lists/models?make_id=${makeId}`);
        if (!res || !res.ok) return;
        const data = await res.json();
        const makeName = document.querySelector(`.make-row[data-id="${makeId}"] td`)?.textContent?.split(' ')[0] || '';
        document.getElementById('model-make-label').textContent = `for ${makeName}`;
        const rows = document.getElementById('model-rows');
        rows.innerHTML = data.models.map(m => `
            <tr class="${m.active ? '' : 'table-secondary text-muted'}">
                <td>${m.name}</td>
                <td><span class="badge ${m.active ? 'bg-success' : 'bg-secondary'}">${m.active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-outline-secondary btn-sm model-rename" data-id="${m.id}" data-name="${m.name}">Rename</button>
                    ${m.active
                        ? `<button class="btn btn-outline-danger btn-sm model-deactivate" data-id="${m.id}">Deactivate</button>`
                        : `<button class="btn btn-outline-success btn-sm model-activate" data-id="${m.id}">Activate</button>`
                    }
                </td>
            </tr>`).join('') || '<tr><td colspan="3" class="text-muted">No models for this make.</td></tr>';

        wireModelButtons();
    }

    function wireModelButtons() {
        document.querySelectorAll('.model-rename').forEach(btn => {
            btn.addEventListener('click', async () => {
                const name = prompt('New name:', btn.dataset.name);
                if (!name) return;
                const res = await AT.apiFetch(`/api/lists/models/${btn.dataset.id}`, { method: 'PUT', body: { name } });
                if (res && res.ok) loadModelsForMake(selectedMakeId);
                else alert((await res?.json())?.error || 'Failed');
            });
        });
        document.querySelectorAll('.model-deactivate, .model-activate').forEach(btn => {
            btn.addEventListener('click', async () => {
                const active = btn.classList.contains('model-deactivate') ? 0 : 1;
                if (active === 0 && !confirm('Deactivate this model?')) return;
                const res = await AT.apiFetch(`/api/lists/models/${btn.dataset.id}`, { method: 'PUT', body: { active } });
                if (res && res.ok) loadModelsForMake(selectedMakeId);
                else alert((await res?.json())?.error || 'Failed');
            });
        });
    }

    document.getElementById('make-add-btn').addEventListener('click', () => {
        document.getElementById('make-add-form').classList.toggle('d-none');
    });
    document.getElementById('make-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('make-name').value.trim();
        const res = await AT.apiFetch('/api/lists/makes', { method: 'POST', body: { name } });
        if (res && res.ok) {
            document.getElementById('make-name').value = '';
            document.getElementById('make-add-form').classList.add('d-none');
            loadMakes();
        } else {
            document.getElementById('make-error').classList.remove('d-none');
            document.getElementById('make-error').textContent = (await res?.json())?.error || 'Failed';
        }
    });

    document.getElementById('model-add-btn').addEventListener('click', () => {
        document.getElementById('model-add-form').classList.toggle('d-none');
    });
    document.getElementById('model-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('model-name').value.trim();
        const res = await AT.apiFetch('/api/lists/models', { method: 'POST', body: { make_id: selectedMakeId, name } });
        if (res && res.ok) {
            document.getElementById('model-name').value = '';
            document.getElementById('model-add-form').classList.add('d-none');
            loadModelsForMake(selectedMakeId);
        } else {
            document.getElementById('model-error').classList.remove('d-none');
            document.getElementById('model-error').textContent = (await res?.json())?.error || 'Failed';
        }
    });

    // ─── Categories ─────────────────────────────────────────────────────
    async function loadCategories() {
        const res = await AT.apiFetch('/api/lists/categories');
        if (!res || !res.ok) return;
        const data = await res.json();
        const rows = document.getElementById('cat-rows');
        rows.innerHTML = data.categories.map(c => `
            <tr class="${c.active ? '' : 'table-secondary text-muted'}">
                <td>${c.name}</td>
                <td><span class="badge ${c.active ? 'bg-success' : 'bg-secondary'}">${c.active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-outline-secondary btn-sm cat-rename" data-id="${c.id}" data-name="${c.name}">Rename</button>
                    ${c.active
                        ? `<button class="btn btn-outline-danger btn-sm cat-deactivate" data-id="${c.id}">Deactivate</button>`
                        : `<button class="btn btn-outline-success btn-sm cat-activate" data-id="${c.id}">Activate</button>`
                    }
                </td>
            </tr>`).join('') || '<tr><td colspan="3" class="text-muted">No categories yet.</td></tr>';

        wireCategoryButtons();
    }

    function wireCategoryButtons() {
        document.querySelectorAll('.cat-rename').forEach(btn => {
            btn.addEventListener('click', async () => {
                const name = prompt('New name:', btn.dataset.name);
                if (!name) return;
                const res = await AT.apiFetch(`/api/lists/categories/${btn.dataset.id}`, { method: 'PUT', body: { name } });
                if (res && res.ok) loadCategories();
                else alert((await res?.json())?.error || 'Failed');
            });
        });
        document.querySelectorAll('.cat-deactivate, .cat-activate').forEach(btn => {
            btn.addEventListener('click', async () => {
                const active = btn.classList.contains('cat-deactivate') ? 0 : 1;
                if (active === 0 && !confirm('Deactivate this category?')) return;
                const res = await AT.apiFetch(`/api/lists/categories/${btn.dataset.id}`, { method: 'PUT', body: { active } });
                if (res && res.ok) loadCategories();
                else alert((await res?.json())?.error || 'Failed');
            });
        });
    }

    document.getElementById('cat-add-btn').addEventListener('click', () => {
        document.getElementById('cat-add-form').classList.toggle('d-none');
    });
    document.getElementById('cat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('cat-name').value.trim();
        const res = await AT.apiFetch('/api/lists/categories', { method: 'POST', body: { name } });
        if (res && res.ok) {
            document.getElementById('cat-name').value = '';
            document.getElementById('cat-add-form').classList.add('d-none');
            loadCategories();
        } else {
            document.getElementById('cat-error').classList.remove('d-none');
            document.getElementById('cat-error').textContent = (await res?.json())?.error || 'Failed';
        }
    });

    // ─── Init ───────────────────────────────────────────────────────────
    loadLocations();
})();
