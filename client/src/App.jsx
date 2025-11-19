import React, { useState, useEffect, useMemo } from 'react';
import io from 'socket.io-client';
import QRCodeView from './components/QRCodeView';
import GraphView from './components/GraphView';
import StatsView from './components/StatsView';
import FilterPanel from './components/FilterPanel';
import InsightsPanel from './components/InsightsPanel';

const socket = io('http://localhost:3001');

function App() {
  const [status, setStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [fullGraphData, setFullGraphData] = useState({ nodes: [], links: [] });
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [filters, setFilters] = useState({
    contactsOnly: false,
    showPeople: true,
    showGroups: true,
    minConnections: 0,
    minMessages: 0,
    timeRange: 'all' // 'all', 'week', 'month', '3months', 'year'
  });

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('qr', (url) => {
      setQrCode(url);
      setStatus('qr_ready');
    });

    socket.on('status', (newStatus) => {
      setStatus(newStatus);
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
      // Filter by type
      if (node.isGroup && !filters.showGroups) return false;
      if (!node.isGroup && !filters.showPeople) return false;

      // Filter contacts only
      if (filters.contactsOnly && !node.isMyContact && !node.isGroup) return false;

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
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });

    return { nodes: filteredNodes, links: filteredLinks };
  }, [fullGraphData, filters]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 text-white font-sans">
      {status === 'disconnected' && (
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-xl">Connecting to server...</div>
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
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Processing Data...</h2>
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4">Analyzing your social graph...</p>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <>
          <FilterPanel filters={filters} onFilterChange={setFilters} />
          <GraphView data={filteredGraphData} />
          <StatsView stats={stats} filteredCount={filteredGraphData.nodes.length} />
          <InsightsPanel insights={insights} />
        </>
      )}
    </div>
  );
}

export default App;
