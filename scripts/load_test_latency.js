const http = require('http');

async function test() {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5678,
            path: '/webhook/test-llm',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, error: e.message, raw: data });
                }
            });
        });
        req.on('error', e => resolve({ error: e.message }));
        req.write(JSON.stringify({ message: `Load Test ${Date.now()}` }));
        req.end();
    });
}

async function main() {
    console.log('Starting Load Test (10 requests)...');
    console.log('Target: http://localhost:5678/webhook/test-llm');
    const results = [];
    for (let i = 0; i < 10; i++) {
        process.stdout.write(`Req ${i + 1}... `);
        const r = await test();
        results.push(r);
        if (r.status === 200) {
            console.log(`OK | Full: ${JSON.stringify(r.data)}`);
            console.log(`OK | Winner: ${r.data?.winner} | DeepSeek: ${r.data?.deepseek_time_ms}ms | OpenRouter: ${r.data?.openrouter_time_ms}ms`);
        } else {
            console.log(`FAIL ${r.status} | ${r.error || r.raw}`);
        }
        // small delay to not overwhelm if sync
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log('Done.');

    // Summary
    const success = results.filter(r => r.status === 200).length;
    console.log(`Success Rate: ${success}/10`);
}
main();
