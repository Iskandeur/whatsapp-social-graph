import React from 'react';

const QRCodeView = ({ qrCode }) => {
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
        </div>
    );
};

export default QRCodeView;
