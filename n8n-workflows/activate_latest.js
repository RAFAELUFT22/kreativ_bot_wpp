const http = require('http');
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkN2U2ZWNjOC03MjU5LTQxMjQtODdjNy0yOWE1ZjJkMjMzYmEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjQwM2JjOGEtMDRhMy00NzU4LTkyZGUtNzhmYjEyMjI5MDczIiwiaWF0IjoxNzcxNDM5MDgyfQ.BeT4UyvODJXOo-NliIQMgF9cuR-8yVP7mtdBVVdcUms'; // Need to ensure this var is substituted
const options = {
  hostname: 'localhost',
  port: 5678,
  path: '/api/v1/workflows',
  method: 'GET',
  headers: { 'X-N8N-API-KEY': apiKey }
};
// ... same logic but find all matches and sort by createdAt or ID ...
// Actually, N8N IDs are alphanumeric strings, not auto-increment ints. 
// I'll just look for the one I just imported. 
// Standard import usually prints the ID. Let's check the output of the import command first? 
// The import command output is text.
// Let's just Activate ALL workflows with that name.
const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const workflows = JSON.parse(data).data;
    const matches = workflows.filter(w => w.name === 'Kreativ: AI Cognitive Router');
    matches.forEach(w => activate(w.id));
  });
});
req.end();

function activate(id) {
  const actOptions = { ...options, path: `/api/v1/workflows/${id}/activate`, method: 'POST' };
  const actReq = http.request(actOptions, res => console.log('Activated:', id, res.statusCode));
  actReq.end();
}
