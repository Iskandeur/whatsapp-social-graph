import React, { useState, useEffect, useMemo } from 'react';
import io from 'socket.io-client';
import QRCodeView from './components/QRCodeView';
import GraphView from './components/GraphView';
import StatsView from './components/StatsView';
import FilterPanel from './components/FilterPanel';
import InsightsPanel from './components/InsightsPanel';

// Use current hostname (works for localhost and IP)
const socket = io(`http://${window.location.hostname}:3001`);

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('connecting'); // connecting, disconnected, qr_ready, authenticated, processing, ready, error
  const [qrCode, setQrCode] = useState(null);
  const [fullGraphData, setFullGraphData] = useState({ nodes: [], links: [] });
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [progress, setProgress] = useState(null);
  const [filters, setFilters] = useState({
    viewMode: 'groups', // 'groups' or 'social'
    contactsOnly: false,
    showPeople: true,
    showGroups: true,
    minConnections: 0,
    minMessages: 0,
    timeRange: 'all', // 'all', 'week', 'month', '3months', 'year'
    nodeSize: 5,
    sizeAmplification: 1,
    repulsion: -50,
    linkDistance: 50,
    showLabels: false,
    showMe: true
  });

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to socket server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
      setIsConnected(false);
      setStatus('disconnected');
    });

    socket.on('qr', (url) => {
      console.log('QR code received');
      setQrCode(url);
      setStatus('qr_ready');
    });

    socket.on('status', (newStatus) => {
      console.log('Status update:', newStatus);
      // Don't override qr_ready with disconnected if we have a QR code
      if (newStatus === 'disconnected' && qrCode) {
        return;
      }
      setStatus(newStatus);
    });

    socket.on('progress', (data) => {
      setProgress(data);
      console.log('Progress:', data);
    });

    socket.on('data_ready', ({ graph, stats, insights }) => {
      console.log('Data received from server:', { graphNodes: graph.nodes.length, stats, insights });
      setFullGraphData(graph);
      setStats(stats);
      setInsights(insights);
      setStatus('ready');
    });

    return () => {
      socket.off('connect');
      socket.off('qr');
      socket.off('status');
      socket.off('progress');
      socket.off('data_ready');
    };
  }, []);

  // Apply filters to graph data
  const filteredGraphData = useMemo(() => {
    if (!fullGraphData.nodes || fullGraphData.nodes.length === 0) {
      return { nodes: [], links: [] };
    }

    // Calculate time threshold based on filter
    const now = Date.now();
    const timeThresholds = {
      'all': 0,
      'week': now - 7 * 24 * 60 * 60 * 1000,
      'month': now - 30 * 24 * 60 * 60 * 1000,
      '3months': now - 90 * 24 * 60 * 60 * 1000,
      'year': now - 365 * 24 * 60 * 60 * 1000
    };
    const timeThreshold = timeThresholds[filters.timeRange] || 0;

    // Filter nodes
    let filteredNodes = fullGraphData.nodes.filter(node => {
      // Social Mode: Hide ALL groups
      if (filters.viewMode === 'social' && node.isGroup) return false;

      // Group Mode: Respect individual toggles
      if (filters.viewMode === 'groups') {
        if (node.isGroup && !filters.showGroups) return false;
        if (!node.isGroup && !filters.showPeople) return false;
      }

      // Filter contacts only
      if (filters.contactsOnly && !node.isMyContact && !node.isGroup) return false;

      // Filter archived
      if (filters.hideArchived && node.isArchived) return false;

      // Filter "Me" node
      if (filters.showMe === false && node.isMe) return false;

      // Filter by connections
      if (node.connections !== undefined && node.connections < filters.minConnections) return false;

      // Filter by messages
      if (node.messageCount !== undefined && node.messageCount < filters.minMessages) return false;

      // Filter by time (lastActivity) - FIXED: exclude nodes without activity when using time filter
      if (timeThreshold > 0) {
        // If no lastActivity, exclude it when time filtering is active
        if (!node.lastActivity || node.lastActivity < timeThreshold) {
          return false;
        }
      }

      return true;
    });

    // Get set of visible node IDs
    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));

    // Filter links to only include those between visible nodes
    const filteredLinks = fullGraphData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      // Safety check
      if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) return false;

      // Filter based on View Mode
      if (filters.viewMode === 'social') {
        // In Social Mode, ONLY show CO_MEMBER and DIRECT links. Hide MEMBERSHIP links.
        // Note: DIRECT links are Me-Person. CO_MEMBER are Person-Person (shared group).
        if (link.type === 'MEMBERSHIP') return false;
        return true;
      } else {
        // In Groups Mode, ONLY show MEMBERSHIP and DIRECT links. Hide CO_MEMBER links (too noisy).
        if (link.type === 'CO_MEMBER') return false;
        return true;
      }
    });

    return { nodes: filteredNodes, links: filteredLinks };
  }, [fullGraphData, filters]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 text-white font-sans relative">
      {!isConnected && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-pulse text-xl text-red-400">Connecting to socket server...</div>
            <p className="text-gray-500 text-sm mt-2">Ensure server is running on port 3001</p>
          </div>
        </div>
      )}

      {isConnected && status === 'connecting' && (
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-xl text-blue-400">Waiting for server status...</div>
        </div>
      )}

      {isConnected && status === 'disconnected' && !qrCode && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-xl text-orange-400">Disconnected from WhatsApp</div>
            <p className="text-gray-500 mt-2">Waiting for QR code...</p>
          </div>
        </div>
      )}

      {(status === 'qr_ready' || status === 'auth_failure') && (
        <QRCodeView qrCode={qrCode} />
      )}

      {status === 'authenticated' && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Authenticated!</h2>
            <p className="text-gray-400">Waiting for WhatsApp to sync...</p>
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center w-full max-w-md px-4">
            <h2 className="text-2xl font-bold mb-6">Processing Data...</h2>

            {progress ? (
              <div className="w-full">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-blue-400">{progress.message}</span>
                  <span className="font-mono">{progress.current}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${progress.current}%` }}
                  ></div>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  Fetching recent messages from your chats to build the social graph.
                </div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-400 mt-4">Analyzing your social graph...</p>
              </>
            )}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-red-500">
            <h2 className="text-2xl font-bold mb-4">Error Processing Data</h2>
            <p>Something went wrong while communicating with WhatsApp.</p>
            <p className="mt-2 text-sm text-gray-400">Check server logs for details. Please restart the server and try again.</p>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <>
          {/* Sidebar for Controls and Stats */}
          <div className="fixed top-4 left-4 w-80 max-h-[96vh] overflow-y-auto flex flex-col gap-4 z-50 pointer-events-none pb-8 pr-2">
            <div className="pointer-events-auto">
              <FilterPanel filters={filters} onFilterChange={setFilters} />
            </div>
            <div className="pointer-events-auto">
              <StatsView stats={stats} filteredCount={filteredGraphData.nodes.length} />
            </div>
            <div className="pointer-events-auto">
              <InsightsPanel insights={insights} />
            </div>
          </div>

          {/* Graph Canvas */}
          <GraphView data={filteredGraphData} filters={filters} />
        </>
      )}
    </div>
  );
}

export default App;
