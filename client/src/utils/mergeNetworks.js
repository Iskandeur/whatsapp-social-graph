// Merges two exported WhatsApp networks ({ graph, stats, insights }) into a
// single color-coded graph and computes cross-network insights. Pure, client
// side only — nodes match across exports by their normalized JID (`id`).

const endpointId = (x) => (x && typeof x === 'object' ? x.id : x);
const hasLetters = (s) => /[a-zA-Z]/.test(s || '');

// Jaccard similarity between two group member sets.
function jaccard(s1, s2) {
    if (!s1 || !s2 || s1.size === 0 || s2.size === 0) return 0;
    let intersection = 0;
    const [small, large] = s1.size < s2.size ? [s1, s2] : [s2, s1];
    for (const id of small) if (large.has(id)) intersection++;
    const union = s1.size + s2.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

// Port of server/dataProcessor.js computeInsights() bridge logic, run on the
// merged graph so it surfaces people bridging the two combined social circles.
function computeBridgeInsights(mergedNodes, groupsByNode, groupMemberSets, groupNameById, egoIds) {
    const bridges = [];
    for (const node of mergedNodes) {
        if (node.isGroup || egoIds.has(node.id)) continue;
        const gset = groupsByNode.get(node.id);
        if (!gset || gset.size < 2) continue;

        const groups = [...gset];
        let maxDisconnect = 0;
        let bestPair = null;
        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const g1 = groups[i];
                const g2 = groups[j];
                if (!groupNameById.has(g1) || !groupNameById.has(g2)) continue;
                const disconnect = 1 - jaccard(groupMemberSets.get(g1), groupMemberSets.get(g2));
                if (disconnect > maxDisconnect) {
                    maxDisconnect = disconnect;
                    bestPair = [groupNameById.get(g1), groupNameById.get(g2)];
                }
            }
        }
        if (bestPair && maxDisconnect > 0.4) {
            bridges.push({ name: node.name, score: maxDisconnect, groupA: bestPair[0], groupB: bestPair[1] });
        }
    }

    const peopleNonEgo = mergedNodes.filter((n) => !n.isGroup && !egoIds.has(n.id));
    return {
        unexpectedBridges: bridges.sort((a, b) => b.score - a.score).slice(0, 20),
        bridgePeople: peopleNonEgo
            .filter((n) => n.groupCount >= 3)
            .sort((a, b) => b.groupCount - a.groupCount)
            .slice(0, 10)
            .map((n) => ({ name: n.name, groups: n.groupCount })),
        superConnectors: peopleNonEgo
            .filter((n) => n.connections >= 3)
            .sort((a, b) => b.connections - a.connections)
            .slice(0, 10)
            .map((n) => ({ name: n.name, connections: n.connections })),
    };
}

