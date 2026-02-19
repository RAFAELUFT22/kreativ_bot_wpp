const http = require('http');

console.log('Testing...');
const req = http.request({
    hostname: 'localhost',
    port: 5678,
    path: '/webhook/test-llm',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => console.log('Response:', data));
});
req.on('error', e => console.error('Error:', e.message));
req.write(JSON.stringify({ message: 'Ping' }));
req.end();
