const https = require('https');

const data = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
        { role: 'user', content: 'Say hello in JSON' }
    ]
});

const req = https.request({
    hostname: 'api.deepseek.com',
    path: '/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-412552782fbe4009a25a013825e6ab66',
        'Content-Length': data.length
    }
}, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(body);
    });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
