/**
 * Script kiểm tra cục bộ luồng gọi 2 lần Init x 3 lần Submit
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...values] = line.split('=');
        const val = values.join('=').trim().replace(/^["'](.*)["']$/, '$1');
        process.env[key.trim()] = val;
      }
    });
  }
}

loadEnv();

const isPlaceholderUrl = !process.env.API1_URL || process.env.API1_URL.includes('example.com');
const forceMock = process.argv.includes('--mock') || isPlaceholderUrl;

async function runTest() {
  let mockServer = null;

  if (forceMock) {
    console.log('\n-----------------------------------------------------------');
    console.log('⚡ PHÁT HIỆN CHẾ ĐỘ GIẢ LẬP (MOCK TEST: 2 INIT x 3 SUBMIT)');
    console.log('Khởi tạo Mock API Server cục bộ để kiểm tra chuỗi dữ liệu...');
    console.log('-----------------------------------------------------------\n');

    let initCallIndex = 0;
    let submitTotalCalls = 0;
    let currentExpectedRequestId = '';

    mockServer = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      const parsedBody = body ? JSON.parse(body) : {};

      if (req.url === '/mock-api-1') {
        initCallIndex++;
        currentExpectedRequestId = `request_id_lan_init_${initCallIndex}_${Math.random().toString(36).substring(2, 10)}`;

        console.log(`[MOCK SERVER] 🟢 Nhận request INIT lần thứ ${initCallIndex}:`);
        console.log(`              Payload:`, parsedBody);
        console.log(`              Sinh request_id: ${currentExpectedRequestId}`);

        const sampleResponseApi1 = {
          result: 0,
          request_id: currentExpectedRequestId,
          account: parsedBody.account
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sampleResponseApi1));
      } else if (req.url === '/mock-api-2') {
        submitTotalCalls++;
        console.log(`[MOCK SERVER] 🔵 Nhận request SUBMIT (Tổng lượt gọi: ${submitTotalCalls}):`);
        console.log(`              Payload:`, parsedBody);

        if (parsedBody.request_id === currentExpectedRequestId) {
          console.log(`              ✅ Chuẩn xác: request_id trùng khớp với Đợt Init ${initCallIndex}!`);
        } else {
          console.error(`              ❌ Sai lệch: request_id không khớp với Đợt Init hiện tại!`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: 0, message: "OTP Submitted successfully", status: "OTP_SENT" }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise(resolve => mockServer.listen(9876, resolve));
    process.env.API1_URL = 'http://127.0.0.1:9876/mock-api-1';
    process.env.API2_URL = 'http://127.0.0.1:9876/mock-api-2';

    // Rút ngắn delay khi test mock để chạy nhanh
    process.env.DELAY_BETWEEN_SUBMITS_MS = '300';
    process.env.DELAY_BETWEEN_INITS_MS = '500';
  } else {
    console.log('\nĐang gọi trực tiếp đến API thật:');
    console.log(`- API 1 (Init): ${process.env.API1_URL}`);
    console.log(`- API 2 (Submit): ${process.env.API2_URL}`);
  }

  const mockReq = {
    headers: {
      'authorization': `Bearer ${process.env.CRON_SECRET || 'my_secure_cron_secret_2026'}`
    },
    query: {}
  };

  const mockRes = {
    statusCode: 200,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log('\n===========================================================');
      console.log(`KẾT QUẢ TỔNG KẾT (HTTP ${this.statusCode}):`);
      console.log(JSON.stringify(data, null, 2));
      console.log('===========================================================\n');
    }
  };

  const cronHandler = require('./api/cron.js');
  try {
    await cronHandler(mockReq, mockRes);
  } finally {
    if (mockServer) {
      mockServer.close();
    }
  }
}

runTest();
