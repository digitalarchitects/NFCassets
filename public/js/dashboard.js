(async function () {
    const user = await AT.requireLogin();
    if (!user) return;
    AT.renderNav('dashboard', user);

    const res = await AT.apiFetch('/api/assets/stats');
    if (!res || !res.ok) return;
    const stats = await res.json();

    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-checked').textContent = stats.checkedToday;
    document.getElementById('stat-missing').textContent = stats.missing;
})();
