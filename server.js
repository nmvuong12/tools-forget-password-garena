/**
 * Web Server cục bộ (Local Server)
 * Phục vụ giao diện tĩnh, API, và TỰ ĐỘNG LẬP LỊCH theo cấu hình động từ giao diện
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
const { getScheduleTimes } = require('./lib/storage');

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

server.listen(PORT, async () => {
  const initialSchedules = await getScheduleTimes();
  const timesStr = initialSchedules.map(t => `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`).join(', ');

  console.log(`\n===========================================================`);
  console.log(`🚀 Giao diện Web Bảng Quản Lý đang chạy tại:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`⏰ Lịch chạy tự động hiện tại (Giờ VN): [ ${timesStr} ]`);
  console.log(`💡 Bạn có thể tùy chỉnh lịch này trực tiếp trên giao diện web!`);
  console.log(`===========================================================\n`);
});

// ================================================================
// BỘ HẸN GIỜ TỰ ĐỘNG THEO LỊCH ĐỘNG (Dynamic Local Cron Timer)
// Đọc lịch từ file cấu hình/giao diện và kích hoạt đúng giờ
// ================================================================
let lastExecutedKey = '';

setInterval(async () => {
  try {
    const now = new Date();
    const vnDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const currentHour = vnDate.getHours();
    const currentMinute = vnDate.getMinutes();
    const currentKey = `${currentHour}:${currentMinute}`;

    // Lấy cấu hình lịch động mới nhất từ storage
    const scheduleTimes = await getScheduleTimes();
    const isMatched = scheduleTimes.some(
      (st) => Number(st.hour) === currentHour && Number(st.minute) === currentMinute
    );

    if (isMatched) {
      if (lastExecutedKey !== currentKey) {
        lastExecutedKey = currentKey;
        const timeFormatted = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        console.log(`\n⏰ [HẸN GIỜ TỰ ĐỘNG] Đã đến ${timeFormatted} (Giờ VN)! Kích hoạt tiến trình...`);

        const mockReq = { headers: { 'x-requested-from': 'web-ui' }, body: {} };
        const mockRes = {
          statusCode: 200,
          setHeader() {},
          status(code) { this.statusCode = code; return this; },
          json(data) {
            console.log(`[HẸN GIỜ TỰ ĐỘNG] Hoàn tất đợt chạy lúc ${timeFormatted}:`, data.success ? 'THÀNH CÔNG' : 'LỖI');
          }
        };

        await cronHandler(mockReq, mockRes);
      }
    } else {
      if (lastExecutedKey === currentKey) {
        lastExecutedKey = '';
      }
    }
  } catch (err) {
    console.error('[HẸN GIỜ TỰ ĐỘNG LỖI]:', err.message);
  }
}, 30000);
