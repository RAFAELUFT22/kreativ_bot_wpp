const http = require('http');
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkN2U2ZWNjOC03MjU5LTQxMjQtODdjNy0yOWE1ZjJkMjMzYmEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjQwM2JjOGEtMDRhMy00NzU4LTkyZGUtNzhmYjEyMjI5MDczIiwiaWF0IjoxNzcxNDM5MDgyfQ.BeT4UyvODJXOo-NliIQMgF9cuR-8yVP7mtdBVVdcUms';

function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({code: res.statusCode, body: data}));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
    // List
    const listOpts = {
      hostname: 'localhost',
      port: 5678,
      path: '/api/v1/workflows',
      method: 'GET',
      headers: { 'X-N8N-API-KEY': apiKey }
    };
    const listRes = await request(listOpts);
    const workflows = JSON.parse(listRes.body).data;
    
    const tests = workflows.filter(w => w.name === 'Kreativ: Test LLM Latency');
    console.log(`Found ${tests.length} tests.`);
    
    for (const t of tests) {
        console.log(`Activating ${t.id}...`);
        const res = await request({
          hostname: 'localhost',
          port: 5678,
          path: `/api/v1/workflows/${t.id}/activate`,
          method: 'POST',
          headers: { 'X-N8N-API-KEY': apiKey }
        });
        console.log(`  Status: ${res.code}`);
    }
}
main();
