const http = require('http');

const postData = JSON.stringify({ body: { message: 'Qual é a capital da França?' } });
const options = {
  hostname: 'localhost',
  port: 5678,
  path: '/webhook/ai-router',
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, res => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Body:', data));
});

req.on('error', e => console.error('Error:', e));
req.write(postData);
req.end();
