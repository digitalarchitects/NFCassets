require('dotenv').config();

function requireEnv(name, minLength = 1) {
    const value = process.env[name];
    if (!value || value.length < minLength) {
        console.error(
            `ERROR: ${name} must be set${minLength > 1 ? ` to at least ${minLength} characters` : ''}. ` +
            'Check your .env file.'
        );
        process.exit(1);
    }
    return value;
}

const SESSION_SECRET = requireEnv('SESSION_SECRET', 32);

module.exports = {
    PORT: parseInt(process.env.PORT || '3000', 10),
    SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'development',
};
