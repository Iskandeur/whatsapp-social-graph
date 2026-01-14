import React from 'react';

const InsightsPanel = ({ insights }) => {
    const [openSections, setOpenSections] = React.useState({
        topContacts: false,
        bridgePeople: false,
        unexpectedBridges: false, // Default collapsed per user request
        superConnectors: false,
        topGroups: false,
        loneWolves: false
    });

    if (!insights) return null;

    const toggleSection = (key) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const SectionHeader = ({ title, sectionKey, colorClass, icon }) => (
        <div
            onClick={() => toggleSection(sectionKey)}
            className={`flex justify-between items-center cursor-pointer py-2 border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${colorClass}`}
        >
            <h3 className="font-semibold text-sm flex items-center gap-2">
                {icon} {title}
            </h3>
            <span className="text-gray-500 text-xs">{openSections[sectionKey] ? '▼' : '▶'}</span>
        </div>
    );

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-xl w-full bg-opacity-95 backdrop-blur-sm flex flex-col max-h-[60vh]">
            <h2 className="text-lg font-bold mb-3 border-b border-gray-700 pb-2">💡 Insights</h2>

            <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                {/* Top Contacts */}
                {insights.topContacts && insights.topContacts.length > 0 && (
                    <div className="mb-2">
                        <SectionHeader title="Most Active Contacts" sectionKey="topContacts" colorClass="text-blue-400" icon="🔥" />
                        {openSections.topContacts && (
                            <div className="space-y-1 mt-2 pl-2">
                                {insights.topContacts.slice(0, 5).map((contact, idx) => (
                                    <div key={idx} className="flex justify-between text-xs">
                                        <span className="text-gray-300">{idx + 1}. {contact.name}</span>
                                        <span className="text-gray-500">{contact.count} msgs</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Bridge People */}
                {insights.bridgePeople && insights.bridgePeople.length > 0 && (
                    <div className="mb-2">
                        <SectionHeader title="Bridge People" sectionKey="bridgePeople" colorClass="text-purple-400" icon="🌉" />
                        {openSections.bridgePeople && (
                            <div className="space-y-1 mt-2 pl-2">
                                {insights.bridgePeople.slice(0, 5).map((person, idx) => (
                                    <div key={idx} className="flex justify-between text-xs">
                                        <span className="text-gray-300">{person.name}</span>
                                        <span className="text-gray-500">{person.groups} groups</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Unexpected Bridges */}
                {insights.unexpectedBridges && insights.unexpectedBridges.length > 0 && (
                    <div className="mb-2">
                        <SectionHeader title="Unexpected Bridges" sectionKey="unexpectedBridges" colorClass="text-pink-400" icon="🔀" />
                        {openSections.unexpectedBridges && (
                            <div className="space-y-1 mt-2 pl-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {insights.unexpectedBridges.slice(0, 20).map((person, idx) => (
                                    <div key={idx} className="flex flex-col text-xs mb-1 hover:bg-gray-700/30 p-1 rounded">
                                        <span className="text-gray-300 font-medium">{person.name}</span>
                                        <span className="text-gray-500 pl-2 truncate" title={`${person.groupA} & ${person.groupB}`}>
                                            🔗 {person.groupA} & {person.groupB}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Super Connectors */}
                {insights.superConnectors && insights.superConnectors.length > 0 && (
                    <div className="mb-2">
                        <SectionHeader title="Super Connectors" sectionKey="superConnectors" colorClass="text-green-400" icon="⭐" />
                        {openSections.superConnectors && (
                            <div className="space-y-1 mt-2 pl-2">
                                {insights.superConnectors.slice(0, 5).map((person, idx) => (
                                    <div key={idx} className="flex justify-between text-xs">
                                        <span className="text-gray-300">{person.name}</span>
                                        <span className="text-gray-500">{person.connections} connections</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Top Groups */}
                {insights.topGroups && insights.topGroups.length > 0 && (
                    <div className="mb-2">
                        <SectionHeader title="Largest Groups" sectionKey="topGroups" colorClass="text-yellow-400" icon="👥" />
                        {openSections.topGroups && (
                            <div className="space-y-1 mt-2 pl-2">
                                {insights.topGroups.slice(0, 5).map((group, idx) => (
                                    <div key={idx} className="flex justify-between text-xs">
                                        <span className="text-gray-300">{group.name}</span>
                                        <span className="text-gray-500">{group.count} members</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Lone Wolves */}
                {insights.loneWolves && insights.loneWolves.length > 0 && (
                    <div className="mb-2">
                        <SectionHeader title="Lone Wolves" sectionKey="loneWolves" colorClass="text-gray-400" icon="🐺" />
                        {openSections.loneWolves && (
                            <div className="space-y-1 mt-2 pl-2">
                                {insights.loneWolves.slice(0, 3).map((person, idx) => (
                                    <div key={idx} className="text-xs text-gray-300">• {person.name}</div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InsightsPanel;
