const http = require('http');
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkN2U2ZWNjOC03MjU5LTQxMjQtODdjNy0yOWE1ZjJkMjMzYmEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjQwM2JjOGEtMDRhMy00NzU4LTkyZGUtNzhmYjEyMjI5MDczIiwiaWF0IjoxNzcxNDM5MDgyfQ.BeT4UyvODJXOo-NliIQMgF9cuR-8yVP7mtdBVVdcUms';

const toDeactivate = [
  'oeM02qpKdIGFbGQX', // Old Whatsapp Router
  '20bdoCN6e5W8EERS', // Conflict AI Router
  'jaOc9xKeDFtXbXuk', // Conflict AI Router
  'y9cnYNKyC58ML5cv'  // Test Latency (turn off to be clean, or leave on? Leave on)
];

const targetRouterId = 'pDnDwl6D7mFdYSRf'; // The one we want (from 20-ai-router.json)

function request(path, method) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 5678,
      path: path,
      method: method,
      headers: { 'X-N8N-API-KEY': apiKey }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({code: res.statusCode, body: data}));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Resolving conflicts...');
  
  // 1. Deactivate conflicts
  for (const id of toDeactivate) {
      console.log(`Deactivating ${id}...`);
      const res = await request(`/api/v1/workflows/${id}/deactivate`, 'POST');
      console.log(`  Status: ${res.code}`);
  }

  // 2. Activate Target
  console.log(`Activating Target ${targetRouterId}...`);
  const res = await request(`/api/v1/workflows/${targetRouterId}/activate`, 'POST');
  console.log(`  Target Status: ${res.code}`);
  console.log(`  Body: ${res.body}`);
}

main();
