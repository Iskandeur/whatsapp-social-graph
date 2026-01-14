import React, { useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const GraphView = ({ data, filters, selectedNodeIds, focusedNodeId }) => {
    const graphRef = useRef();

    // Zoom/Focus Logic
    useEffect(() => {
        if (graphRef.current && focusedNodeId) {
            const node = data.nodes.find(n => n.id === focusedNodeId);
            if (node) {
                // Pin the node so it doesn't drift away while focused
                // First, unpin all others to avoid freezing the whole graph over time
                data.nodes.forEach(n => { n.fx = null; n.fy = null; });

                // Lock this node in place matches its current position
                node.fx = node.x;
                node.fy = node.y;

                // Initial smooth zoom
                graphRef.current.zoom(6, 1000);

                // Tracking loop to stabilize camera on moving node
                // This ensures we follow the node even if the physics engine is moving it
                let startTime = Date.now();
                const duration = 2500; // Track for 2.5 seconds to ensure stabilization

                const animate = () => {
                    if (!graphRef.current) return;
                    const elapsed = Date.now() - startTime;
                    if (elapsed > duration) return;

                    // Shift camera so node is centered but offset to the right (to clear the sidebar)
                    // Sidebar is w-72 (288px). We want roughly 330px visual offset.
                    // Visual Offset = Graph Coordinates Offset * Zoom Level
                    // Therefore: Graph Offset = Visual Offset / Zoom Level
                    const currentZoom = graphRef.current.zoom();
                    const visualOffset = 330; // 288px sidebar + 42px padding
                    const graphOffset = visualOffset / currentZoom;

                    // Center Viewport to the LEFT of the node (node.x - offset)
                    graphRef.current.centerAt(node.x - graphOffset, node.y, 0);

                    requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
            }
        }
    }, [focusedNodeId, data.nodes]);

    useEffect(() => {
        if (graphRef.current) {
            // Update forces based on filters
            const charge = filters?.repulsion !== undefined ? filters.repulsion : -50;
            const distance = filters?.linkDistance !== undefined ? filters.linkDistance : 50;

            graphRef.current.d3Force('charge').strength(charge);
            graphRef.current.d3Force('link').distance(distance);

            // Allow alpha to re-heat more aggressively
            graphRef.current.d3ReheatSimulation();
        }
    }, [filters?.repulsion, filters?.linkDistance, filters?.nodeSize, filters?.sizeAmplification]);

    // Calculate dynamic node size
    const getNodeVal = (node) => {
        const baseSize = filters?.nodeSize || 5;
        const amp = filters?.sizeAmplification || 1;
        const weight = (filters?.nodeSizeWeight !== undefined ? filters.nodeSizeWeight : 50) / 100;

        // 1. Message Score (Logarithmic 2..12)
        const count = node.messageCount || 0;
        const msgScore = Math.min(2 + Math.log(count + 1) * 2, 12);

        // 2. Connection Score (Linear-ish 2..12)
        const conn = node.connections || 0;
        const connScore = Math.min(2 + conn * 0.5, 12);

        // Weighted Mix
        const blendedScore = (msgScore * (1 - weight)) + (connScore * weight);

        // Return with Base scaling
        return blendedScore * (baseSize / 5) * Math.pow(1.1, (blendedScore * (amp - 1)));
    };

    // Unpin nodes when they are deselected
    useEffect(() => {
        if (data && data.nodes) {
            data.nodes.forEach(node => {
                // If node is pinned (fx is set) BUT it is no longer selected, unpin it
                if ((node.fx !== null || node.fy !== null) && (!selectedNodeIds || !selectedNodeIds.has(node.id))) {
                    node.fx = null;
                    node.fy = null;
                }
            });
        }
    }, [selectedNodeIds, data.nodes]);

    // Custom node renderer to support always-on labels
    const paintNode = (node, ctx, globalScale) => {
        const radius = getNodeVal(node);
        const fontSize = 12 / globalScale;

        // Draw Node Circle
        ctx.beginPath();
        if (selectedNodeIds && selectedNodeIds.has(node.id)) ctx.fillStyle = '#f59e0b'; // Selected: Orange
        else if (node.isMe) ctx.fillStyle = '#ef4444';
        else if (node.isMyContact) ctx.fillStyle = '#4ade80';
        else if (node.isGroup) ctx.fillStyle = '#8b5cf6';
        else ctx.fillStyle = '#60a5fa';

        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fill();

        // Draw Label (Always if selected, or if toggle is on)
        if (filters.showLabels || (selectedNodeIds && selectedNodeIds.has(node.id))) {
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(node.name, node.x, node.y + radius + fontSize);
        }
    };

    return (
        <div className="w-full h-full bg-gray-900">
            <ForceGraph2D
                ref={graphRef}
                graphData={data}
                nodeLabel="name"
                // Always use custom painter if we have selections, to ensure labels show up
                nodeCanvasObject={filters.showLabels || (selectedNodeIds && selectedNodeIds.size > 0) ? paintNode : undefined}
                nodeColor={node => {
                    if (selectedNodeIds && selectedNodeIds.has(node.id)) return '#f59e0b'; // Selected
                    if (node.isMe) return '#ef4444'; // Red for Me
                    if (node.isMyContact) return '#4ade80'; // Green
                    if (node.isGroup) return '#8b5cf6'; // Purple
                    return '#60a5fa'; // Blue
                }}
                nodeVal={getNodeVal}
                linkColor={link => link.type === 'CO_MEMBER' ? '#ffffff11' : '#ffffff33'}
                backgroundColor="#111827"
                onNodeClick={node => {
                    // Center/Zoom on node
                    graphRef.current.centerAt(node.x, node.y, 1000);
                    graphRef.current.zoom(8, 2000);
                }}
            />
        </div>
    );
};

export default GraphView;
