const http = require('http');

const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkN2U2ZWNjOC03MjU5LTQxMjQtODdjNy0yOWE1ZjJkMjMzYmEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjQwM2JjOGEtMDRhMy00NzU4LTkyZGUtNzhmYjEyMjI5MDczIiwiaWF0IjoxNzcxNDM5MDgyfQ.BeT4UyvODJXOo-NliIQMgF9cuR-8yVP7mtdBVVdcUms';
const options = {
  hostname: 'localhost',
  port: 5678,
  path: '/api/v1/workflows',
  method: 'GET',
  headers: { 'X-N8N-API-KEY': apiKey }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const workflows = JSON.parse(data).data;
    const wf = workflows.find(w => w.name === 'Kreativ: AI Cognitive Router');
    if (wf) {
      console.log('Found ID:', wf.id);
      activate(wf.id);
    } else {
      console.log('Router not found');
    }
  });
});

req.end();

function activate(id) {
  const actOptions = { ...options, path: `/api/v1/workflows/${id}/activate`, method: 'POST' };
  const actReq = http.request(actOptions, res => {
    console.log('Activation Status:', res.statusCode);
    if(res.statusCode === 200) test();
  });
  actReq.end();
}

function test() {
   const postData = JSON.stringify({ body: { message: 'Ola mundo' } });
   const testOptions = {
     hostname: 'localhost',
     port: 5678,
     path: '/webhook/ai-router',
     method: 'POST',
     headers: { 
       'Content-Type': 'application/json',
       'Content-Length': Buffer.byteLength(postData)
     }
   };
   const testReq = http.request(testOptions, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => console.log('Test Response:', data));
   });
   testReq.write(postData);
   testReq.end();
}
