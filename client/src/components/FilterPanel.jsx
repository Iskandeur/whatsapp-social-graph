import React, { useState, useMemo } from 'react';

const FilterPanel = ({ filters, onFilterChange, availableNodes = [], selectedNodeIds = new Set(), onToggleNodeSelection }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const searchResults = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        return availableNodes
            .filter(node => node.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .slice(0, 5); // Limit to 5 results
    }, [searchTerm, availableNodes]);

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-xl w-full bg-opacity-90 backdrop-blur-sm">
            <h2 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">Filters & Search</h2>

            <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder="Search Select Nodes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-gray-700 mt-1 rounded shadow-lg z-50 max-h-40 overflow-y-auto">
                            {searchResults.map(node => (
                                <div
                                    key={node.id}
                                    onClick={() => {
                                        onToggleNodeSelection(node.id);
                                        setSearchTerm('');
                                    }}
                                    className="px-3 py-2 text-sm hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-0"
                                >
                                    {node.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected Nodes Chips */}
                {selectedNodeIds.size > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                        {Array.from(selectedNodeIds).map(id => {
                            const node = availableNodes.find(n => n.id === id) || { name: id, id };
                            return (
                                <span key={id} className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                    {node.name}
                                    <button
                                        onClick={() => onToggleNodeSelection(id)}
                                        className="hover:text-black font-bold focus:outline-none"
                                    >×</button>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* View Mode */}
                <div className="mb-4">
                    <label className="text-sm text-gray-300 block mb-2 font-medium">View Mode</label>
                    <div className="flex bg-gray-700 rounded p-1">
                        <button
                            className={`flex-1 text-xs py-1.5 rounded transition-colors ${filters.viewMode === 'groups' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => onFilterChange({ ...filters, viewMode: 'groups' })}
                        >
                            Structural
                        </button>
                        <button
                            className={`flex-1 text-xs py-1.5 rounded transition-colors ${filters.viewMode === 'social' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => onFilterChange({ ...filters, viewMode: 'social' })}
                        >
                            Social
                        </button>
                    </div>
                </div>

                {/* Node Size Slider */}
                <div className="mb-4">
                    <label className="text-sm text-gray-300 block mb-1">
                        Base Node Size: {filters.nodeSize || 5}
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        value={filters.nodeSize || 5}
                        onChange={(e) => onFilterChange({ ...filters, nodeSize: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Size Amplification Slider */}
                <div className="mb-4">
                    <label className="text-sm text-gray-300 block mb-1">
                        Size by Messages: x{filters.sizeAmplification || 1}
                    </label>
                    <input
                        type="range"
                        min="0.1"
                        max="5"
                        step="0.1"
                        value={filters.sizeAmplification || 1}
                        onChange={(e) => onFilterChange({ ...filters, sizeAmplification: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Hide Archived Toggle */}
                <div className="flex items-center justify-between mb-4">
                    <label className="text-sm text-gray-300">Hide Archived</label>
                    <input
                        type="checkbox"
                        checked={filters.hideArchived}
                        onChange={(e) => onFilterChange({ ...filters, hideArchived: e.target.checked })}
                        className="w-4 h-4 rounded"
                    />
                </div>

                {/* Show Labels Toggle */}
                <div className="flex items-center justify-between mb-4">
                    <label className="text-sm text-gray-300">Show All Labels</label>
                    <input
                        type="checkbox"
                        checked={filters.showLabels}
                        onChange={(e) => onFilterChange({ ...filters, showLabels: e.target.checked })}
                        className="w-4 h-4 rounded"
                    />
                </div>



                {/* Show "Me" Node Toggle */}
                <div className="flex items-center justify-between mb-4">
                    <label className="text-sm text-gray-300">Show "Me" Node</label>
                    <input
                        type="checkbox"
                        checked={filters.showMe !== false} // Default to true if undefined
                        onChange={(e) => onFilterChange({ ...filters, showMe: e.target.checked })}
                        className="w-4 h-4 rounded"
                    />
                </div>

                {/* Contacts Only Toggle */}
                <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300">Contacts Only</label>
                    <input
                        type="checkbox"
                        checked={filters.contactsOnly}
                        onChange={(e) => onFilterChange({ ...filters, contactsOnly: e.target.checked })}
                        className="w-4 h-4 rounded"
                    />
                </div>

                {/* Node Types */}
                <div>
                    <label className="text-sm text-gray-300 block mb-2">Show</label>
                    <div className="space-y-1">
                        <label className="flex items-center text-sm">
                            <input
                                type="checkbox"
                                checked={filters.showPeople}
                                onChange={(e) => onFilterChange({ ...filters, showPeople: e.target.checked })}
                                className="mr-2"
                            />
                            People
                        </label>
                        <label className="flex items-center text-sm">
                            <input
                                type="checkbox"
                                checked={filters.showGroups}
                                onChange={(e) => onFilterChange({ ...filters, showGroups: e.target.checked })}
                                className="mr-2"
                            />
                            Groups
                        </label>
                    </div>
                </div>

                {/* Min Connections Slider */}
                <div>
                    <label className="text-sm text-gray-300 block mb-1">
                        Min Connections: {filters.minConnections}
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="20"
                        value={filters.minConnections}
                        onChange={(e) => onFilterChange({ ...filters, minConnections: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Min Messages Slider */}
                <div>
                    <label className="text-sm text-gray-300 block mb-1">
                        Min Messages: {filters.minMessages}
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={filters.minMessages}
                        onChange={(e) => onFilterChange({ ...filters, minMessages: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Physics Controls: Repulsion */}
                <div>
                    <label className="text-sm text-gray-300 block mb-1">
                        Repulsion: {Math.abs(filters.repulsion || 50)}
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="200"
                        step="10"
                        value={Math.abs(filters.repulsion || 50)}
                        onChange={(e) => onFilterChange({ ...filters, repulsion: -parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Physics Controls: Link Distance */}
                <div>
                    <label className="text-sm text-gray-300 block mb-1">
                        Link Distance: {filters.linkDistance || 50}
                    </label>
                    <input
                        type="range"
                        min="10"
                        max="300"
                        step="10"
                        value={filters.linkDistance || 50}
                        onChange={(e) => onFilterChange({ ...filters, linkDistance: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Time Range Filter */}
                <div>
                    <label className="text-sm text-gray-300 block mb-1">Activity Timeframe</label>
                    <select
                        value={filters.timeRange || 'all'}
                        onChange={(e) => onFilterChange({ ...filters, timeRange: e.target.value })}
                        className="w-full bg-gray-700 text-white px-2 py-1.5 rounded text-sm border border-gray-600"
                    >
                        <option value="all">All Time</option>
                        <option value="week">Last Week</option>
                        <option value="month">Last Month</option>
                        <option value="3months">Last 3 Months</option>
                        <option value="year">Last Year</option>
                    </select>
                </div>

                {/* Actions: Save/Load/Reset */}
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-700">

                    {/* Size Mixer */}
                    <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1 text-gray-400">
                            <span>Msg Priority</span>
                            <span>Conn Priority</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={filters.nodeSizeWeight || 50}
                            onChange={(e) => onFilterChange({ ...filters, nodeSizeWeight: parseInt(e.target.value) })}
                            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    {/* Fetch Limit Controls */}
                    <div className="flex gap-2">
                        <select
                            value={filters.fetchLimit || 50}
                            onChange={(e) => onFilterChange({ ...filters, fetchLimit: parseInt(e.target.value) })}
                            className="bg-gray-800 border border-gray-600 rounded px-1 py-1 text-xs flex-1"
                        >
                            <option value="50">Limit: 50</option>
                            <option value="100">Limit: 100</option>
                            <option value="200">Limit: 200</option>
                            <option value="500">Limit: 500</option>
                        </select>
                        <button
                            onClick={() => filters.onReload && filters.onReload(filters.fetchLimit || 50)}
                            className="bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-xs whitespace-nowrap"
                        >
                            ↻ Reload
                        </button>
                    </div>

                    {/* Import/Export/Screenshot */}
                    <div className="flex gap-2 mt-1">
                        <button onClick={filters.onExportData} className="bg-green-800 hover:bg-green-700 px-2 py-1 rounded text-xs flex-1">Export JSON</button>
                        <button onClick={() => document.getElementById('import-json').click()} className="bg-yellow-800 hover:bg-yellow-700 px-2 py-1 rounded text-xs flex-1">Import JSON</button>
                        <input type="file" id="import-json" className="hidden" accept=".json" onChange={filters.onImportData} />
                    </div>
                    <button onClick={filters.onScreenshot} className="bg-purple-800 hover:bg-purple-700 px-2 py-1 rounded text-xs w-full">📸 Screenshot</button>

                    {/* Standard Save/Load Config */}
                    <div className="flex gap-2 mt-2 border-t border-gray-700 pt-2">
                        <button
                            onClick={() => {
                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filters));
                                const downloadAnchorNode = document.createElement('a');
                                downloadAnchorNode.setAttribute("href", dataStr);
                                downloadAnchorNode.setAttribute("download", "graph_config.json");
                                document.body.appendChild(downloadAnchorNode);
                                downloadAnchorNode.click();
                                downloadAnchorNode.remove();
                            }}
                            className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                        >
                            💾 Save Config
                        </button>
                        <label className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors text-center cursor-pointer">
                            📂 Load
                            <input
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        try {
                                            const newFilters = JSON.parse(event.target.result);
                                            onFilterChange({ ...filters, ...newFilters });
                                        } catch (err) {
                                            alert("Invalid config file");
                                        }
                                    };
                                    reader.readAsText(file);
                                }}
                            />
                        </label>
                    </div>

                    <button
                        onClick={() => onFilterChange({
                            contactsOnly: false,
                            hideArchived: false,
                            showLabels: false,
                            showMe: true,
                            showPeople: true,
                            showGroups: true,
                            minConnections: 0,
                            minMessages: 0,
                            timeRange: 'all',
                            sizeAmplification: 1,
                            nodeSize: 5,
                            repulsion: -50,
                            linkDistance: 50,
                            nodeSizeWeight: 50,
                            fetchLimit: 50
                        })}
                        className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                    >
                        Reset Filters
                    </button>

                    {/* Logout */}
                    <button
                        onClick={filters.onLogout}
                        className="w-full mt-4 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-bold shadow-lg transition-transform hover:scale-105"
                    >
                        ⛔ Logout Session
                    </button>
                </div>
            </div>
        </div >
    );
};

export default FilterPanel;
