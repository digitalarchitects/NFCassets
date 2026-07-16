(async function () {
    const user = await AT.requireLogin();
    if (!user) return;
    AT.renderNav('scan', user);

    const errorEl = document.getElementById('scan-error');
    const statusEl = document.getElementById('nfc-status');

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.classList.remove('d-none');
    }

    function extractCode(raw) {
        const value = raw.trim();
        try {
            const url = new URL(value);
            const parts = url.pathname.split('/').filter(Boolean);
            return decodeURIComponent(parts[parts.length - 1] || value);
        } catch (e) {
            return value; // not a URL, treat as a raw asset code
        }
    }

    function goToAsset(code) {
        if (!code) return;
        window.location.href = `/asset.html?code=${encodeURIComponent(code)}`;
    }

    // --- Web NFC (Chrome for Android only) ---------------------------------
    if ('NDEFReader' in window) {
        document.getElementById('nfc-section').classList.remove('d-none');
        document.getElementById('nfc-scan-btn').addEventListener('click', async () => {
            errorEl.classList.add('d-none');
            try {
                const reader = new NDEFReader();
                await reader.scan();
                statusEl.textContent = 'Waiting for a tag... hold your phone near it.';
                reader.onreading = (event) => {
                    for (const record of event.message.records) {
                        if (record.recordType === 'text' || record.recordType === 'url') {
                            const decoder = new TextDecoder(record.encoding || 'utf-8');
                            const value = decoder.decode(record.data);
                            goToAsset(extractCode(value));
                            return;
                        }
                    }
                    showError('Tag scanned but no readable record was found.');
                };
                reader.onreadingerror = () => showError('Could not read tag. Try again.');
            } catch (err) {
                showError(`NFC scan failed: ${err.message}`);
            }
        });
    }

    // --- QR fallback (works on any device with a camera) --------------------
    let qrScanner = null;
    document.getElementById('qr-scan-btn').addEventListener('click', async () => {
        errorEl.classList.add('d-none');
        const readerEl = document.getElementById('reader');
        readerEl.classList.remove('d-none');

        if (qrScanner) return; // already running

        qrScanner = new Html5Qrcode('reader');
        try {
            await qrScanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: 220 },
                (decodedText) => {
                    qrScanner.stop().catch(() => { });
                    goToAsset(extractCode(decodedText));
                },
                () => { } // ignore per-frame decode errors
            );
        } catch (err) {
            showError(`Camera access failed: ${err.message}`);
        }
    });

    // --- Manual entry ---------------------------------------------------------
    document.getElementById('manual-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const code = document.getElementById('manual-code').value.trim();
        goToAsset(code);
    });
})();
