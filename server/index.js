const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');
const { processData } = require('./dataProcessor');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5174"],
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const port = 3001;

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let cachedGraphData = null;
let cachedStats = null;
let cachedInsights = null;
let isClientReady = false;

client.on('qr', (qr) => {
    console.log('QR RECEIVED');
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('Error generating QR code', err);
            return;
        }
        io.emit('qr', url);
    });
});

client.on('loading_screen', (percent, message) => {
    console.log('LOADING_SCREEN', percent, message);
});

client.on('change_state', state => {
    console.log('CHANGE_STATE', state);
});

client.on('ready', async () => {
    console.log('Client is ready!');
    isClientReady = true;
    io.emit('status', 'connected');

    // Start processing data immediately upon connection
    io.emit('status', 'processing');
    try {
        const { graph, stats, insights } = await processData(client);
        cachedGraphData = graph;
        cachedStats = stats;
        cachedInsights = insights;
        io.emit('status', 'ready');
        io.emit('data_ready', { graph, stats, insights });
    } catch (error) {
        console.error('Error processing data:', error);
        io.emit('status', 'error');
    }
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
    io.emit('status', 'authenticated');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
    io.emit('status', 'auth_failure');
});

client.on('remote_session_saved', () => {
    console.log('REMOTE_SESSION_SAVED');
});

// Add error handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    io.emit('status', 'disconnected');
    isClientReady = false;
    // Reinitialize client to allow new login? 
    // For now, user might need to restart server or we implement a reconnect logic
    client.initialize();
});

io.on('connection', (socket) => {
    console.log('A user connected');

    if (isClientReady && cachedGraphData) {
        socket.emit('status', 'ready');
        socket.emit('data_ready', { graph: cachedGraphData, stats: cachedStats, insights: cachedInsights });
    } else if (isClientReady) {
        socket.emit('status', 'processing');
    } else {
        socket.emit('status', 'disconnected');
        // Trigger QR generation if needed, though usually client.on('qr') handles it
    }

    socket.on('disconnect', () => {
        console.log('User disconnected');
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
    client.initialize();
});
