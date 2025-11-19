# linja-jan-tu

A WhatsApp social graph visualization tool that helps you understand your messaging patterns and connections.

## Overview

This project visualizes your WhatsApp social network as an interactive graph, showing:
- Connections between contacts and groups
- Message frequency and interaction patterns
- Social insights and statistics
- Activity timeframes and engagement metrics

## Features

- 📊 Interactive graph visualization
- 📈 Detailed statistics and insights
- 🔍 Filtering by activity timeframe
- 📱 Real-time data processing
- 🎨 Modern, responsive UI

## Tech Stack

### Client
- React + Vite
- TailwindCSS
- D3.js for graph visualization
- Socket.io for real-time updates

### Server
- Node.js + Express
- whatsapp-web.js for WhatsApp integration
- Socket.io for WebSocket communication

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone git@github.com:Iskandeur/linja-jan-tu.git
cd linja-jan-tu
```

2. Install server dependencies:
```bash
cd server
npm install
```

3. Install client dependencies:
```bash
cd ../client
npm install
```

## Usage

1. Start the server:
```bash
cd server
npm start
```

2. Start the client (in a new terminal):
```bash
cd client
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

4. Scan the QR code with WhatsApp to connect

5. Wait for the data to process and view your social graph!

## Privacy Note

This application processes your WhatsApp data locally. No data is sent to external servers. All authentication sessions are stored locally on your machine.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
