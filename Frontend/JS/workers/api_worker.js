// ==========================================
// API WORKER (Web Worker)
// ==========================================
// Thin dispatcher only. Game-specific logic lives in lol_handler.js and dota_handler.js.

importScripts('./lol_handler.js', './dota_handler.js');

self.onmessage = async (e) => {
    const { game, action, payload, config, requestId } = e.data;

    try {
        let result = null;

        if (game === 'lol') {
            result = await self.handleLol(action, payload, config);
        } else if (game === 'dota2') {
            result = await self.handleDota2(action, payload, config);
        }

        self.postMessage({ success: true, game, action, data: result, requestId });
    } catch (error) {
        self.postMessage({ success: false, game, action, error: error.message, requestId });
    }
};
