# WhatsApp Social Graph 📊

Visualize your WhatsApp network as an interactive force-directed graph. Discover your social circles, bridge connectors, and closest friends based on message activity and group memberships.

## ✨ Features

*   **Dual-View Modes**:
    *   **Structural Mode**: Visualize how People are connected to Groups.
    *   **Social Mode**: See direct connections between People (weighted by shared groups).
*   **Privacy First**: Runs entirely locally using Docker. Your data never leaves your machine.
*   **Interactive Controls**:
    *   **Filtering**: Filter by message count, connection strength, time range, "Me" node visibility, and more.
    *   **Physics**: Adjust repulsion and link distance to unravel complex clusters.
    *   **Customization**: Toggle labels, node sizes, and amplify active contacts.
*   **Insights**: Automatic detection of:
    *   🔥 **Most Active Contacts**
    *   🌉 **Bridge People** (connectors between different groups)
    *   ⭐ **Super Connectors**
    *   🐺 **Lone Wolves**
*   **Configurable**: Save and load your visualization settings.

## 🚀 Getting Started

### Prerequisites
*   Docker & Docker Compose
*   WhatsApp on your phone

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Iskandeur/whatsapp-social-graph.git
    cd whatsapp-social-graph
    ```

2.  **Start the application**:
    ```bash
    docker-compose up -d --build
    ```

3.  **Scan & Visualize**:
    *   Open [http://localhost:5173](http://localhost:5173) in your browser.
    *   Scan the QR code with your WhatsApp (Linked Devices).
    *   Wait for the graph to generate! (It may take a minute to fetch your history).

## 🛠️ Built With

*   **Frontend**: React, Vite, D3.js, `react-force-graph-2d`, TailwindCSS.
*   **Backend**: Node.js, Express, Socket.IO.
*   **WhatsApp API**: [WAHA (WhatsApp HTTP API)](https://waha.devlike.pro/) running in a separate container.

## 🔒 Privacy Note

This project uses [WAHA](https://waha.devlike.pro/) to interface with WhatsApp. All data processing happens on your local machine (`localhost`). No data is sent to any external servers.

## 📝 Configuration

You can save your current filter and layout settings using the **"Save Config"** button in the sidebar. This downloads a `.json` file that you can load later.

## License

MIT
