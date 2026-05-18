const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WahaClient } = require('./wahaClient');
const { processData } = require('./dataProcessor');

const app = express();
const server = http.createServer(app);

// Restrict Socket.IO to localhost and private LAN ranges (plus anything listed
// in ALLOWED_ORIGINS) so an arbitrary public website can't open a connection
// and read the social graph. Browser clients always send an Origin header.
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(o => o.trim()).filter(Boolean);

const isAllowedOrigin = (origin) => {
    if (!origin) return true; // non-browser clients send no Origin header
    if (extraOrigins.includes(origin)) return true;
    let host;
    try {
        host = new URL(origin).hostname;
    } catch {
        return false;
    }
    return (
        host === 'localhost' ||
        host === '[::1]' ||
        host.endsWith('.local') ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
};

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
        methods: ["GET", "POST"]
    }
});

const port = 3001;

// Initialize Waha Client
const wahaEndpoint = process.env.WAHA_ENDPOINT || 'http://localhost:3000';
const wahaApiKey = process.env.WAHA_API_KEY;
console.log(`Initializing Waha Client at ${wahaEndpoint}`);
const waha = new WahaClient(wahaEndpoint, wahaApiKey);

let cachedGraphData = null;
let cachedStats = null;
let cachedInsights = null;
let cachedQrCode = null;
let isClientReady = false;
let isProcessing = false;

let lastProcessAttempt = 0;
let lastQrUpdate = 0;
const PROCESS_COOLDOWN = 15000; // 15 seconds cooldown on failure

// Polling loop to check Waha status
async function checkWahaStatus() {
    try {
        const status = await waha.getStatus();
        // Waha status: 'STOPPED', 'STARTING', 'SCAN_QR_CODE', 'WORKING', 'FAILED'

        if (!status) {
            console.log('Waha status check failed (likely 404). Attempting to ensure session exists...');
            await waha.startSession();
            return;
        }

        console.log(`Waha Status: ${status.status || 'Unknown'}`);

        if (status.status === 'SCAN_QR_CODE') {
            isClientReady = false;
            const qr = await waha.getQR();
            if (qr && qr !== cachedQrCode) {
                cachedQrCode = qr;
                lastQrUpdate = Date.now(); // Track freshness
                console.log('New QR Code received from Waha');
                io.emit('qr', qr);
                io.emit('status', 'qr_ready');
            } else if (cachedQrCode) {
                const age = Date.now() - (lastQrUpdate || Date.now());
                if (age > 20000 && age % 10000 < 1000) { // Log every 10s after 20s
                    console.log(`QR Code is ${Math.round(age / 1000)}s old (Stale?)`);
                }
                // Force refresh if stuck for > 60s
                if (age > 60000) {
                    console.log('QR Code stuck for > 60s. Restarting session to force new QR...');
                    cachedQrCode = null;
                    await waha.stopSession(); // We'll add this method
                    await waha.startSession();
                    lastQrUpdate = Date.now();
                }
            }
        } else if (status.status === 'WORKING') {
            if (!isClientReady) {
                isClientReady = true;
                console.log('Waha client is ready!');
                io.emit('status', 'authenticated');
            }

            // Retry processing if data is missing, even if we are already "ready"
            if (!cachedGraphData && !isProcessing) {
                // Check cooldown
                const now = Date.now();
                if (now - lastProcessAttempt < PROCESS_COOLDOWN) {
                    return; // Skip if we tried recently
                }

                console.log('No data cached, starting processing...');
                isProcessing = true;
                lastProcessAttempt = now;

                io.emit('status', 'processing');
                io.emit('progress', { current: 0, total: 100, message: 'Warming up connection...' });

                // Add warmup delay to allow Waha to stabilize after auth
                await new Promise(resolve => setTimeout(resolve, 5000));

                io.emit('progress', { current: 0, total: 100, message: 'Fetching contacts and chats...' });

                try {
                    // Pass the progress callback. Initial automatic processing
                    // skips archived chats by default — the user can re-fetch
                    // with includeArchived via the Reload control.
                    const result = await processData(waha, (progress) => {
                        io.emit('progress', progress);
                    }, 50, { includeArchived: false });

                    cachedGraphData = result.graph;
                    cachedStats = result.stats;
                    cachedInsights = result.insights;

                    // Data is ready, broadcast!
                    io.emit('data_ready', { graph: cachedGraphData, stats: cachedStats, insights: cachedInsights });
                    io.emit('status', 'ready');
                    console.log('Data processing complete.');
                } catch (error) {
                    console.error('Error processing data:', error.message);
                    // Retry will happen on next poll
                } finally {
                    isProcessing = false;
                }
            } else if (cachedGraphData && isClientReady) {
                // Status maintenance
            }
        } else {
            // STARTING, STOPPED, FAILED
            isClientReady = false;
            // Try to start if stopped
            if (status.status === 'STOPPED') {
                console.log('Session stopped, restarting...');
                await waha.startSession();
            }
        }
    } catch (e) {
        console.error('Error checking Waha status:', e.message);
    }
}

// Poll to capture QR codes quickly. Self-rescheduling so a slow check
// (processing can take minutes) never overlaps the next invocation.
async function pollWahaStatus() {
    try {
        await checkWahaStatus();
    } finally {
        setTimeout(pollWahaStatus, 1000);
    }
}
pollWahaStatus();

io.on('connection', (socket) => {
    console.log('A user connected');

    if (isClientReady && cachedGraphData) {
        socket.emit('status', 'ready');
        socket.emit('data_ready', { graph: cachedGraphData, stats: cachedStats, insights: cachedInsights });
    } else if (isProcessing) {
        socket.emit('status', 'processing');
    } else if (cachedQrCode && !isClientReady) {
        socket.emit('qr', cachedQrCode);
        socket.emit('status', 'qr_ready');
    } else {
        socket.emit('status', 'connecting');
    }

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    socket.on('start_processing', async (config) => {
        const limit = config?.limit || 50;
        const includeArchived = !!config?.includeArchived;
        console.log(`Received manual start_processing request with limit: ${limit}, includeArchived: ${includeArchived}`);

        if (isProcessing) {
            socket.emit('status', 'processing');
            return;
        }

        isProcessing = true;
        io.emit('status', 'processing');
        io.emit('progress', { current: 0, total: 100, message: `Re-fetching with limit ${limit}${includeArchived ? ' (incl. archived)' : ''}...` });

        try {
            const result = await processData(waha, (progress) => {
                io.emit('progress', progress);
            }, limit, { includeArchived });

            cachedGraphData = result.graph;
            cachedStats = result.stats;
            cachedInsights = result.insights;

            io.emit('data_ready', { graph: cachedGraphData, stats: cachedStats, insights: cachedInsights });
            io.emit('status', 'ready');
        } catch (error) {
            console.error('Error re-processing data:', error.message);
            io.emit('status', 'ready'); // Revert to ready state (showing old data) or error? Better keep old data if fail
        } finally {
            isProcessing = false;
        }
    });

    socket.on('logout', async () => {
        console.log('Received logout request');
        try {
            await waha.logout();
            // Clear cache
            cachedGraphData = null;
            cachedStats = null;
            cachedInsights = null;
            cachedQrCode = null;
            isClientReady = false;

            io.emit('status', 'disconnected');
            console.log('Logged out successfully. Waiting for polling to pick up new QR...');
        } catch (error) {
            console.error('Error handling logout:', error);
        }
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Initial start attempt
    waha.startSession();
});
