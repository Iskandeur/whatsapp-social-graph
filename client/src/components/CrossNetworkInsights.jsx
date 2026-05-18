import React from 'react';

const SectionHeader = ({ title, sectionKey, colorClass, icon, count, isOpen, onToggle }) => (
    <div
        onClick={() => onToggle(sectionKey)}
        className={`flex justify-between items-center cursor-pointer py-2 border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${colorClass}`}
    >
        <h3 className="font-semibold text-sm flex items-center gap-2">
            {icon} {title}
        </h3>
        <span className="text-gray-500 text-xs">
            {count > 0 ? `${count} ` : ''}
            {isOpen ? '▼' : '▶'}
        </span>
    </div>
);

const Row = ({ id, label, meta, onFocusNode }) => {
    const clickable = id && onFocusNode;
    return (
        <div
            className={`flex justify-between text-xs gap-2 ${clickable ? 'cursor-pointer hover:bg-gray-700/30 rounded px-1' : ''}`}
            onClick={clickable ? () => onFocusNode(id) : undefined}
            title={clickable ? 'Click to find on graph' : undefined}
        >
            <span className="text-gray-300 truncate">{label}</span>
            {meta != null && <span className="text-gray-500 whitespace-nowrap">{meta}</span>}
        </div>
    );
};

