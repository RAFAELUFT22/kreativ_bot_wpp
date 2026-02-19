const fs = require('fs');
const http = require('http');

const workflowFile = '/tmp/n8n-workflows/20-ai-router.json';
const workflow = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));

// N8N API options
const options = {
    hostname: 'localhost',
    port: 5678,
    path: `/api/v1/workflows/${workflow.id || '20'}`, // Use ID if present, else try PUT to create/update? No, ID must be known for update.
    method: 'PUT', // or POST for new? Assuming update.
    headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkN2U2ZWNjOC03MjU5LTQxMjQtODdjNy0yOWE1ZjJkMjMzYmEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjQwM2JjOGEtMDRhMy00NzU4LTkyZGUtNzhmYjEyMjI5MDczIiwiaWF0IjoxNzcxNDM5MDgyfQ.BeT4UyvODJXOo-NliIQMgF9cuR-8yVP7mtdBVVdcUms'
    }
};

// Actually, 20-ai-router.json usually has NO ID in exported file unless strictly managed.
// But I saw "Deploying Router v2 (ID: pDnDwl6D7mFdYSRf)..." in earlier logs.
// So I should use that ID if possible, or let N8N handle it.
// If I use POST /workflows, it creates a new one.
// If I use PUT /workflows/:id, it updates.

// Let's try to list workflows to find "Kreativ: AI Cognitive Router" and get its ID.
const listOptions = {
    hostname: 'localhost',
    port: 5678,
    path: '/api/v1/workflows',
    method: 'GET',
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkN2U2ZWNjOC03MjU5LTQxMjQtODdjNy0yOWE1ZjJkMjMzYmEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjQwM2JjOGEtMDRhMy00NzU4LTkyZGUtNzhmYjEyMjI5MDczIiwiaWF0IjoxNzcxNDM5MDgyfQ.BeT4UyvODJXOo-NliIQMgF9cuR-8yVP7mtdBVVdcUms'
    }
};

const req = http.request(listOptions, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.log('List Workflows Failed:', res.statusCode, body);
            return;
        }
        const workflows = JSON.parse(body).data;
        const target = workflows.find(w => w.name === 'Kreativ: AI Cognitive Router');

        if (target) {
            console.log(`Found existing workflow: ${target.id}`);
            updateWorkflow(target.id);
        } else {
            console.log('Workflow not found. Creating new...');
            createWorkflow();
        }
    });
});

req.on('error', e => console.error(e));
req.end();

function updateWorkflow(id) {
    options.path = `/api/v1/workflows/${id}`;
    options.method = 'PUT';
    const req = http.request(options, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => console.log('Update Status:', res.statusCode, body));
    });
    req.write(JSON.stringify(workflow));
    req.end();
}

function createWorkflow() {
    options.path = '/api/v1/workflows';
    options.method = 'POST';
    const req = http.request(options, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => console.log('Create Status:', res.statusCode, body));
    });
    req.write(JSON.stringify(workflow));
    req.end();
}
