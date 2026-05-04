// 百度搜索代理服务器 — 仅用于验证 API Key 是否可用
// 用法: node baidu-proxy.js
// 代理地址: http://localhost:3778/proxy/baidu-search

const http = require('http');
const https = require('https');

const PORT = 3778; // 用不同端口避免冲突

const server = http.createServer((req, res) => {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // 代理端点
  if (req.method === 'POST' && req.url === '/proxy/baidu-search') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      // 从前端请求中读取 Authorization 头
      const auth = req.headers['authorization'];
      if (!auth) {
        res.writeHead(400, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '缺少 Authorization 头' }));
        return;
      }

      const options = {
        hostname: 'qianfan.baidubce.com',
        path: '/v2/ai_search/web_search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth,
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          });
          res.end(data);
        });
      });

      proxyReq.on('error', (e) => {
        res.writeHead(502, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      });

      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // 其他路径
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found. Use POST /proxy/baidu-search');
});

server.listen(PORT, () => {
  console.log(`百度搜索代理已启动: http://localhost:${PORT}/proxy/baidu-search`);
  console.log('前端需将 fetch URL 改为代理地址来验证');
});
