const http = require('http');
const req = http.request({
    hostname: 'localhost',
    port: 5678,
    path: '/webhook/request-human-support',
    method: 'POST'
}, res => {
    console.log('Status:', res.statusCode);
});
req.on('error', e => console.error(e));
req.end();
