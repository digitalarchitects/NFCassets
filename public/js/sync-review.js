(async function () {
    const user = await AT.requireLogin();
    if (!user) return;
    if (user.role !== 'admin') {
        document.body.innerHTML = '<div class="container mt-5"><div class="alert alert-danger">Access denied</div></div>';
        return;
    }
    AT.renderNav('sync-review', user);

    const res = await AT.apiFetch('/api/admin/sync/issues');
    if (!res || !res.ok) return;
    const data = await res.json();

    if (!data.issues || data.issues.length === 0) {
        document.getElementById('no-issues').classList.remove('d-none');
        return;
    }

    const container = document.getElementById('issues-container');
    const typeLabels = { missing_from_ad: 'Missing from AD', ad_disabled: 'AD Account Disabled', conflict: 'Username Conflict' };

    // Group by type
    const grouped = {};
    for (const issue of data.issues) {
        if (!grouped[issue.issue_type]) grouped[issue.issue_type] = [];
        grouped[issue.issue_type].push(issue);
    }

    for (const [type, issues] of Object.entries(grouped)) {
        const card = document.createElement('div');
        card.className = 'card mb-3';
        card.innerHTML = `
            <div class="card-header"><strong>${typeLabels[type] || type}</strong> (${issues.length})</div>
            <div class="card-body">
                <table class="table table-sm">
                    <thead><tr><th>Username</th><th>Details</th><th>Action</th></tr></thead>
                    <tbody>
                        ${issues.map(i => {
                            let details = '';
                            try { const d = JSON.parse(i.details || '{}'); details = Object.entries(d).map(([k,v]) => `${k}: ${v}`).join(', '); } catch(e) {}
                            return `<tr>
                                <td>${i.username}</td>
                                <td class="small">${details}</td>
                                <td class="issue-actions" data-id="${i.id}" data-username="${i.username}" data-type="${type}">
                                    ${type === 'missing_from_ad' ? '<button class="btn btn-outline-danger btn-sm deactivate-btn">Deactivate</button> <button class="btn btn-outline-secondary btn-sm ignore-btn">Ignore</button>' : ''}
                                    ${type === 'ad_disabled' ? '<button class="btn btn-outline-danger btn-sm deactivate-btn">Deactivate</button> <button class="btn btn-outline-success btn-sm reenable-btn">Re-enable</button> <button class="btn btn-outline-secondary btn-sm ignore-btn">Ignore</button>' : ''}
                                    ${type === 'conflict' ? '<button class="btn btn-outline-secondary btn-sm ignore-btn">Ignore</button>' : ''}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        container.appendChild(card);
    }

    // Wire buttons
    container.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const row = btn.closest('.issue-actions');
        const id = row.dataset.id;
        const username = row.dataset.username;
        let action;
        if (btn.classList.contains('deactivate-btn')) { action = 'deactivated'; if (!confirm(`Deactivate ${username}?`)) return; }
        else if (btn.classList.contains('ignore-btn')) action = 'ignored';
        else if (btn.classList.contains('reenable-btn')) { action = 're_enabled'; if (!confirm(`Re-enable ${username}?`)) return; }
        else return;

        const res = await AT.apiFetch(`/api/admin/sync/issues/${id}`, { method: 'PUT', body: { action } });
        if (res && res.ok) {
            row.closest('tr').remove();
        } else {
            alert((await res?.json())?.error || 'Failed');
        }
    });
})();
