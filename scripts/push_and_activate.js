const fs = require('fs');
const path = require('path');

// Configuration
const N8N_API_BASE = 'http://localhost:5678/api/v1';
const API_KEY = process.env.N8N_API_KEY; // Must be set in env

if (!API_KEY) {
    console.error('Error: N8N_API_KEY environment variable is not set.');
    process.exit(1);
}

const WORKFLOWS_DIR = '/tmp/n8n-workflows';

async function main() {
    if (!fs.existsSync(WORKFLOWS_DIR)) {
        console.error(`Error: Directory ${WORKFLOWS_DIR} does not exist.`);
        process.exit(1);
    }

    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} workflow files in ${WORKFLOWS_DIR}`);

    for (const file of files) {
        const filePath = path.join(WORKFLOWS_DIR, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const workflow = JSON.parse(content);
            const name = workflow.name;

            if (!name) {
                console.warn(`Skipping ${file}: No 'name' property found.`);
                continue;
            }

            console.log(`Processing '${name}' (${file})...`);

            // Check if exists
            const listRes = await fetch(`${N8N_API_BASE}/workflows`, {
                headers: { 'X-N8N-API-KEY': API_KEY }
            });

            if (!listRes.ok) {
                throw new Error(`Failed to list workflows: ${listRes.statusText}`);
            }

            const listData = await listRes.json();
            const existing = listData.data.find(w => w.name === name);

            let workflowId;
            if (existing) {
                console.log(`  - Updating existing workflow (ID: ${existing.id})...`);
                workflowId = existing.id;
                // Update
                const updateRes = await fetch(`${N8N_API_BASE}/workflows/${workflowId}`, {
                    method: 'PUT',
                    headers: {
                        'X-N8N-API-KEY': API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(workflow)
                });
                if (!updateRes.ok) throw new Error(`Update failed: ${await updateRes.text()}`);
            } else {
                console.log(`  - Creating new workflow...`);
                // Create
                const createRes = await fetch(`${N8N_API_BASE}/workflows`, {
                    method: 'POST',
                    headers: {
                        'X-N8N-API-KEY': API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(workflow)
                });
                if (!createRes.ok) throw new Error(`Creation failed: ${await createRes.text()}`);
                const createData = await createRes.json();
                workflowId = createData.id;
            }

            // Activate
            console.log(`  - Activating workflow ${workflowId}...`);
            const activateRes = await fetch(`${N8N_API_BASE}/workflows/${workflowId}/activate`, {
                method: 'POST',
                headers: { 'X-N8N-API-KEY': API_KEY }
            });

            if (activateRes.ok) {
                console.log(`  ✅ Activated successfully.`);
            } else {
                console.warn(`  ⚠️ Activation warning: ${await activateRes.text()}`);
            }

        } catch (err) {
            console.error(`Error processing ${file}:`, err.message);
        }
    }
}

main();
