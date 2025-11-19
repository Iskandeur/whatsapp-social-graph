import React from 'react';

const StatsView = ({ stats, filteredCount }) => {
    if (!stats) return null;

    return (
        <div className="absolute top-4 right-4 bg-gray-800 p-6 rounded-lg shadow-xl text-white max-w-xs bg-opacity-90 backdrop-blur-sm">
            <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">📊 Statistics</h2>
            <div className="space-y-3 text-sm">
                {filteredCount !== undefined && filteredCount < stats.totalNodes && (
                    <div className="bg-blue-900 bg-opacity-50 p-2 rounded mb-3">
                        <div className="flex justify-between">
                            <span className="text-blue-300">Showing:</span>
                            <span className="font-mono">{filteredCount} / {stats.totalNodes}</span>
                        </div>
                    </div>
                )}

                <div className="flex justify-between">
                    <span className="text-gray-400">Total Contacts:</span>
                    <span className="font-mono font-semibold">{stats.totalContacts}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Total Groups:</span>
                    <span className="font-mono font-semibold">{stats.totalGroups}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Total Chats:</span>
                    <span className="font-mono font-semibold">{stats.totalChats}</span>
                </div>

                <div className="border-t border-gray-700 pt-3 space-y-3">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Graph Nodes:</span>
                        <span className="font-mono">{stats.totalNodes}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Graph Links:</span>
                        <span className="font-mono">{stats.totalLinks}</span>
                    </div>
                </div>

                {stats.totalMessages > 0 && (
                    <div className="border-t border-gray-700 pt-3 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Total Messages:</span>
                            <span className="font-mono">{stats.totalMessages.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Avg/Chat:</span>
                            <span className="font-mono">{stats.avgMessagesPerChat}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsView;
