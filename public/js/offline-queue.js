// Minimal IndexedDB-backed queue for verification scans made while offline.
// Flushed automatically when the browser regains connectivity.
(function (window) {
    const DB_NAME = 'asset-tracker-offline';
    const STORE = 'pending_verifications';

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function add(item) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).add({ ...item, queuedAt: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function all() {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function remove(id) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function flush() {
        if (!navigator.onLine) return;
        const items = await all();
        for (const item of items) {
            try {
                const { id, queuedAt, ...payload } = item;
                const res = await window.AT.apiFetch('/api/verification', {
                    method: 'POST',
                    body: payload,
                });
                if (res && res.ok) {
                    await remove(id);
                }
            } catch (err) {
                break; // still offline or server unreachable, stop and retry later
            }
        }
    }

    window.addEventListener('online', flush);
    window.addEventListener('load', flush);

    window.OfflineQueue = { add, all, flush };
})(window);
