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

    // NEW: Map to store Pushnames extracted from messages
    // Key: User ID (normalized), Value: notifyName (e.g. "Flo")
    const pushNameMap = new Map();

    // Normalize ID to remove device suffix (e.g. :0) and standardise on c.us (handle lid)
    const normalizeId = (id) => {
        if (!id) return id;
        let nid = id.replace(/:\d+@/g, '@');
        // Convert lid to c.us to avoid fragmentation and ensure matching
        if (nid.endsWith('@lid')) {
            nid = nid.replace('@lid', '@c.us');
        }
        return nid;
    };

    const myId = myInfo ? normalizeId(myInfo.id._serialized || myInfo.id) : 'me';
    // Robust Me detection: Extract phone number (e.g., from '33612345678@c.us' get '33612345678')
    const myNumber = myId.split('@')[0];

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

    // 1. Process contacts if available (often empty due to 500 error)
    for (const contact of contacts) {
        const rawId = contact.id._serialized || contact.id;
        const cId = normalizeId(rawId);
        const isGroup = contact.isGroup || cId.includes('@g.us');

        if (!isGroup && cId.includes('@c.us')) {
            const number = contact.number || cId.split('@')[0];
            const displayName = contact.name || number;

            contactMap.set(cId, {
                id: cId,
                name: displayName,
                number: number,
                isMyContact: !!contact.isMyContact,
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
        isMe: true,
        groupCount: 0,
        messageCount: 0,
        connections: 0,
        val: 20
    });
    metadata.groupMemberships[myId] = [];

    // 2. Process Chats to gather metadata and perform TRUE contact classification
    console.log("Processing chats for metadata...");

    const BATCH_SIZE = 5;
    const totalChats = chats.length;
    let processedChats = 0;

    // Helper to fetch messages with timeout
    const fetchMessagesWithTimeout = async (chatId, limit = 100, timeoutFn = 10000) => {
        return Promise.race([
            wahaClient.getMessages(chatId, limit),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout fetching messages")), timeoutFn))
        ]);
    };

    for (let i = 0; i < totalChats; i += BATCH_SIZE) {
        const batch = chats.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (chat) => {
            try {
                const rawChatId = chat.id._serialized || chat.id;
                const chatId = normalizeId(rawChatId);

                // Fetch messages
                let messages = [];
                let attempts = 0;
                const maxAttempts = 3;

                while (attempts < maxAttempts) {
                    try {
                        messages = await fetchMessagesWithTimeout(chatId, 50);
                        if (messages.length > 0) break;
                        break;
                    } catch (msgErr) {
                        console.warn(`Failed to fetch messages for ${chatId} (Attempt ${attempts + 1}/${maxAttempts})`);
                        attempts++;
                        if (attempts < maxAttempts) {
                            await new Promise(r => setTimeout(r, 1000 * attempts));
                        } else {
                            console.warn(`Give up fetching messages for ${chatId}, proceeding with metadata only.`);
                        }
                    }
                }

                const messageCount = messages.length;
                metadata.totalMessages += messageCount;

                if (messageCount > 0) {
                    const oldestInBatch = messages.reduce((min, m) => Math.min(min, m.timestamp * 1000), Date.now());
                    if (oldestInBatch < metadata.oldestTimestamp) {
                        metadata.oldestTimestamp = oldestInBatch;
                    }

                    // --- NEW: HARVEST PUSHNAMES ---
                    // Scan messages for 'notifyName' (Pushname)
                    messages.forEach(msg => {
                        // Fix for undefined author: check participant and from as well
                        // Normalize LID to c.us to ensure matching
                        const senderId = normalizeId(msg.author || msg.participant || msg.from);

                        // Make sure we have a valid ID and the notifyName property
                        if (senderId && msg._data && msg._data.notifyName) {
                            // Only update if we don't have it yet
                            // (We assume the first found one is valid enough)
                            if (!pushNameMap.has(senderId)) {
                                pushNameMap.set(senderId, msg._data.notifyName);
                            }
                        }
                    });
                }

                const isGroup = chat.isGroup || chatId.includes('@g.us');

                if (isGroup) {
                    let participants = chat.participants || [];
                    if (participants.length === 0 && chat.groupMetadata && chat.groupMetadata.participants) {
                        participants = chat.groupMetadata.participants;
                    }

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

                    // Track group memberships
                    for (const p of participants) {
                        const pId = normalizeId(p.id._serialized || p.id);

                        if (!contactMap.has(pId)) {
                            contactMap.set(pId, {
                                id: pId,
                                name: pId.split('@')[0],
                                isMyContact: false,
                                groupCount: 0,
                                messageCount: 0,
                                connections: 0,
                                lastActivity: null,
                                groups: new Set() // Initialize for Insights
                            });
                            metadata.groupMemberships[pId] = [];
                        } else {
                            // Ensure existing contact has groups Set
                            const contact = contactMap.get(pId);
                            if (!contact.groups) contact.groups = new Set();
                        }

                        if (!metadata.groupMemberships[pId]) {
                            metadata.groupMemberships[pId] = [];
                        }
                        metadata.groupMemberships[pId].push(chatId);

                        const node = contactMap.get(pId);
                        node.groupCount++;
                        node.groups.add(chatId); // Add for Insights
                    }

                } else {
                    // --- DIRECT CHAT LOGIC START ---
                    // This is the source of truth for contact names and status.
                    // Waha chat.name contains either the Saved Name OR the Formatted Phone Number.

                    const chatNumber = chatId.split('@')[0];
                    const rawName = chat.name || chatNumber;

                    // Determine if it's a real name or just a formatted number
                    // We strip all non-digit characters from both and compare.
                    // If they are identical (e.g. "Nathan" vs "336..." => different => Real Name)
                    // If they are identical (e.g. "+33 6..." vs "336..." => same => Just Number)

                    const digitsInName = rawName.replace(/[^0-9]/g, '');
                    const digitsInId = chatNumber.replace(/[^0-9]/g, '');

                    // Logic: It is a contact if the name contains meaningful text that isn't just the number
                    const isJustFormattedNumber = digitsInName === digitsInId;
                    const isMyContact = !isJustFormattedNumber;

                    // Handle "Me"
                    const isMeNode = chatNumber === myNumber;

                    // Name to display use raw name initially
                    const displayName = rawName;

                    if (!contactMap.has(chatId)) {
                        contactMap.set(chatId, {
                            id: chatId,
                            name: displayName,
                            number: chatNumber,
                            isMyContact: isMyContact || isMeNode,
                            groupCount: 0,
                            messageCount: 0,
                            connections: 0,
                            lastActivity: null
                        });
                        metadata.groupMemberships[chatId] = [];
                    } else {
                        // Merge/Update existing node (e.g. found via group first)
                        const node = contactMap.get(chatId);
                        node.name = displayName;
                        if (isMyContact || isMeNode) {
                            node.isMyContact = true;
                        }
                    }
                    // --- DIRECT CHAT LOGIC END ---

                    // DEBUG: Specific logging for problem contacts
                    if (chatId.includes('33669775442') || chatId.includes('33665181747')) {
                        console.log(`[DEBUG TARGET] DirectChat ${chatId}: name='${chat.name}', rawName='${rawName}', isMyContact=${isMyContact}, FinalName='${contactMap.get(chatId).name}'`);
                    }
                }

                if (contactMap.has(chatId)) {
                    const node = contactMap.get(chatId);
                    node.messageCount = messageCount;
                    node.lastActivity = messages.length > 0 ? messages[0].timestamp * 1000 : null;

                    metadata.messagesByContact[chatId] = messageCount;
                    metadata.lastActivityByContact[chatId] = node.lastActivity;
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
            message: `Processing ${processedChats} of ${totalChats} chats found...`
        });
    }

    // 3. Build graph structure (AND APPLY PUSHNAMES)
    console.log("Building graph structure...");
    onProgress({ current: 90, total: 100, message: "Building social graph..." });

    for (const [key, value] of contactMap) {
        // --- APPLY PUSHNAME TO BLUE NODES ---
        // If node is "Blue" (not a contact) AND we found a real Pushname
        if (!value.isMyContact && !value.isMe && pushNameMap.has(key)) {
            // Only update if current name is just a number (or formatted number)
            // (Double check to keep user choices if any)
            const currentNameDigits = value.name.replace(/[^0-9]/g, '');
            const idDigits = key.split('@')[0].replace(/[^0-9]/g, '');

            // If the current name is basically just the phone number...
            if (currentNameDigits === idDigits) {
                const pushName = pushNameMap.get(key);
                if (pushName) {
                    // Update the name to the Pushname!
                    value.name = pushName;
                    // console.log(`[Pushname Fix] Updated Blue Node ${key} name to "${pushName}"`);
                }
            }
        }
        // ------------------------------------

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
    const coMemberWeights = new Map(); // Key: "idA-idB" (sorted), Value: count

    for (const chat of chats) {
        const chatId = normalizeId(chat.id._serialized || chat.id);
        const isGroup = chat.isGroup || chatId.includes('@g.us');

        if (isGroup) {
            let participants = chat.participants || [];
            if (participants.length === 0 && chat.groupMetadata && chat.groupMetadata.participants) {
                participants = chat.groupMetadata.participants;
            }

            // 1. MEMBERSHIP Links (Person -> Group)
            for (const p of participants) {
                const pId = normalizeId(p.id._serialized || p.id);
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
                        const p1 = normalizeId(participants[i].id._serialized || participants[i].id);
                        const p2 = normalizeId(participants[j].id._serialized || participants[j].id);

                        if (p1 === p2) continue;

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
        if (contactMap.has(source) && contactMap.has(target)) {
            links.push({
                source,
                target,
                value: weight,
                type: 'CO_MEMBER'
            });
        }
    }

    // Force "Me" Label at the end to ensure it's correct
    if (contactMap.has(myId)) {
        const meNode = contactMap.get(myId);
        meNode.name = "Me";
        meNode.isMe = true;
        meNode.isMyContact = true;
    }

    // 4. --- FILTER DISCONNECTED NODES ---
    // User reported "hairball" with 27k nodes. Many are likely contacts with no chat history.
    // We only keep nodes that have connections (links) or are "Me".
    const activeNodes = nodes.filter(n => n.isMe || n.connections > 0 || n.groupCount > 0 || n.messageCount > 0);
    console.log(`Filtered ${nodes.length} total nodes down to ${activeNodes.length} active nodes.`);

    // 5. --- ENHANCED: ENRICH BLUE NODES ---
    // Fetch profiles for nodes that are still just numbers
    // ONLY enrich nodes that are active!
    const blueNodes = activeNodes.filter(n => !n.isMyContact && !n.isMe && !n.isGroup && !n.name.match(/[a-zA-Z]/));

    if (blueNodes.length > 0) {
        console.log(`Enriching ${blueNodes.length} Blue Nodes...`);
        onProgress({ current: 92, total: 100, message: `Enriching ${blueNodes.length} unknown contacts...` });

        const ENRICH_BATCH_SIZE = 10;
        let enrichedCount = 0;

        for (let i = 0; i < blueNodes.length; i += ENRICH_BATCH_SIZE) {
            const batch = blueNodes.slice(i, i + ENRICH_BATCH_SIZE);

            await Promise.all(batch.map(async (node) => {
                try {
                    // console.log(`Fetching profile for ${node.id}...`);
                    const contact = await wahaClient.getContact(node.id);
                    // Check if we got a real name (pushname or name)
                    const newName = contact.pushname || contact.name;

                    if (newName) {
                        // Validate it's not just the number again
                        const newDigits = newName.replace(/[^0-9]/g, '');
                        const idDigits = node.id.split('@')[0].replace(/[^0-9]/g, '');

                        if (newDigits !== idDigits) {
                            node.name = newName;

                            // FIX: If API says it's a contact, update our graph status too!
                            if (contact.isMyContact) {
                                node.isMyContact = true;
                            }
                            // console.log(`✅ Enrich success: ${node.id} -> ${newName}`);
                        }
                    }
                } catch (e) {
                    // Ignore 404s or other errors, keep as number
                }
            }));

            enrichedCount += batch.length;
            if (i % 50 === 0) {
                onProgress({
                    current: 92 + Math.floor((enrichedCount / blueNodes.length) * 5),
                    total: 100,
                    message: `Enriching... ${enrichedCount}/${blueNodes.length}`
                });
            }
        }
    }

    // 6. Compute insights
    console.log("Computing insights...");
    onProgress({ current: 98, total: 100, message: "Computing insights..." });

    const insights = computeInsights(contactMap, groupMap, metadata, myId, activeNodes);

    console.log(`Processed ${activeNodes.length} nodes and ${links.length} links.`);
    onProgress({ current: 100, total: 100, message: "Done!" });

    return {
        graph: { nodes: activeNodes, links },
        stats: {
            // Count actual contacts identified in the graph (Green nodes)
            totalContacts: activeNodes.filter(n => n.isMyContact && !n.isMe && !n.isGroup).length,
            totalGroups: groupMap.size,
            totalChats: chats.length,
            totalNodes: activeNodes.length,
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
        superConnectors: [],
        unexpectedBridges: []
    };

    // 1. Build Group Member Sets for Jaccard Calculation
    const groupMemberSets = new Map(); // GroupID -> Set<ContactID>
    // Initialize with empty sets for all known groups
    for (const groupId of groupMap.keys()) {
        groupMemberSets.set(groupId, new Set());
    }
    // Populate from contacts
    for (const contact of contactMap.values()) {
        if (contact.groups) {
            contact.groups.forEach(gid => {
                if (groupMemberSets.has(gid)) {
                    groupMemberSets.get(gid).add(contact.id);
                }
            });
        }
    }

    const groupJaccard = new Map();
    const getJaccard = (g1, g2) => {
        const key = g1 < g2 ? `${g1}|${g2}` : `${g2}|${g1}`;
        if (groupJaccard.has(key)) return groupJaccard.get(key);

        const s1 = groupMemberSets.get(g1);
        const s2 = groupMemberSets.get(g2);
        if (!s1 || !s2 || s1.size === 0 || s2.size === 0) return 0;

        let intersection = 0;
        const [small, large] = s1.size < s2.size ? [s1, s2] : [s2, s1];
        for (const id of small) {
            if (large.has(id)) intersection++;
        }

        const union = s1.size + s2.size - intersection;
        return union === 0 ? 0 : intersection / union;
    };

    // 2. Identify Unexpected Bridges
    const bridges = [];
    let bridgesCandidates = 0;
    let pairsChecked = 0;

    console.log(`[Insights Debug] groupMap size: ${groupMap.size}`);
    console.log(`[Insights Debug] Contacts with group info: ${Array.from(contactMap.values()).filter(c => c.groups && c.groups.size > 0).length}`);
    console.log(`[Insights Debug] Contacts with >= 2 groups: ${Array.from(contactMap.values()).filter(c => c.groups && c.groups.size >= 2).length}`);

    for (const contact of contactMap.values()) {
        if (contact.id === myId) continue;
        if (!contact.groups || contact.groups.size < 2) continue;

        bridgesCandidates++;
        const groups = Array.from(contact.groups);
        let maxDisconnect = 0;
        let bestPair = null;

        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const g1 = groups[i];
                const g2 = groups[j];

                // Skip if group info missing
                if (!groupMap.has(g1) || !groupMap.has(g2)) {
                    // console.log(`[Insights Debug] Missing group info for ${g1} or ${g2}`);
                    continue;
                }

                pairsChecked++;
                const similarity = getJaccard(g1, g2);
                // "Disconnect" score: 1 is completely disjoint
                const disconnect = 1 - similarity;

                // Log first few
                if (pairsChecked < 5) {
                    console.log(`[Insights Debug] Pair: ${groupMap.get(g1).name} | ${groupMap.get(g2).name} -> Sim: ${similarity.toFixed(2)} Disconnect: ${disconnect.toFixed(2)}`);
                }

                if (disconnect > maxDisconnect) {
                    maxDisconnect = disconnect;
                    bestPair = [groupMap.get(g1).name, groupMap.get(g2).name];
                }
            }
        }

        // Only count if highly disjoint
        // Lowered threshold to 0.4 to be extremely permissive for debugging
        if (bestPair && maxDisconnect > 0.4) {
            bridges.push({
                name: contact.name,
                score: maxDisconnect,
                groupA: bestPair[0],
                groupB: bestPair[1]
            });
        }
    }

    console.log(`[Insights] Scanned ${bridgesCandidates} candidates, checked ${pairsChecked} pairs. Found ${bridges.length} bridges.`);
    if (bridges.length > 0) {
        console.log(`[Insights] Top bridge: ${bridges[0].name} (${bridges[0].score.toFixed(2)})`);
    }

    insights.unexpectedBridges = bridges
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);


    // --- Standard Metrics ---

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

    // Bridge people (in many groups) - Standard generic bridge
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
