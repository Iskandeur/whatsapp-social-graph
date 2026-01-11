import React, { useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const GraphView = ({ data, filters, selectedNodeIds }) => {
    const graphRef = useRef();

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
