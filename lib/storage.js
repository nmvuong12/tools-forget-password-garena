/**
 * Module quản lý danh sách Đa Tài Khoản & Cấu hình Lịch Chạy Tự Động
 * Hỗ trợ lưu trữ: Vercel KV (Upstash Redis) / File data/config.json / Biến môi trường
 */

const fs = require('fs');
const path = require('path');

const LOCAL_CONFIG_PATH = process.env.VERCEL
  ? path.join('/tmp', 'garena_config.json')
  : path.join(__dirname, '..', 'data', 'config.json');

if (!process.env.VERCEL) {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
  }
}

// Lấy toàn bộ dữ liệu cấu hình
async function getAllData() {
  // 1. Kiểm tra Upstash Redis / Vercel KV
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const res = await fetch(`${process.env.KV_REST_API_URL}/get/garena_multi_accounts`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
      });
      const data = await res.json();
      if (data && data.result) {
        return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      }
    } catch (err) {
      console.warn('[STORAGE] Không thể đọc từ KV, chuyển sang tệp cục bộ:', err.message);
    }
  }

  // 2. Đọc từ tệp cục bộ
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.accounts)) {
        // Đảm bảo có settings
        if (!parsed.settings) {
          parsed.settings = {
            schedule_times: [
              { hour: 3, minute: 0 },
              { hour: 15, minute: 0 }
            ]
          };
        }
        return parsed;
      }
    } catch (err) {
      console.warn('[STORAGE] Lỗi đọc file config.json:', err.message);
    }
  }

  // 3. Khởi tạo mặc định
  return {
    accounts: [
      {
        id: "acc_default_1",
        account: process.env.API1_ACCOUNT || "nghjalsss",
        api2_data: process.env.API2_DATA || "84123456789",
        cookie: process.env.GARENA_COOKIE || "",
        enabled: true,
        created_at: new Date().toISOString()
      }
    ],
    settings: {
      schedule_times: [
        { hour: 3, minute: 0 },
        { hour: 15, minute: 0 }
      ]
    },
    updated_at: new Date().toISOString()
  };
}

// Lưu toàn bộ dữ liệu
async function saveAllData(data) {
  data.updated_at = new Date().toISOString();

  // 1. Lưu vào Upstash Redis / Vercel KV
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      await fetch(`${process.env.KV_REST_API_URL}/set/garena_multi_accounts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        body: JSON.stringify(JSON.stringify(data))
      });
    } catch (err) {
      console.warn('[STORAGE] Lỗi lưu lên KV:', err.message);
    }
  }

  // 2. Lưu vào tệp cục bộ
  try {
    fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[STORAGE] Không thể ghi file cấu hình:', err.message);
  }

  return data;
}

// Lấy danh sách tài khoản
async function getAccounts() {
  const data = await getAllData();
  return data.accounts || [];
}

// Thêm hoặc cập nhật tài khoản
async function addOrUpdateAccount({ account, api2_data, cookie }) {
  if (!account) throw new Error('Thiếu tên tài khoản');

  const data = await getAllData();
  const accounts = data.accounts || [];

  const existingIndex = accounts.findIndex(
    (item) => item.account.trim().toLowerCase() === account.trim().toLowerCase()
  );

  if (existingIndex >= 0) {
    accounts[existingIndex].api2_data = api2_data || accounts[existingIndex].api2_data;
    if (cookie !== undefined) accounts[existingIndex].cookie = cookie;
    accounts[existingIndex].updated_at = new Date().toISOString();
  } else {
    accounts.push({
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      account: account.trim(),
      api2_data: (api2_data || "84123456789").trim(),
      cookie: cookie ? cookie.trim() : "",
      enabled: true,
      created_at: new Date().toISOString()
    });
  }

  data.accounts = accounts;
  await saveAllData(data);
  return accounts;
}

// Xóa tài khoản
async function deleteAccount(idOrAccount) {
  const data = await getAllData();
  const accounts = data.accounts || [];

  const filtered = accounts.filter(
    (item) => item.id !== idOrAccount && item.account !== idOrAccount
  );

  data.accounts = filtered;
  await saveAllData(data);
  return filtered;
}

// Bật / Tắt tài khoản
async function toggleAccount(idOrAccount) {
  const data = await getAllData();
  const accounts = data.accounts || [];

  const target = accounts.find(
    (item) => item.id === idOrAccount || item.account === idOrAccount
  );

  if (target) {
    target.enabled = !target.enabled;
    target.updated_at = new Date().toISOString();
    await saveAllData(data);
  }

  return accounts;
}

// Lấy danh sách các mốc giờ chạy (Giờ VN)
async function getScheduleTimes() {
  const data = await getAllData();
  if (data.settings && Array.isArray(data.settings.schedule_times) && data.settings.schedule_times.length > 0) {
    return data.settings.schedule_times;
  }
  return [
    { hour: 3, minute: 0 },
    { hour: 15, minute: 0 }
  ];
}

// Cập nhật danh sách các mốc giờ chạy
async function updateScheduleTimes(scheduleTimes) {
  if (!Array.isArray(scheduleTimes)) throw new Error('scheduleTimes phải là danh sách mảng');

  const data = await getAllData();
  if (!data.settings) data.settings = {};

  data.settings.schedule_times = scheduleTimes;
  await saveAllData(data);
  return data.settings.schedule_times;
}

// Lưu kết quả của đợt chạy gần nhất (để hiển thị lên Live Console)
async function saveLatestRun(runResult) {
  const data = await getAllData();
  data.latest_run = {
    ...runResult,
    saved_at: new Date().toISOString()
  };
  await saveAllData(data);
  return data.latest_run;
}

async function getLatestRun() {
  const data = await getAllData();
  return data.latest_run || null;
}

module.exports = {
  getAllData,
  getAccounts,
  addOrUpdateAccount,
  deleteAccount,
  toggleAccount,
  getScheduleTimes,
  updateScheduleTimes,
  saveLatestRun,
  getLatestRun
};
