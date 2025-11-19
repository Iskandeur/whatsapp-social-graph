async function processData(client) {
    console.log("Starting enhanced data processing...");
    const chats = await client.getChats();
    const contacts = await client.getContacts();

    const nodes = [];
    const links = [];
    const contactMap = new Map();
    const groupMap = new Map();
    const myId = client.info.wid._serialized;

    // Helper to get display name
    const getName = (contact) => contact.name || contact.pushname || contact.number;

    // Track metadata
    const metadata = {
        messagesByContact: {},
        lastActivityByContact: {},
        groupMemberships: {}, // contactId -> [groupIds]
        bridgeScore: {}, // How many different groups a person is in
        totalMessages: 0
    };

    // 1. Process ALL contacts first
    for (const contact of contacts) {
        if (!contact.isGroup && contact.id.server === 'c.us') {
            const cId = contact.id._serialized;
            contactMap.set(cId, {
                id: cId,
                name: getName(contact),
                number: contact.number,
                isMyContact: contact.isMyContact,
                groupCount: 0,
                messageCount: 0,
                connections: 0,
                lastActivity: null
            });
            metadata.groupMemberships[cId] = [];
        }
    }

    // Add "Me" node
    contactMap.set(myId, {
        id: myId,
        name: "Me",
        number: client.info.wid.user,
        isMyContact: true,
        groupCount: 0,
        messageCount: 0,
        connections: 0,
        val: 20
    });
    metadata.groupMemberships[myId] = [];

    // 2. Process Chats to gather metadata
    console.log("Processing chats for metadata...");

    for (const chat of chats) {
        // Fetch recent messages to get counts and timestamps
        const messages = await chat.fetchMessages({ limit: 50 });
        const messageCount = messages.length;
        metadata.totalMessages += messageCount;

        if (chat.isGroup) {
            const groupId = chat.id._serialized;
            const participants = chat.participants;

            // Store group info
            groupMap.set(groupId, {
                id: groupId,
                name: chat.name,
                isGroup: true,
                messageCount: messageCount,
                memberCount: participants.length,
                lastActivity: messages.length > 0 ? messages[0].timestamp * 1000 : null,
                val: Math.min(3 + participants.length * 0.5, 15)
            });

            // Track group memberships and connections
            for (const p of participants) {
                const pId = p.id._serialized;

                // Ensure participant exists in contactMap
                if (!contactMap.has(pId)) {
                    contactMap.set(pId, {
                        id: pId,
                        name: pId.split('@')[0],
                        isMyContact: false,
                        groupCount: 0,
                        messageCount: 0,
                        connections: 0,
                        lastActivity: null
                    });
                    metadata.groupMemberships[pId] = [];
                }

                // Track group membership
                if (!metadata.groupMemberships[pId]) {
                    metadata.groupMemberships[pId] = [];
                }
                metadata.groupMemberships[pId].push(groupId);

                // Increment group count
                const node = contactMap.get(pId);
                node.groupCount++;
            }

        } else {
            // Direct chat
            const partnerId = chat.id._serialized;

            if (contactMap.has(partnerId)) {
                const node = contactMap.get(partnerId);
                node.messageCount = messageCount;
                node.lastActivity = messages.length > 0 ? messages[0].timestamp * 1000 : null;

                metadata.messagesByContact[partnerId] = messageCount;
                metadata.lastActivityByContact[partnerId] = node.lastActivity;
            }
        }
    }

    // 3. Build graph structure
    console.log("Building graph structure...");

    // Add all person nodes
    for (const [key, value] of contactMap) {
        // Calculate connections (number of groups + DM with me)
        value.connections = value.groupCount + (value.messageCount > 0 ? 1 : 0);

        // Calculate bridge score
        metadata.bridgeScore[key] = value.groupCount;

        // Set node size based on activity
        if (!value.val) {
            value.val = Math.min(2 + Math.log(value.messageCount + 1) * 2, 12);
        }

        nodes.push(value);
    }

    // Add group nodes
    for (const [key, value] of groupMap) {
        nodes.push(value);
    }

    // Create links
    for (const chat of chats) {
        if (chat.isGroup) {
            const groupId = chat.id._serialized;
            const participants = chat.participants;

            for (const p of participants) {
                const pId = p.id._serialized;
                links.push({
                    source: pId,
                    target: groupId,
                    value: 1
                });
            }
        } else {
            const partnerId = chat.id._serialized;
            if (contactMap.has(partnerId)) {
                const messageCount = metadata.messagesByContact[partnerId] || 0;
                links.push({
                    source: myId,
                    target: partnerId,
                    value: Math.min(2 + messageCount * 0.01, 10)
                });
            }
        }
    }

    // 4. Compute insights
    console.log("Computing insights...");

    const insights = computeInsights(contactMap, groupMap, metadata, myId);

    console.log(`Processed ${nodes.length} nodes and ${links.length} links.`);

    return {
        graph: { nodes, links },
        stats: {
            totalContacts: contacts.filter(c => !c.isGroup).length,
            totalGroups: groupMap.size,
            totalChats: chats.length,
            totalNodes: nodes.length,
            totalLinks: links.length,
            totalMessages: metadata.totalMessages,
            avgMessagesPerChat: Math.round(metadata.totalMessages / chats.length)
        },
        insights,
        metadata
    };
}

function computeInsights(contactMap, groupMap, metadata, myId) {
    const insights = {
        topContacts: [],
        topGroups: [],
        bridgePeople: [],
        loneWolves: [],
        superConnectors: []
    };

    // Top contacts by message count
    const contactsArray = Array.from(contactMap.values())
        .filter(c => c.id !== myId && !c.isGroup && c.messageCount > 0);

    insights.topContacts = contactsArray
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 10)
        .map(c => ({ name: c.name, count: c.messageCount }));

    // Top groups by member count
    insights.topGroups = Array.from(groupMap.values())
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 10)
        .map(g => ({ name: g.name, count: g.memberCount }));

    // Bridge people (in many groups)
    insights.bridgePeople = Array.from(contactMap.values())
        .filter(c => c.id !== myId && c.groupCount >= 3)
        .sort((a, b) => b.groupCount - a.groupCount)
        .slice(0, 10)
        .map(c => ({ name: c.name, groups: c.groupCount }));

    // Lone wolves (contacts with no groups)
    insights.loneWolves = Array.from(contactMap.values())
        .filter(c => c.id !== myId && c.isMyContact && c.groupCount === 0 && c.messageCount > 0)
        .slice(0, 10)
        .map(c => ({ name: c.name }));

    // Super connectors (high connection count)
    insights.superConnectors = Array.from(contactMap.values())
        .filter(c => c.id !== myId && c.connections >= 3)
        .sort((a, b) => b.connections - a.connections)
        .slice(0, 10)
        .map(c => ({ name: c.name, connections: c.connections }));

    return insights;
}

module.exports = { processData };
