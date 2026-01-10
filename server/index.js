const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WahaClient } = require('./wahaClient');
const cors = require('cors');
const { processData } = require('./dataProcessor');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for dev flexibility (WSL/IP access)
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

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
                console.log('New QR Code received from Waha');
                io.emit('qr', qr);
                io.emit('status', 'qr_ready');
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
                    // Pass the progress callback
                    const result = await processData(waha, (progress) => {
                        io.emit('progress', progress);
                    });

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

// Poll every 1 second to capture QR codes quickly
setInterval(checkWahaStatus, 1000);

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
        console.log(`Received manual start_processing request with limit: ${limit}`);

        if (isProcessing) {
            socket.emit('status', 'processing');
            return;
        }

        isProcessing = true;
        io.emit('status', 'processing');
        io.emit('progress', { current: 0, total: 100, message: `Re-fetching with limit ${limit}...` });

        try {
            const result = await processData(waha, (progress) => {
                io.emit('progress', progress);
            }, limit);

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

// API Endpoints
app.get('/api/graph', (req, res) => {
    if (cachedGraphData) {
        res.json(cachedGraphData);
    } else {
        res.status(503).json({ error: 'Data not ready yet' });
    }
});

app.get('/api/stats', (req, res) => {
    if (cachedStats) {
        res.json(cachedStats);
    } else {
        res.status(503).json({ error: 'Data not ready yet' });
    }
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Initial start attempt
    waha.startSession();
});
