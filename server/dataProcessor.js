async function processData(wahaClient, onProgress = () => { }, maxMessages = 50) {
    console.log("Starting enhanced data processing with Waha...");
    onProgress({ current: 0, total: 100, message: "Fetching contacts and chats..." });

    // Helper for timeout
    const withTimeout = (promise, ms, name) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout fetching ${name}`)), ms))
        ]);
    };

    let chats = [];
    let contacts = [];
    let myInfo = null;

    try {
        // Fetch contacts (handle 500 error from Waha bug)
        console.log("Fetching contacts...");
        onProgress({ current: 2, total: 100, message: "Fetching contacts..." });
        try {
            contacts = await withTimeout(wahaClient.getContacts(), 300000, "contacts");
        } catch (error) {
            console.error('Error fetching contacts (skipping):', error.message);
            console.log('Will fall back to chat metadata for contact names.');
            // Non-fatal, proceed with empty contacts
            contacts = [];
        }
        console.log(`Fetched ${contacts.length} contacts`);

        console.log("Fetching chats...");
        onProgress({ current: 4, total: 100, message: "Fetching chats..." });
        chats = await withTimeout(wahaClient.getChats(), 300000, "chats");
        console.log(`Fetched ${chats.length} chats`);

        myInfo = await wahaClient.getMe();

    } catch (err) {
        console.error("Critical error fetching initial data:", err);
        onProgress({ current: 0, total: 100, message: `Error: ${err.message}. Please check Waha status.` });
        throw err;
    }

    onProgress({ current: 5, total: 100, message: `Found ${chats.length} chats and ${contacts.length} contacts` });

    const nodes = [];
    const links = [];
    const contactMap = new Map();
    const groupMap = new Map();
    const myId = myInfo ? (myInfo.id._serialized || myInfo.id) : 'me';
    // fallback if myInfo fails, though it shouldn't if auth is good

    // Helper to get display name
    const getName = (contact) => contact.name || contact.pushname || contact.number || "Unknown";

    // Track metadata
    const metadata = {
        messagesByContact: {},
        lastActivityByContact: {},
        lastActivityByContact: {},
        groupMemberships: {},
        bridgeScore: {},
        totalMessages: 0,
        oldestTimestamp: Date.now()
    };

    // 1. Process ALL contacts first
    for (const contact of contacts) {
        // Waha might return id as object or string depending on version, handle both
        const cId = contact.id._serialized || contact.id;
        const isGroup = contact.isGroup || cId.includes('@g.us');

        if (!isGroup && cId.includes('@c.us')) {
            contactMap.set(cId, {
                id: cId,
                name: getName(contact),
                number: contact.number || cId.split('@')[0],
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
        number: myId.split('@')[0],
        isMyContact: true,
        isMe: true, // Mark as Me for special styling
        groupCount: 0,
        messageCount: 0,
        connections: 0,
        val: 20
    });
    metadata.groupMemberships[myId] = [];

    // 2. Process Chats to gather metadata
    console.log("Processing chats for metadata...");

    const BATCH_SIZE = 5;
    const totalChats = chats.length;
    let processedChats = 0;

    // Helper to fetch messages with timeout via API
    const fetchMessagesWithTimeout = async (chatId, limit = 100, timeoutFn = 10000) => {
        return Promise.race([
            wahaClient.getMessages(chatId, limit),
            new Promise((resolve) => setTimeout(() => resolve([]), timeoutFn))
        ]);
    };

    for (let i = 0; i < totalChats; i += BATCH_SIZE) {
        const batch = chats.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (chat) => {
            try {
                const chatId = chat.id._serialized || chat.id;
                const messages = await fetchMessagesWithTimeout(chatId, 100);
                const messageCount = messages.length;
                metadata.totalMessages += messageCount;

                if (messageCount > 0) {
                    const lastMsg = messages[messageCount - 1]; // Messages usually ordered new -> old? No, usually old -> new in array?
                    // Waha getMessages usually returns newest last?
                    // Actually, let's just check the timestamp of the "oldest" fetched message.
                    // If limit=50, we get 50 most recent. The oldest of these is at index 0 or length-1 depending on order.
                    // Waha/Whatsapp-web.js typically returns [oldest ... newest].
                    // So index 0 is the oldest of the batch.
                    const oldestInBatch = messages.reduce((min, m) => Math.min(min, m.timestamp * 1000), Date.now());
                    if (oldestInBatch < metadata.oldestTimestamp) {
                        metadata.oldestTimestamp = oldestInBatch;
                    }
                }

                const isGroup = chat.isGroup || chatId.includes('@g.us');

                if (isGroup) {
                    // Waha structure can vary
                    let participants = chat.participants || [];
                    if (participants.length === 0 && chat.groupMetadata && chat.groupMetadata.participants) {
                        participants = chat.groupMetadata.participants;
                    }

                    // Store group info
                    groupMap.set(chatId, {
                        id: chatId,
                        name: chat.name || "Unknown Group",
                        isGroup: true,
                        isArchived: chat.archived || chat.archive || false,
                        messageCount: messageCount,
                        memberCount: participants.length,
                        lastActivity: messages.length > 0 ? messages[0].timestamp * 1000 : null,
                        val: Math.min(3 + participants.length * 0.5, 15)
                    });

                    // Track group memberships and connections
                    for (const p of participants) {
                        const pId = p.id._serialized || p.id;

                        // Ensure participant exists in contactMap
                        if (!contactMap.has(pId)) {
                            // Create temporary contact node if not in contacts list (common in groups)
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

                        if (!metadata.groupMemberships[pId]) {
                            metadata.groupMemberships[pId] = [];
                        }
                        metadata.groupMemberships[pId].push(chatId);

                        const node = contactMap.get(pId);
                        node.groupCount++;
                    }

                } else {
                    // Direct chat
                    // Always try to update info from direct chat, as it's more reliable than group participant list
                    const directName = chat.name || chat.pushname || chatId.split('@')[0];
                    const isMyContact = true; // By definition, if I have a direct chat, they are somewhat a contact

                    if (!contactMap.has(chatId)) {
                        // Create contact from chat info if missing
                        contactMap.set(chatId, {
                            id: chatId,
                            name: directName,
                            number: chatId.split('@')[0],
                            isMyContact: isMyContact,
                            groupCount: 0,
                            messageCount: 0,
                            connections: 0,
                            lastActivity: null
                        });
                        metadata.groupMemberships[chatId] = [];
                    } else {
                        // MERGE: Update existing node (likely created from group) with better info
                        const node = contactMap.get(chatId);
                        // Only overwrite name if we have a better one (not just a number)
                        if (directName !== chatId.split('@')[0]) {
                            node.name = directName;
                        }
                        node.isMyContact = isMyContact;
                    }

                    if (contactMap.has(chatId)) {
                        const node = contactMap.get(chatId);
                        node.messageCount = messageCount;
                        node.lastActivity = messages.length > 0 ? messages[0].timestamp * 1000 : null;

                        metadata.messagesByContact[chatId] = messageCount;
                        metadata.lastActivityByContact[chatId] = node.lastActivity;
                    }
                }
            } catch (error) {
                console.error(`Error processing chat ${chat.name}:`, error);
            }
        }));

        processedChats += batch.length;
        const percent = 5 + Math.round((processedChats / totalChats) * 85);
        onProgress({
            current: percent,
            total: 100,
            message: `Processing chats... ${processedChats}/${totalChats}`
        });
    }

    // 3. Build graph structure
    console.log("Building graph structure...");
    onProgress({ current: 90, total: 100, message: "Building social graph..." });

    for (const [key, value] of contactMap) {
        value.connections = value.groupCount + (value.messageCount > 0 ? 1 : 0);
        metadata.bridgeScore[key] = value.groupCount;
        if (!value.val) {
            value.val = Math.min(2 + Math.log(value.messageCount + 1) * 2, 12);
        }
        nodes.push(value);
    }

    for (const [key, value] of groupMap) {
        nodes.push(value);
    }

    // Create links
    // Create links
    const coMemberWeights = new Map(); // Key: "idA-idB" (sorted), Value: count

    for (const chat of chats) {
        const chatId = chat.id._serialized || chat.id;
        const isGroup = chat.isGroup || chatId.includes('@g.us');

        if (isGroup) {
            // Waha structure can vary. Check direct participants or groupMetadata
            let participants = chat.participants || [];
            if (participants.length === 0 && chat.groupMetadata && chat.groupMetadata.participants) {
                participants = chat.groupMetadata.participants;
            }

            // 1. MEMBERSHIP Links (Person -> Group)
            for (const p of participants) {
                const pId = p.id._serialized || p.id;
                links.push({
                    source: pId,
                    target: chatId,
                    value: 1,
                    type: 'MEMBERSHIP'
                });
            }

            // 2. CO_MEMBER Links (Person -> Person)
            // Skip for very large groups to avoid hairball
            if (participants.length > 1 && participants.length <= 100) {
                for (let i = 0; i < participants.length; i++) {
                    for (let j = i + 1; j < participants.length; j++) {
                        const p1 = participants[i].id._serialized || participants[i].id;
                        const p2 = participants[j].id._serialized || participants[j].id;

                        // Skip if one of them is "Me" (handled by DIRECT/MEMBERSHIP usually, but social graph often excludes Me-Groups links as "social" implies peer-to-peer)
                        // Actually, keep Me in for now, or maybe exclude? User wants "connections between people".
                        // Let's include everyone.

                        // Sort IDs to ensure consistent key
                        const [a, b] = [p1, p2].sort();
                        const key = `${a}|${b}`;
                        coMemberWeights.set(key, (coMemberWeights.get(key) || 0) + 1);
                    }
                }
            }
        } else {
            // DIRECT Links (Me -> Person)
            if (contactMap.has(chatId)) {
                const messageCount = metadata.messagesByContact[chatId] || 0;
                links.push({
                    source: myId,
                    target: chatId,
                    value: Math.min(2 + messageCount * 0.01, 10),
                    type: 'DIRECT'
                });
            }
        }
    }

    // Add averaged CO_MEMBER links
    for (const [key, weight] of coMemberWeights) {
        const [source, target] = key.split('|');
        // Only add if both nodes exist in our graph
        if (contactMap.has(source) && contactMap.has(target)) {
            links.push({
                source,
                target,
                value: weight, // Weight = number of shared groups
                type: 'CO_MEMBER'
            });
        }
    }

    // 4. Compute insights
    console.log("Computing insights...");
    onProgress({ current: 95, total: 100, message: "Computing insights..." });

    const insights = computeInsights(contactMap, groupMap, metadata, myId);

    console.log(`Processed ${nodes.length} nodes and ${links.length} links.`);
    onProgress({ current: 100, total: 100, message: "Done!" });

    return {
        graph: { nodes, links },
        stats: {
            totalContacts: contacts.filter(c => !(c.isGroup || (c.id._serialized || c.id).includes('@g.us'))).length,
            totalGroups: groupMap.size,
            totalChats: chats.length,
            totalNodes: nodes.length,
            totalLinks: links.length,
            totalMessages: metadata.totalMessages,
            avgMessagesPerChat: chats.length > 0 ? Math.round(metadata.totalMessages / chats.length) : 0,
            dataLimits: {
                maxMessagesPerChat: maxMessages,
                fetchedCount: metadata.totalMessages,
                oldestMessageDate: metadata.oldestTimestamp
            }
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
