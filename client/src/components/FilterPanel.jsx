import React from 'react';

const FilterPanel = ({ filters, onFilterChange }) => {
    return (
        <div className="absolute top-4 left-4 bg-gray-800 p-4 rounded-lg shadow-xl max-w-xs bg-opacity-90 backdrop-blur-sm z-10">
            <h2 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">Filters</h2>

            <div className="space-y-4">
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
                        step="5"
                        value={filters.minMessages}
                        onChange={(e) => onFilterChange({ ...filters, minMessages: parseInt(e.target.value) })}
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

                {/* Reset Button */}
                <button
                    onClick={() => onFilterChange({
                        contactsOnly: false,
                        showPeople: true,
                        showGroups: true,
                        minConnections: 0,
                        minMessages: 0,
                        timeRange: 'all'
                    })}
                    className="w-full mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                >
                    Reset Filters
                </button>
            </div>
        </div>
    );
};

export default FilterPanel;
