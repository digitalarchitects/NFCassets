(async function () {
    const user = await AT.requireLogin();
    if (!user) return;
    if (user.role !== 'admin') {
        document.body.innerHTML = '<div class="container mt-5"><div class="alert alert-danger">Access denied</div></div>';
        return;
    }
    AT.renderNav('users', user);

    const addPanel = document.getElementById('add-panel');
    const addError = document.getElementById('add-error');
    const userRows = document.getElementById('user-rows');

    function showAddError(msg) {
        addError.textContent = msg;
        addError.classList.remove('d-none');
    }

    function hideAddError() {
        addError.classList.add('d-none');
    }

    async function loadUsers() {
        const res = await AT.apiFetch('/api/users');
        if (!res || !res.ok) return;
        const data = await res.json();
        renderTable(data.users, user.id);
    }

    function renderTable(users, currentUserId) {
        if (users.length === 0) {
            userRows.innerHTML = '<tr><td colspan="5" class="text-muted">No users found.</td></tr>';
            return;
        }

        userRows.innerHTML = users.map(u => {
            const isSelf = u.id === currentUserId;
            const isActive = u.active === 1;
            const rowClass = !isActive ? 'table-secondary text-muted' : '';
            const statusBadge = isActive
                ? '<span class="badge bg-success">Active</span>'
                : '<span class="badge bg-secondary">Inactive</span>';

            const roleOptions = ['user', 'admin']
                .map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`)
                .join('');

            const selfActions = isSelf
                ? '<span class="text-muted small">(you)</span>'
                : `
                    <select class="form-select form-select-sm d-inline-block w-auto role-select" data-id="${u.id}" ${!isActive ? 'disabled' : ''}>
                        ${roleOptions}
                    </select>
                    <button class="btn btn-outline-secondary btn-sm reset-pw-btn" data-id="${u.id}" data-username="${AT.escapeHtml(u.username)}">Reset PW</button>
                    ${isActive
                        ? `<button class="btn btn-outline-danger btn-sm deactivate-btn" data-id="${u.id}" data-username="${AT.escapeHtml(u.username)}">Deactivate</button>`
                        : `<button class="btn btn-outline-success btn-sm activate-btn" data-id="${u.id}" data-username="${AT.escapeHtml(u.username)}">Activate</button>`
                    }
                `;

            return `<tr class="${rowClass}">
                <td>${AT.escapeHtml(u.username)}</td>
                <td>${AT.escapeHtml(u.role)}</td>
                <td>${statusBadge}</td>
                <td>${new Date(u.created).toLocaleDateString()}</td>
                <td>${selfActions}</td>
            </tr>`;
        });

        // Wire up role dropdowns
        document.querySelectorAll('.role-select').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const id = e.target.dataset.id;
                const newRole = e.target.value;
                const res = await AT.apiFetch(`/api/users/${id}`, {
                    method: 'PUT',
                    body: { role: newRole }
                });
                if (res && res.ok) {
                    loadUsers();
                } else {
                    const data = res ? await res.json() : {};
                    alert(data.error || 'Failed to change role');
                    loadUsers();
                }
            });
        });

        // Wire up reset password buttons
        document.querySelectorAll('.reset-pw-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const username = btn.dataset.username;
                const newPw = prompt(`New password for ${username}:`);
                if (!newPw) return;
                if (newPw.length < 4) {
                    alert('Password must be at least 4 characters');
                    return;
                }
                const res = await AT.apiFetch(`/api/users/${id}/password`, {
                    method: 'PUT',
                    body: { password: newPw }
                });
                if (res && res.ok) {
                    alert('Password reset.');
                } else {
                    const data = res ? await res.json() : {};
                    alert(data.error || 'Failed to reset password');
                }
            });
        });

        // Wire up deactivate buttons
        document.querySelectorAll('.deactivate-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const username = btn.dataset.username;
                if (!confirm(`Deactivate ${username}? They will not be able to log in.`)) return;
                const res = await AT.apiFetch(`/api/users/${id}`, {
                    method: 'PUT',
                    body: { active: 0 }
                });
                if (res && res.ok) {
                    loadUsers();
                } else {
                    const data = res ? await res.json() : {};
                    alert(data.error || 'Failed to deactivate user');
                }
            });
        });

        // Wire up activate buttons
        document.querySelectorAll('.activate-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const username = btn.dataset.username;
                if (!confirm(`Reactivate ${username}?`)) return;
                const res = await AT.apiFetch(`/api/users/${id}`, {
                    method: 'PUT',
                    body: { active: 1 }
                });
                if (res && res.ok) {
                    loadUsers();
                } else {
                    const data = res ? await res.json() : {};
                    alert(data.error || 'Failed to reactivate user');
                }
            });
        });
    }

    // Add user toggle
    document.getElementById('add-toggle-btn').addEventListener('click', () => {
        addPanel.classList.toggle('d-none');
        hideAddError();
    });

    // Add user submit
    document.getElementById('add-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAddError();
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('new-role').value;

        const res = await AT.apiFetch('/api/users', {
            method: 'POST',
            body: { username, password, role }
        });

        if (res && res.ok) {
            document.getElementById('add-form').reset();
            addPanel.classList.add('d-none');
            loadUsers();
        } else {
            const data = res ? await res.json() : {};
            showAddError(data.error || 'Failed to create user');
        }
    });

    loadUsers();
})();
