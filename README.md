# WhatsApp Social Graph

Visualize your WhatsApp network as an interactive social graph. This tool connects to your WhatsApp account (via Waha + Puppeteer), fetches your chat history, and builds a force-directed graph showing relationships between you, your contacts, and groups.

![WhatsApp Social Graph](./assets/screenshot.png)

## Features

-   **Interactive Visualization**: Zoom, pan, and drag nodes.
-   **Social vs Structural Views**:
    -   *Structural Mode*: Shows direct connections to groups.
    -   *Social Mode*: Infers connections between people based on shared groups (hides group nodes).
-   **Performance for Large Accounts**:
    -   **Massive Contact Fetching**: Optimized pagination to handle 40,000+ contacts without API timeouts.
    -   **Smart Filtering**: Automatically hides disconnected "Address Book Only" contacts to keep the graph focused on actual interactions (Hairball Reduction).
-   **Dynamic UI & Experience**:
    -   **Compact Design**: Narrow sidebar with **Accordion-style Insights** to maximize graph visibility.
    -   **Intelligent Camera**: Automatically centers and offsets focused nodes regardless of screen size or zoom level.
    -   **QR Auto-Refresh**: Automatically detects stale QR codes and restarts the session to ensure a smooth login.
-   **Insights**:
    -   **Unexpected Bridges**: Shows up to 20 people who connect strictly disjoint social circles (e.g., your Work and Family groups).
    -   **Super Connectors**: Top contacts by unique connections.
    -   Top active contacts and largest groups.
-   **Data Management**:
    -   **Import/Export**: Save your graph data to JSON and load it later.
    -   **Fetch Limit Control**: Choose how many messages to analyze per chat for deeper analysis.

## Technology Stack

-   **Frontend**: React, Vite, `react-force-graph-2d`, TailwindCSS.
-   **Backend**: Node.js, Express, Socket.IO.
-   **WhatsApp API**: [Waha (WhatsApp HTTP API)](https://waha.dev/) running on Puppeteer.
-   **Containerization**: Docker & Docker Compose.

## Prerequisites

-   Docker and Docker Compose installed.
-   A WhatsApp account on your phone.

## How to Run

1.  **Clone the repository**.
2.  **Start the services**:
    ```bash
    docker-compose up -d
    ```
3.  **Open the application**:
    Access [http://localhost:5173](http://localhost:5173).
4.  **Scan the QR Code**:
    Open WhatsApp on your phone -> Linked Devices -> Link a Device -> Scan the QR code displayed on screen.
5.  **Wait for Processing**:
    The app will fetch your contacts and chat history.
    *Default limit is 50 messages per chat for speed.*

## Controls Guide

### Advanced Filters
-   **Node Size Weight**: Balance size between Message Count (Left) and Connection Count (Right).
-   **Fetch Limit**: Increase for deeper history analysis. Click **Reload** to re-process.
-   **Export/Import**: Save/load graph snapshots.

### Keyboard Shortcuts
-   **H**: Toggle User Interface.

### Troubleshooting

-   **Stuck on "Fetching chats..."**: If you have thousands of chats, this step can take up to 5 minutes. The timeout has been increased to handle this. Please be patient.
-   **Infinite Loop**: If the app keeps restarting processing, ensure you utilize the latest version which fixes a critical crash bug.
-   **QR Code not appearing**: Check the logs `docker logs whatsapp-social-graph-server-1`. If Waha is starting up, it might take 10-20 seconds.
-   **"Fetched 0 contacts" or Partial Graph**: Due to stability issues with the Waha API, the app may skip contact fetching or only load a portion of your chats (e.g., 300 chats) if the engine gets overloaded. This is expected behavior to prevent crashes. The graph will still build with the data retrieved.
-   **Nodes disappearing with "Min Messages" Filter**: If the server fails to fetch messages for specific chats (due to Waha timeouts), it will default to 0 messages for that person. They will appear in the main graph (Green) but will be filtered out if you set "Min Messages" > 1. This ensures you still see your contacts even if their history failed to load.

## License

MIT
