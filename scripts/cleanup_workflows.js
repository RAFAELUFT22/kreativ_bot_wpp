const http = require('http');

const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkN2U2ZWNjOC03MjU5LTQxMjQtODdjNy0yOWE1ZjJkMjMzYmEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjQwM2JjOGEtMDRhMy00NzU4LTkyZGUtNzhmYjEyMjI5MDczIiwiaWF0IjoxNzcxNDM5MDgyfQ.BeT4UyvODJXOo-NliIQMgF9cuR-8yVP7mtdBVVdcUms';

async function request(path, method, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5678,
            path: '/api/v1' + path,
            method: method,
            headers: {
                'X-N8N-API-KEY': apiKey,
                'Content-Type': 'application/json'
            }
        };
        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    console.log('Fetching workflows...');
    const listRes = await request('/workflows', 'GET');
    const workflows = JSON.parse(listRes.body).data;

    // 1. Delete the conflicting record pDnDwl6D7mFdYSRf (wrong name/data)
    console.log('Deleting conflicting pDnD...');
    await request('/workflows/pDnDwl6D7mFdYSRf', 'DELETE');

    // 2. Identify and restore correct records
    const routerId = 'TVYcwBvRkHKWjhrC';
    const supportId = '04ZmheF5PCJr52aI';

    console.log('Restoring Router...');
    const fs = require('fs');
    const routerJson = JSON.parse(fs.readFileSync('/tmp/n8n-workflows/20-ai-router.json', 'utf8'));
    routerJson.active = true;
    await request(`/workflows/${routerId}`, 'PUT', routerJson);

    console.log('Restoring Support...');
    const supportJson = JSON.parse(fs.readFileSync('/tmp/n8n-workflows/04-request-human-support.json', 'utf8'));
    supportJson.active = true;
    await request(`/workflows/${supportId}`, 'PUT', supportJson);

    console.log('Cleanup complete.');
}

run().catch(console.error);
