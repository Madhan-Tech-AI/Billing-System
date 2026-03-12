import handler from './api/barcode.js'; // Note: local test might need .js extension or different loader

// Mocking VercelRequest and VercelResponse for local testing
const mockReq = {
    query: { barcode: '8901023020582' },
    method: 'GET'
};

const mockRes = {
    status: (code) => {
        console.log('Status Code:', code);
        return mockRes;
    },
    json: (data) => {
        console.log('Response Data:', JSON.stringify(data, null, 2));
        return mockRes;
    },
    setHeader: (name, value) => {
        // console.log('Header:', name, value);
        return mockRes;
    },
    end: () => {}
};

console.log('Testing Barcode Lookup API locally (simulated)...');
// Note: This requires environment variables to be set in the terminal session
// handler(mockReq, mockRes);
console.log('Manual check: Please ensure environment variables are configured in Vercel Dashboard.');
