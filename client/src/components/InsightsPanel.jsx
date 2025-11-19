import React from 'react';

const InsightsPanel = ({ insights }) => {
    if (!insights) return null;

    return (
        <div className="absolute bottom-4 left-4 bg-gray-800 p-4 rounded-lg shadow-xl max-w-sm bg-opacity-95 backdrop-blur-sm z-50 max-h-96 overflow-y-auto">
            <h2 className="text-lg font-bold mb-3 border-b border-gray-700 pb-2">💡 Insights</h2>

            <div className="space-y-4 text-sm">
                {/* Top Contacts */}
                {insights.topContacts && insights.topContacts.length > 0 && (
                    <div>
                        <h3 className="font-semibold text-blue-400 mb-2">🔥 Most Active Contacts</h3>
                        <div className="space-y-1">
                            {insights.topContacts.slice(0, 5).map((contact, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-gray-300">{idx + 1}. {contact.name}</span>
                                    <span className="text-gray-500">{contact.count} msgs</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bridge People */}
                {insights.bridgePeople && insights.bridgePeople.length > 0 && (
                    <div>
                        <h3 className="font-semibold text-purple-400 mb-2">🌉 Bridge People</h3>
                        <div className="space-y-1">
                            {insights.bridgePeople.slice(0, 5).map((person, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-gray-300">{person.name}</span>
                                    <span className="text-gray-500">{person.groups} groups</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Super Connectors */}
                {insights.superConnectors && insights.superConnectors.length > 0 && (
                    <div>
                        <h3 className="font-semibold text-green-400 mb-2">⭐ Super Connectors</h3>
                        <div className="space-y-1">
                            {insights.superConnectors.slice(0, 5).map((person, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-gray-300">{person.name}</span>
                                    <span className="text-gray-500">{person.connections} connections</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Groups */}
                {insights.topGroups && insights.topGroups.length > 0 && (
                    <div>
                        <h3 className="font-semibold text-yellow-400 mb-2">👥 Largest Groups</h3>
                        <div className="space-y-1">
                            {insights.topGroups.slice(0, 5).map((group, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-gray-300">{group.name}</span>
                                    <span className="text-gray-500">{group.count} members</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Lone Wolves */}
                {insights.loneWolves && insights.loneWolves.length > 0 && (
                    <div>
                        <h3 className="font-semibold text-gray-400 mb-2">🐺 Lone Wolves</h3>
                        <p className="text-xs text-gray-500 mb-1">Contacts not in any groups</p>
                        <div className="space-y-1">
                            {insights.loneWolves.slice(0, 3).map((person, idx) => (
                                <div key={idx} className="text-xs text-gray-300">• {person.name}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InsightsPanel;
