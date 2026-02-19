const https = require('https');
https.get('https://www.google.com', res => {
  console.log('Google Status:', res.statusCode);
}).on('error', e => console.error('Google Error:', e));
