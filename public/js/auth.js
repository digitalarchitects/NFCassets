document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('d-none');

    try {
        const res = await AT.apiFetch('/api/auth/login', {
            method: 'POST',
            body: { username, password },
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.error || 'Login failed';
            errorEl.classList.remove('d-none');
            return;
        }

        window.location.href = '/index.html';
    } catch (err) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.remove('d-none');
    }
});
