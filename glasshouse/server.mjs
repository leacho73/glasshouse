// Glasshouse is now Panalume. This stand-in keeps the old dashboard available
// to Panalume (which copies it across on first start) and tells anyone who
// opens Glasshouse what to do.
import http from 'node:http';
import fs from 'node:fs';

const CONFIG = '/data/dashboard.json';
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Glasshouse is now Panalume</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f17;color:#e8eaf0;font:16px/1.55 system-ui,sans-serif;padding:24px;box-sizing:border-box}
main{max-width:560px}h1{font-size:26px;margin:0 0 12px;background:linear-gradient(90deg,#7aa2ff,#b48cff);-webkit-background-clip:text;color:transparent}
ol{padding-left:1.3em}li{margin:6px 0}b{color:#fff}p{color:#aab3c5}</style></head><body><main>
<h1>Glasshouse is now Panalume</h1>
<p>Same dashboard, new name. Your layout comes with you automatically.</p>
<ol>
<li>In Home Assistant, open <b>Settings → Apps → App Store</b> and install <b>Panalume</b> (it's in the same repository).</li>
<li>Start it, turn on <b>Show in sidebar</b> and open it. It copies your dashboard from Glasshouse within a few seconds.</li>
<li>Check everything's there, point any wall tablets at Panalume, then uninstall <b>Glasshouse (now Panalume)</b>.</li>
</ol>
<p>If your layout doesn't appear, keep this app running and restart Panalume.</p>
</main></body></html>`;

http.createServer((req, res) => {
  if (req.url.split('?')[0].endsWith('/api/config') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(fs.existsSync(CONFIG) ? fs.readFileSync(CONFIG) : 'null');
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(PAGE);
}).listen(8099, () => console.log('Glasshouse is now Panalume: install Panalume to carry on'));