export function mergeNetworks(netA, netB) {
    const graphA = netA?.graph || { nodes: [], links: [] };
    const graphB = netB?.graph || { nodes: [], links: [] };

    const egoA = graphA.nodes.find((n) => n.isMe);
    const egoB = graphB.nodes.find((n) => n.isMe);
    if (!egoA) throw new Error('The current network has no "Me" node.');
    if (!egoB) throw new Error('The pasted network has no "Me" node — is this a valid export?');

    const idA = egoA.id;
    const idB = egoB.id;
    const idsA = new Set(graphA.nodes.map((n) => n.id));
    const idsB = new Set(graphB.nodes.map((n) => n.id));
    const nodeA = new Map(graphA.nodes.map((n) => [n.id, n]));
    const nodeB = new Map(graphB.nodes.map((n) => [n.id, n]));

    // --- Merge nodes, tag each with which network(s) it belongs to ---
    const mergedNodes = [];
    const mergedById = new Map();
    for (const id of new Set([...idsA, ...idsB])) {
        const a = nodeA.get(id);
        const b = nodeB.get(id);
        const base = a || b;

        let network;
        if (id === idA) network = 'you';
        else if (id === idB) network = 'them';
        else if (a && b) network = 'shared';
        else if (a) network = 'yoursOnly';
        else network = 'theirsOnly';

        // Prefer the human-readable name over a bare phone number.
        let name = base.name;
        if (a && b) {
            const an = a.name || '';
            const bn = b.name || '';
            if (hasLetters(an) && !hasLetters(bn)) name = an;
            else if (hasLetters(bn) && !hasLetters(an)) name = bn;
            else name = an || bn;
        }

        const msgA = a ? a.messageCount || 0 : 0;
        const msgB = b ? b.messageCount || 0 : 0;
        const node = {
            id,
            name,
            number: base.number,
            isGroup: !!base.isGroup,
            isMe: id === idA,
            isMyContact: !!((a && a.isMyContact) || (b && b.isMyContact)),
            isArchived: !!base.isArchived,
            memberCount: base.memberCount,
            lastActivity: Math.max(a?.lastActivity || 0, b?.lastActivity || 0) || null,
            network,
            msgA,
            msgB,
            messageCount: msgA + msgB,
            connections: 0,
            groupCount: 0,
        };
        mergedNodes.push(node);
        mergedById.set(id, node);
    }

    // --- Merge links, dedupe (DIRECT links from each ego survive) ---
    const rawLinks = [...graphA.links, ...graphB.links].map((l) => ({
        source: endpointId(l.source),
        target: endpointId(l.target),
        value: l.value,
        type: l.type,
    }));
    const seen = new Set();
    const mergedLinks = [];
    for (const l of rawLinks) {
        if (!mergedById.has(l.source) || !mergedById.has(l.target)) continue;
        const key = `${l.type}|${l.source}|${l.target}`;
        if (seen.has(key)) continue;
        seen.add(key);
        mergedLinks.push(l);
    }

    // --- Recompute group membership & degree from merged links ---
    // (the exported `groups` Set serializes to {} and is lost)
    const groupsByNode = new Map(); // personId -> Set<groupId>
    const neighbors = new Map(); // nodeId -> Set<neighborId>
    const addNeighbor = (x, y) => {
        if (!neighbors.has(x)) neighbors.set(x, new Set());
        neighbors.get(x).add(y);
    };
    for (const l of mergedLinks) {
        if (l.type === 'MEMBERSHIP') {
            if (!groupsByNode.has(l.source)) groupsByNode.set(l.source, new Set());
            groupsByNode.get(l.source).add(l.target);
            addNeighbor(l.source, l.target);
            addNeighbor(l.target, l.source);
        } else if (l.type === 'DIRECT') {
            addNeighbor(l.source, l.target);
            addNeighbor(l.target, l.source);
        }
    }
    for (const node of mergedNodes) {
        node.groupCount = groupsByNode.get(node.id)?.size || 0;
        node.connections = neighbors.get(node.id)?.size || 0;
    }

    // --- Cross-network insights ---
    const egoIds = new Set([idA, idB]);
    const peopleNonEgo = mergedNodes.filter((n) => !n.isGroup && !egoIds.has(n.id));

    const mutualContacts = peopleNonEgo
        .filter((n) => n.network === 'shared')
        .sort((a, b) => b.msgA + b.msgB - (a.msgA + a.msgB))
        .map((n) => ({ id: n.id, name: n.name, msgA: n.msgA, msgB: n.msgB }));

    const rankIntros = (nodes, msgKey) =>
        nodes
            .sort((a, b) => {
                if (!!b.isMyContact !== !!a.isMyContact) return (b.isMyContact ? 1 : 0) - (a.isMyContact ? 1 : 0);
                return (b[msgKey] || 0) - (a[msgKey] || 0);
            })
            .slice(0, 10)
            .map((n) => ({ id: n.id, name: n.name, messageCount: n[msgKey] || 0, isMyContact: !!n.isMyContact }));

    const theyIntroduceYou = rankIntros(peopleNonEgo.filter((n) => n.network === 'theirsOnly'), 'msgB');
    const youIntroduceThem = rankIntros(peopleNonEgo.filter((n) => n.network === 'yoursOnly'), 'msgA');

    const sharedGroups = mergedNodes
        .filter((n) => n.isGroup && n.network === 'shared')
        .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
        .map((n) => ({ id: n.id, name: n.name, memberCount: n.memberCount || 0 }));

    const sharedPeople = peopleNonEgo.filter((n) => n.network === 'shared').length;
    const yoursPeople = peopleNonEgo.filter((n) => idsA.has(n.id)).length;
    const theirsPeople = peopleNonEgo.filter((n) => idsB.has(n.id)).length;
    const combinedReach = peopleNonEgo.length;
    const overlap = {
        yoursPeople,
        theirsPeople,
        sharedPeople,
        combinedReach,
        jaccard: combinedReach ? sharedPeople / combinedReach : 0,
    };

    // Bridge insights on the merged graph
    const groupNameById = new Map(mergedNodes.filter((n) => n.isGroup).map((n) => [n.id, n.name]));
    const groupMemberSets = new Map();
    for (const n of mergedNodes) if (n.isGroup) groupMemberSets.set(n.id, new Set());
    for (const [personId, gset] of groupsByNode) {
        for (const gid of gset) {
            if (groupMemberSets.has(gid)) groupMemberSets.get(gid).add(personId);
        }
    }
    const bridges = computeBridgeInsights(mergedNodes, groupsByNode, groupMemberSets, groupNameById, egoIds);

    return {
        mergedGraph: { nodes: mergedNodes, links: mergedLinks },
        crossInsights: {
            yourName: egoA.name,
            theirName: egoB.name,
            mutualContacts,
            theyIntroduceYou,
            youIntroduceThem,
            sharedGroups,
            overlap,
            ...bridges,
        },
    };
}
