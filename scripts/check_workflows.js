const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5678,
    path: '/api/v1/workflows',
    method: 'GET',
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkN2U2ZWNjOC03MjU5LTQxMjQtODdjNy0yOWE1ZjJkMjMzYmEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjQwM2JjOGEtMDRhMy00NzU4LTkyZGUtNzhmYjEyMjI5MDczIiwiaWF0IjoxNzcxNDM5MDgyfQ.BeT4UyvODJXOo-NliIQMgF9cuR-8yVP7mtdBVVdcUms'
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.log('List Workflows Failed:', res.statusCode, body);
            return;
        }
        const workflows = JSON.parse(body).data;
        console.log('Workflows:', workflows.map(w => ({ id: w.id, name: w.name, active: w.active })));
    });
});

req.on('error', e => console.error(e));
req.end();
