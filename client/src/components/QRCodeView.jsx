import React from 'react';

const QRCodeView = ({ qrCode, onImportData }) => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
            <h1 className="text-4xl font-bold mb-8">WhatsApp Social Graph</h1>
            <div className="bg-white p-4 rounded-lg shadow-lg">
                {qrCode ? (
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                ) : (
                    <div className="w-64 h-64 flex items-center justify-center text-gray-500">
                        Waiting for QR Code...
                    </div>
                )}
            </div>
            <p className="mt-6 text-lg text-gray-400">
                Open WhatsApp on your phone {'>'} Menu {'>'} Linked Devices {'>'} Link a Device
            </p>
            {onImportData && (
                <div className="mt-8 flex flex-col items-center gap-3">
                    <div className="text-gray-600 text-sm uppercase tracking-wider">or</div>
                    <input
                        type="file"
                        id="bypass-import-json"
                        className="hidden"
                        accept=".json"
                        onChange={onImportData}
                    />
                    <label
                        htmlFor="bypass-import-json"
                        className="cursor-pointer px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 transition-colors"
                    >
                        Import an exported JSON instead
                    </label>
                    <p className="text-gray-600 text-xs">
                        Skip WhatsApp and view a previously exported graph file.
                    </p>
                </div>
            )}
        </div>
    );
};

export default QRCodeView;
