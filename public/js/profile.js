(async function () {
    const user = await AT.requireLogin();
    if (!user) return;
    AT.renderNav('profile', user);

    // Populate profile info
    const res = await AT.apiFetch('/api/auth/me');
    if (!res || !res.ok) return;
    const data = await res.json();
    const profile = data.user;

    document.getElementById('prof-username').textContent = profile.username;
    document.getElementById('prof-role').textContent = profile.role;
    document.getElementById('prof-created').textContent = new Date(profile.created).toLocaleDateString();

    const msgEl = document.getElementById('pw-msg');

    function showMsg(text, isError) {
        msgEl.textContent = text;
        msgEl.className = `alert mt-3 ${isError ? 'alert-danger' : 'alert-success'}`;
        msgEl.classList.remove('d-none');
    }

    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        msgEl.classList.add('d-none');

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showMsg('Passwords do not match', true);
            return;
        }

        if (newPassword.length < 4) {
            showMsg('Password must be at least 4 characters', true);
            return;
        }

        const res = await AT.apiFetch('/api/auth/password', {
            method: 'PUT',
            body: { currentPassword, newPassword }
        });

        if (res && res.ok) {
            showMsg('Password changed successfully.', false);
            document.getElementById('password-form').reset();
        } else {
            const data = res ? await res.json() : {};
            showMsg(data.error || 'Failed to change password', true);
        }
    });
})();
