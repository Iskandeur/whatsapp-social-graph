import React from 'react';

const StatsView = ({ stats, filteredCount }) => {
    if (!stats) return null;

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-white w-full bg-opacity-90 backdrop-blur-sm">
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

                {/* Data Fetching Info */}
                {stats.dataLimits && (
                    <div className="border-t border-gray-700 pt-3 mt-3">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Data Scope</h3>
                        <div className="space-y-1 text-xs text-gray-400">
                            <div className="flex justify-between">
                                <span>Max Msgs/Chat:</span>
                                <span>{stats.dataLimits.maxMessagesPerChat}</span>
                            </div>
                            {stats.dataLimits.oldestMessageDate && (
                                <div className="flex justify-between">
                                    <span>Earliest Msg:</span>
                                    <span>{new Date(stats.dataLimits.oldestMessageDate).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsView;
