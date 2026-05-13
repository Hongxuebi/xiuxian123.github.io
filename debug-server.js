const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3777;
const ROOT = __dirname;

http.createServer((req, res) => {
  const cleanPath = req.url.split('?')[0];
  const filePath = path.join(ROOT, cleanPath === '/' ? 'index.html' : decodeURIComponent(cleanPath));
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.moc3': 'application/octet-stream',
    '.physics3': 'application/json',
    '.pose3': 'application/json',
    '.cdi3': 'application/json',
    '.userdata3': 'application/json',
    '.exp3': 'application/json',
    '.motion3': 'application/json',
  };

  // CORS 头（所有响应都加）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 预检请求直接返回
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // 调试日志端点
  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { console.log('[CLIENT]', JSON.parse(body)); } catch(e) {}
      res.writeHead(200);
      return res.end('ok');
    });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain; charset=utf-8' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`debug-server running at http://localhost:${PORT}/`);
});
