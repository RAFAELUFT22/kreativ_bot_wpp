const http = require('http');

const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkN2U2ZWNjOC03MjU5LTQxMjQtODdjNy0yOWE1ZjJkMjMzYmEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjQwM2JjOGEtMDRhMy00NzU4LTkyZGUtNzhmYjEyMjI5MDczIiwiaWF0IjoxNzcxNDM5MDgyfQ.BeT4UyvODJXOo-NliIQMgF9cuR-8yVP7mtdBVVdcUms';

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    try {
        // 1. List Workflows
        console.log('Listing workflows...');
        const listOpts = {
            hostname: 'localhost',
            port: 5678,
            path: '/api/v1/workflows',
            method: 'GET',
            headers: { 'X-N8N-API-KEY': apiKey }
        };
        const listRes = await request(listOpts);
        if (listRes.statusCode !== 200) throw new Error(`List failed: ${listRes.statusCode}`);

        const workflows = JSON.parse(listRes.data).data;

        const targets = ['Kreativ: AI Cognitive Router', 'Kreativ: Test LLM Latency'];

        for (const name of targets) {
            const wf = workflows.find(w => w.name === name);
            if (wf) {
                console.log(`Found '${name}' (ID: ${wf.id}). Activating...`);
                const actOpts = {
                    hostname: 'localhost',
                    port: 5678,
                    path: `/api/v1/workflows/${wf.id}/activate`,
                    method: 'POST',
                    headers: { 'X-N8N-API-KEY': apiKey }
                };
                const actRes = await request(actOpts);
                console.log(`  Activation Result: ${actRes.statusCode}`);
            } else {
                console.error(`  Warning: '${name}' not found.`);
            }
        }

        // 2. Test LLM Latency
        console.log('Testing LLM Latency...');
        const testBody = JSON.stringify({ message: 'Ping' });
        const testOpts = {
            hostname: 'localhost',
            port: 5678,
            path: '/webhook/test-llm', // Using responseNode mode
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(testBody)
            }
        };
        const testRes = await request(testOpts, testBody);
        console.log(`Test Status: ${testRes.statusCode}`);
        console.log('Test Response:', testRes.data);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

main();
