const { describe, it } = require('node:test');
const assert = require('node:assert');

function loadConfig() {
    delete require.cache[require.resolve('../config')];
    return require('../config');
}

describe('Config validation', () => {
    it('exits with an error when SESSION_SECRET is missing', () => {
        const originalEnv = process.env.SESSION_SECRET;
        delete process.env.SESSION_SECRET;

        let exitCode = null;
        const originalExit = process.exit;
        process.exit = (code) => {
            exitCode = code;
            throw new Error('process.exit called');
        };

        try {
            loadConfig();
        } catch {
            // expected either from process.exit stub or from the module
        } finally {
            process.exit = originalExit;
            if (originalEnv !== undefined) {
                process.env.SESSION_SECRET = originalEnv;
            }
        }

        assert.strictEqual(exitCode, 1);
    });

    it('exits with an error when SESSION_SECRET is too short', () => {
        const originalEnv = process.env.SESSION_SECRET;
        process.env.SESSION_SECRET = 'short';

        let exitCode = null;
        const originalExit = process.exit;
        process.exit = (code) => {
            exitCode = code;
            throw new Error('process.exit called');
        };

        try {
            loadConfig();
        } catch {
            // expected
        } finally {
            process.exit = originalExit;
            if (originalEnv !== undefined) {
                process.env.SESSION_SECRET = originalEnv;
            } else {
                delete process.env.SESSION_SECRET;
            }
        }

        assert.strictEqual(exitCode, 1);
    });
});