// Cross-network "tools" shown while comparing two merged networks.
// Replaces InsightsPanel in compare mode.
const CrossNetworkInsights = ({ insights, onFocusNode }) => {
    const [openSections, setOpenSections] = React.useState({
        mutualContacts: true,
        theyIntroduceYou: false,
        youIntroduceThem: false,
        sharedGroups: false,
        bridgePeople: false,
        superConnectors: false,
        unexpectedBridges: false,
    });

    if (!insights) return null;

    const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

    const { overlap = {}, yourName, theirName } = insights;
    const pct = Math.round((overlap.jaccard || 0) * 100);

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-xl w-full bg-opacity-95 backdrop-blur-sm flex flex-col max-h-[60vh]">
            <h2 className="text-lg font-bold mb-1 border-b border-gray-700 pb-2">🔀 Network Comparison</h2>
            <p className="text-xs text-gray-500 mb-2 truncate">
                <span className="text-red-400">{yourName || 'You'}</span>
                <span className="mx-1">×</span>
                <span className="text-cyan-400">{theirName || 'Them'}</span>
            </p>

            {/* Overlap summary — always visible */}
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="bg-gray-900/60 rounded p-2">
                    <div className="text-lg font-bold" style={{ color: '#fbbf24' }}>
                        {overlap.sharedPeople ?? 0}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Mutual</div>
                </div>
                <div className="bg-gray-900/60 rounded p-2">
                    <div className="text-lg font-bold text-blue-400">{overlap.combinedReach ?? 0}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Combined</div>
                </div>
                <div className="bg-gray-900/60 rounded p-2">
                    <div className="text-lg font-bold text-green-400">{pct}%</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Overlap</div>
                </div>
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-2 px-1">
                <span>{yourName || 'You'}: {overlap.yoursPeople ?? 0} people</span>
                <span>{theirName || 'Them'}: {overlap.theirsPeople ?? 0} people</span>
            </div>

            <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                {/* Mutual Contacts */}
                <div className="mb-2">
                    <SectionHeader
                        title="Mutual Contacts"
                        sectionKey="mutualContacts"
                        colorClass="text-yellow-300"
                        icon="🤝"
                        count={insights.mutualContacts?.length || 0}
                        isOpen={openSections.mutualContacts}
                        onToggle={toggleSection}
                    />
                    {openSections.mutualContacts && (
                        <div className="space-y-1 mt-2 pl-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {(insights.mutualContacts || []).length === 0 && (
                                <div className="text-xs text-gray-500 italic">No contacts in common.</div>
                            )}
                            {(insights.mutualContacts || []).map((c) => (
                                <Row
                                    key={c.id}
                                    id={c.id}
                                    label={c.name}
                                    meta={`${c.msgA}+${c.msgB} msgs`}
                                    onFocusNode={onFocusNode}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* They Can Introduce You */}
                <div className="mb-2">
                    <SectionHeader
                        title="They Can Introduce You"
                        sectionKey="theyIntroduceYou"
                        colorClass="text-cyan-400"
                        icon="📥"
                        count={insights.theyIntroduceYou?.length || 0}
                        isOpen={openSections.theyIntroduceYou}
                        onToggle={toggleSection}
                    />
                    {openSections.theyIntroduceYou && (
                        <div className="space-y-1 mt-2 pl-2">
                            {(insights.theyIntroduceYou || []).map((c) => (
                                <Row
                                    key={c.id}
                                    id={c.id}
                                    label={c.name}
                                    meta={`${c.messageCount} msgs`}
                                    onFocusNode={onFocusNode}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* You Can Introduce Them */}
                <div className="mb-2">
                    <SectionHeader
                        title="You Can Introduce Them"
                        sectionKey="youIntroduceThem"
                        colorClass="text-blue-400"
                        icon="📤"
                        count={insights.youIntroduceThem?.length || 0}
                        isOpen={openSections.youIntroduceThem}
                        onToggle={toggleSection}
                    />
                    {openSections.youIntroduceThem && (
                        <div className="space-y-1 mt-2 pl-2">
                            {(insights.youIntroduceThem || []).map((c) => (
                                <Row
                                    key={c.id}
                                    id={c.id}
                                    label={c.name}
                                    meta={`${c.messageCount} msgs`}
                                    onFocusNode={onFocusNode}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Shared Groups */}
                <div className="mb-2">
                    <SectionHeader
                        title="Shared Groups"
                        sectionKey="sharedGroups"
                        colorClass="text-purple-400"
                        icon="👥"
                        count={insights.sharedGroups?.length || 0}
                        isOpen={openSections.sharedGroups}
                        onToggle={toggleSection}
                    />
                    {openSections.sharedGroups && (
                        <div className="space-y-1 mt-2 pl-2">
                            {(insights.sharedGroups || []).length === 0 && (
                                <div className="text-xs text-gray-500 italic">No groups in common.</div>
                            )}
                            {(insights.sharedGroups || []).map((g) => (
                                <Row
                                    key={g.id}
                                    id={g.id}
                                    label={g.name}
                                    meta={`${g.memberCount} members`}
                                    onFocusNode={onFocusNode}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Bridge People */}
                {insights.bridgePeople && insights.bridgePeople.length > 0 && (
                    <div className="mb-2">
                        <SectionHeader
                            title="Bridge People"
                            sectionKey="bridgePeople"
                            colorClass="text-pink-300"
                            icon="🌉"
                            count={insights.bridgePeople.length}
                            isOpen={openSections.bridgePeople}
                            onToggle={toggleSection}
                        />
                        {openSections.bridgePeople && (
                            <div className="space-y-1 mt-2 pl-2">
                                {insights.bridgePeople.map((p, idx) => (
                                    <Row key={idx} label={p.name} meta={`${p.groups} groups`} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Super Connectors */}
                {insights.superConnectors && insights.superConnectors.length > 0 && (
                    <div className="mb-2">
                        <SectionHeader
                            title="Super Connectors"
                            sectionKey="superConnectors"
                            colorClass="text-green-400"
                            icon="⭐"
                            count={insights.superConnectors.length}
                            isOpen={openSections.superConnectors}
                            onToggle={toggleSection}
                        />
                        {openSections.superConnectors && (
                            <div className="space-y-1 mt-2 pl-2">
                                {insights.superConnectors.map((p, idx) => (
                                    <Row key={idx} label={p.name} meta={`${p.connections} connections`} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Unexpected Bridges */}
                {insights.unexpectedBridges && insights.unexpectedBridges.length > 0 && (
                    <div className="mb-2">
                        <SectionHeader
                            title="Unexpected Bridges"
                            sectionKey="unexpectedBridges"
                            colorClass="text-pink-400"
                            icon="🔀"
                            count={insights.unexpectedBridges.length}
                            isOpen={openSections.unexpectedBridges}
                            onToggle={toggleSection}
                        />
                        {openSections.unexpectedBridges && (
                            <div className="space-y-1 mt-2 pl-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {insights.unexpectedBridges.map((p, idx) => (
                                    <div key={idx} className="flex flex-col text-xs mb-1 hover:bg-gray-700/30 p-1 rounded">
                                        <span className="text-gray-300 font-medium">{p.name}</span>
                                        <span
                                            className="text-gray-500 pl-2 truncate"
                                            title={`${p.groupA} & ${p.groupB}`}
                                        >
                                            🔗 {p.groupA} & {p.groupB}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CrossNetworkInsights;
