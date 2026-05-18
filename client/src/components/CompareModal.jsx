import React, { useState } from 'react';

// Modal to paste another user's exported network JSON and merge it in.
const CompareModal = ({ onCompareData, onClose }) => {
    const [text, setText] = useState('');
    const [error, setError] = useState('');

    const handleMerge = () => {
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            setError('That is not valid JSON. Paste the full contents of an exported .json file.');
            return;
        }
        const nodes = parsed?.graph?.nodes;
        const links = parsed?.graph?.links;
        if (!Array.isArray(nodes) || !Array.isArray(links)) {
            setError('Unrecognized format — expected an export with a "graph" containing nodes and links.');
            return;
        }
        if (!nodes.some((n) => n.isMe)) {
            setError('This export has no "Me" node, so it cannot be compared.');
            return;
        }
        setError('');
        onCompareData(parsed);
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg mx-4 p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-lg font-bold mb-1">🔀 Compare another network</h2>
                <p className="text-xs text-gray-400 mb-3">
                    Have a friend open this app and click <span className="text-green-400">Export JSON</span>,
                    then paste their file's contents below. Their data stays in your browser — it is never
                    uploaded.
                </p>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder='Paste exported JSON here, e.g. { "graph": { "nodes": [...], "links": [...] }, ... }'
                    spellCheck={false}
                    className="w-full h-48 bg-gray-900 text-gray-200 text-xs font-mono p-3 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
                <div className="flex justify-end gap-2 mt-4">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleMerge}
                        disabled={!text.trim()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-medium"
                    >
                        Merge networks
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompareModal;
