const fs = require('fs');

const wf = JSON.parse(fs.readFileSync('n8n-workflows/60-kreativ-api.json', 'utf8'));

// 1. Change Webhook to "responseNode" instead of "lastNode"
const whNode = wf.nodes.find(n => n.name === 'Webhook API');
if (whNode) {
  whNode.parameters.responseMode = 'responseNode';
}

// 2. Add a new explicit response node at the end of the Human path
const respNode = {
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ success: true, message: 'Suporte humano acionado com sucesso.' }) }}"
  },
  "name": "Human: Respond Success",
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1,
  "position": [ 3220, -100 ],
  "id": "human-resp-node-id"
};

// Insert node
wf.nodes.push(respNode);

// Connect it after Pausar Typebot
wf.connections["Human: Pausar Typebot"] = {
  "main": [
    [
      { "node": "Human: Respond Success", "type": "main", "index": 0 }
    ]
  ]
};

// Re-map the Set Label node to Pausar Typebot correctly 
// Earlier patch set it to "Human: Pausar Typebot"
wf.connections["Human: CW Set Label"] = {
  "main": [
    [
      { "node": "Human: Pausar Typebot", "type": "main", "index": 0 }
    ]
  ]
};

fs.writeFileSync('n8n-workflows/60-kreativ-api.json', JSON.stringify(wf, null, 2));
console.log("Patched successfully.");
