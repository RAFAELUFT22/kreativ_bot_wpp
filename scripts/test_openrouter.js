const https = require('https');

const data = JSON.stringify({
    model: 'deepseek/deepseek-chat',
    messages: [{ role: 'user', content: 'Hello' }]
});

const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPEN_ROUTER_API
    }
};

const req = https.request(options, res => {
    console.log('Status:', res.statusCode);
    res.pipe(process.stdout);
});

req.on('error', e => {
    console.error('Error:', e);
});

req.write(data);
req.end();
