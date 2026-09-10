/**
 * Module quản lý lưu trữ cấu hình linh hoạt:
 * 1. Ưu tiên Upstash Redis / Vercel KV (nếu có cấu hình KV_REST_API_URL)
 * 2. Lưu file cục bộ (data/config.json hoặc /tmp/config.json trên Vercel)
 * 3. Fallback về Biến Môi Trường (.env)
 */

const fs = require('fs');
const path = require('path');

const LOCAL_CONFIG_PATH = process.env.VERCEL
  ? path.join('/tmp', 'garena_config.json')
  : path.join(__dirname, '..', 'data', 'config.json');

// Khởi tạo thư mục data nếu ở môi trường local
if (!process.env.VERCEL) {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
  }
}

async function getConfig() {
  // 1. Kiểm tra Upstash Redis / Vercel KV nếu có
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const res = await fetch(`${process.env.KV_REST_API_URL}/get/garena_config`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
      });
      const data = await res.json();
      if (data && data.result) {
        return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      }
    } catch (err) {
      console.warn('[STORAGE] Không thể đọc từ KV, chuyển sang lưu trữ tệp:', err.message);
    }
  }

  // 2. Đọc từ tệp JSON cục bộ / /tmp
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.warn('[STORAGE] Lỗi đọc file config.json:', err.message);
    }
  }

  // 3. Mặc định đọc từ biến môi trường
  return {
    account: process.env.API1_ACCOUNT || "nghjalsss",
    app_id: Number(process.env.API1_APP_ID || 100001),
    source: process.env.API1_SOURCE || "account center",
    api2_action: Number(process.env.API2_ACTION || 1),
    api2_data: process.env.API2_DATA || "84123456789",
    cookie: process.env.GARENA_COOKIE || "",
    updated_at: new Date().toISOString()
  };
}

async function saveConfig(newConfig) {
  const current = await getConfig();
  const updated = {
    ...current,
    ...newConfig,
    updated_at: new Date().toISOString()
  };

  // 1. Lưu vào Upstash Redis / Vercel KV nếu có
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      await fetch(`${process.env.KV_REST_API_URL}/set/garena_config`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        body: JSON.stringify(JSON.stringify(updated))
      });
    } catch (err) {
      console.warn('[STORAGE] Lỗi lưu lên KV:', err.message);
    }
  }

  // 2. Lưu vào tệp cục bộ
  try {
    fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    console.warn('[STORAGE] Không thể ghi file cấu hình:', err.message);
  }

  return updated;
}

module.exports = {
  getConfig,
  saveConfig
};
