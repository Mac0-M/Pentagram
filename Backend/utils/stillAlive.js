const axios = require('axios');

/**
 * Sets up a still alive ping route and background interval to prevent Render free tier from sleeping.
 * @param {import('express').Application} app Express application instance
 * @param {number|string} port Server port
 */
function setupStillAlive(app, port) {
    // 1. Create a lightweight ping route
    app.get('/ping', (req, res) => {
        console.log(`[Ping] Received ping request at ${new Date().toISOString()}`);
        res.status(200).send('pong');
    });

    // 2. Start the self-pinging interval if not running in serverless environment (e.g., Vercel)
    if (!process.env.VERCEL) {
        const PING_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
        
        // Render sets RENDER_EXTERNAL_URL automatically. If not available, fallback to localhost.
        const renderExternalUrl = process.env.RENDER_EXTERNAL_URL;
        const targetUrl = renderExternalUrl 
            ? `${renderExternalUrl.replace(/\/$/, '')}/ping` 
            : `http://localhost:${port}/ping`;

        console.log(`[Still Alive Service] Initializing ping for target: ${targetUrl} every 3 minutes`);

        setInterval(async () => {
            try {
                console.log(`[Still Alive Service] Sending request to: ${targetUrl}`);
                const response = await axios.get(targetUrl);
                console.log(`[Still Alive Service] Success! Status: ${response.status} - Response: "${response.data}"`);
            } catch (err) {
                console.error(`[Still Alive Service] Error pinging URL ${targetUrl}: ${err.message}`);
            }
        }, PING_INTERVAL_MS);
    }
}

module.exports = setupStillAlive;
