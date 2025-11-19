import React, { useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const GraphView = ({ data }) => {
    const graphRef = useRef();

    useEffect(() => {
        if (graphRef.current) {
            graphRef.current.d3Force('charge').strength(-50);
        }
    }, []);

    return (
        <div className="w-full h-full bg-gray-900">
            <ForceGraph2D
                ref={graphRef}
                graphData={data}
                nodeLabel="name"
                nodeColor={node => node.isMyContact ? '#4ade80' : (node.isGroup ? '#facc15' : '#60a5fa')}
                nodeVal={node => node.val || 1}
                linkColor={() => '#ffffff33'}
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
