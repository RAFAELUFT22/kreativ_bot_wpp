const http = require('http');

// Credentials from .env
const USER = 'rafael.luciano@mail.uft.edu.br';
const PASS = 'Jesus%545';
const AUTH = Buffer.from(`${USER}:${PASS}`).toString('base64');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkN2U2ZWNjOC03MjU5LTQxMjQtODdjNy0yOWE1ZjJkMjMzYmEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjQwM2JjOGEtMDRhMy00NzU4LTkyZGUtNzhmYjEyMjI5MDczIiwiaWF0IjoxNzcxNDM5MDgyfQ.BeT4UyvODJXOo-NliIQMgF9cuR-8yVP7mtdBVVdcUms';

function request(options) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    try {
        console.log('Attempting Basic Auth + API Key...');
        const listOpts = {
            hostname: 'localhost',
            port: 5678,
            path: '/api/v1/workflows',
            method: 'GET',
            headers: {
                'X-N8N-API-KEY': API_KEY,
                // 'Authorization': `Basic ${AUTH}` // Try API Key first, if fail, panic.
                // Wait, the previous failure was 401 with API Key.
                // Maybe N8N_BASIC_AUTH_ACTIVE=true forces Basic Auth even on API?
                // Let's try adding Basic Auth header.
                'Authorization': `Basic ${AUTH}`
            }
        };

        const listRes = await request(listOpts);
        console.log(`Status: ${listRes.statusCode}`);

        if (listRes.statusCode === 200) {
            const workflows = JSON.parse(listRes.data).data;
            console.log(`Found ${workflows.length} workflows.`);
            workflows.forEach(w => {
                if (w.active) console.log(`[ACTIVE] ${w.name} (ID: ${w.id})`);
                else console.log(`[INACTIVE] ${w.name} (ID: ${w.id})`);
            });
        } else {
            console.log('Response:', listRes.data);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

main();
