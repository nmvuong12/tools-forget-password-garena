/**
 * Web Server cục bộ (Local Server)
 * Phục vụ giao diện tĩnh và các API endpoint trên máy của bạn
 * Chạy lệnh: node server.js -> Truy cập: http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Nạp file .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...values] = line.split('=');
      const val = values.join('=').trim().replace(/^["'](.*)["']$/, '$1');
      if (!process.env[key.trim()]) process.env[key.trim()] = val;
    }
  });
}

const configHandler = require('./api/config');
const cronHandler = require('./api/cron');

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // 1. Phục vụ giao diện tĩnh public/index.html
  if (pathname === '/' || pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(htmlPath).pipe(res);
    }
  }

  // 2. Định tuyến API /api/config
  if (pathname === '/api/config') {
    let body = '';
    for await (const chunk of req) body += chunk;
    req.body = body ? JSON.parse(body) : {};

    // Giả lập trợ giúp res.status().json()
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };

    return configHandler(req, res);
  }

  // 3. Định tuyến API /api/cron
  if (pathname === '/api/cron') {
    let body = '';
    for await (const chunk of req) body += chunk;
    req.body = body ? JSON.parse(body) : {};

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };

    return cronHandler(req, res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n===========================================================`);
  console.log(`🚀 Giao diện Web Bảng Điều Khiển đang chạy tại:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`===========================================================\n`);
});
