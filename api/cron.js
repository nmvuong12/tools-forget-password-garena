/**
 * Vercel Serverless Function: Tự động chạy chuỗi API định kỳ
 * Cấu trúc lặp:
 * - Chạy INIT_REPEAT_COUNT lần (mặc định: 2 lần)
 * - Mỗi lần init thành công -> Chạy SUBMIT_REPEAT_COUNT lần (mặc định: 3 lần) với request_id của lần init đó
 * Tích hợp đọc cấu hình tài khoản động từ Storage/Giao diện
 */

const { getConfig } = require('../lib/storage');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async (req, res) => {
  // Cho phép gọi từ web UI
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();
  console.log(`\n===========================================================`);
  console.log(`[CRON] Bắt đầu tiến trình tự động lúc: ${new Date().toISOString()}`);
  console.log(`===========================================================`);

  // 1. Đọc cấu hình mới nhất từ Storage (đã được cập nhật từ Giao diện hoặc .env)
  const storedConfig = await getConfig();

  // Kiểm tra nếu gọi từ giao diện có kèm body tùy chỉnh
  let bodyData = req.body;
  if (typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData); } catch (e) {}
  }

  const cronSecret = process.env.CRON_SECRET;
  // Cho phép bỏ qua xác thực secret nếu gọi trực tiếp nội bộ từ giao diện UI
  const isFromUi = req.headers['x-requested-from'] === 'web-ui' || (bodyData && bodyData.from_ui);

  if (cronSecret && !isFromUi) {
    const authHeader = req.headers['authorization'];
    const querySecret = req.query ? req.query.secret : null;

    const isHeaderValid = authHeader === `Bearer ${cronSecret}`;
    const isQueryValid = querySecret === cronSecret;

    if (!isHeaderValid && !isQueryValid) {
      console.warn('[CRON] Từ chối truy cập: Sai hoặc thiếu CRON_SECRET');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: CRON_SECRET không hợp lệ hoặc không có quyền truy cập.'
      });
    }
  }

  // 2. Thiết lập tham số (Ưu tiên: Body truyền từ UI -> Cấu hình lưu trữ -> Mặc định .env)
  const api1Url = process.env.API1_URL || "https://account.garena.com/api/account/recovery/init";
  const api1Account = (bodyData && bodyData.account) || storedConfig.account || process.env.API1_ACCOUNT || "nghjalsss";
  const api1AppId = Number(process.env.API1_APP_ID || storedConfig.app_id || 100001);
  const api1Source = process.env.API1_SOURCE || storedConfig.source || "account center";

  const api2Url = process.env.API2_URL || "https://account.garena.com/api/account/recovery/send_otp";
  const api2Action = Number(process.env.API2_ACTION || storedConfig.api2_action || 1);
  const api2Data = (bodyData && bodyData.api2_data) || storedConfig.api2_data || process.env.API2_DATA || "84123456789";

  const initRepeatCount = Number(process.env.INIT_REPEAT_COUNT || 2);
  const submitRepeatCount = Number(process.env.SUBMIT_REPEAT_COUNT || 3);
  const delayBetweenSubmitsMs = Number(process.env.DELAY_BETWEEN_SUBMITS_MS || 2000);
  const delayBetweenInitsMs = Number(process.env.DELAY_BETWEEN_INITS_MS || 3000);

  const cookie = (bodyData && bodyData.cookie) || storedConfig.cookie || process.env.GARENA_COOKIE || process.env.COOKIE || "";
  const userAgent = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  console.log(`[CONFIG SỬ DỤNG] Tài khoản: "${api1Account}" | Số điện thoại: "${api2Data}"`);

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': 'application/json',
    'Origin': 'https://account.garena.com',
    'Referer': 'https://account.garena.com/recovery',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': userAgent
  };

  if (cookie) {
    headers['Cookie'] = cookie;
  }

  if (process.env.EXTRA_HEADERS_JSON) {
    try {
      const extra = JSON.parse(process.env.EXTRA_HEADERS_JSON);
      Object.assign(headers, extra);
    } catch (e) {}
  }

  if (!api1Url || !api2Url) {
    return res.status(500).json({
      success: false,
      error: 'Thiếu cấu hình API1_URL hoặc API2_URL trong biến môi trường.'
    });
  }

  const executionHistory = [];

  try {
    // VÒNG LẶP CHÍNH: Gọi Init (2 lần)
    for (let i = 1; i <= initRepeatCount; i++) {
      console.log(`\n-----------------------------------------------------------`);
      console.log(`[INIT ĐỢT ${i}/${initRepeatCount}] Đang gọi API 1 với tài khoản: ${api1Account}`);
      console.log(`-----------------------------------------------------------`);

      const api1Payload = {
        account: api1Account,
        app_id: api1AppId,
        source: api1Source
      };

      const initStart = Date.now();
      const api1Controller = new AbortController();
      const api1Timeout = setTimeout(() => api1Controller.abort(), 20000);

      const api1Response = await fetch(api1Url, {
        method: 'POST',
        headers,
        body: JSON.stringify(api1Payload),
        signal: api1Controller.signal
      });
      clearTimeout(api1Timeout);

      const api1RawText = await api1Response.text();
      let api1ResponseBody;
      try {
        api1ResponseBody = JSON.parse(api1RawText);
      } catch (err) {
        api1ResponseBody = api1RawText;
      }

      console.log(`[INIT ĐỢT ${i}] HTTP ${api1Response.status}:`, typeof api1ResponseBody === 'object' ? JSON.stringify(api1ResponseBody) : api1ResponseBody);

      if (api1Response.status === 403 && typeof api1ResponseBody === 'object' && api1ResponseBody.url && api1ResponseBody.url.includes('captcha-delivery.com')) {
        const errorDetail = 'Bị DataDome chặn (HTTP 403). Vui lòng cập nhật GARENA_COOKIE mới từ giao diện web.';
        console.error(`[INIT ĐỢT ${i}] ${errorDetail}`);
        executionHistory.push({
          init_round: i,
          status: 'BLOCKED_BY_DATADOME',
          http_status: 403,
          response: api1ResponseBody,
          submits: []
        });
        break;
      }

      const requestId = api1ResponseBody?.request_id || api1ResponseBody?.data?.request_id;

      if (!requestId) {
        console.error(`[INIT ĐỢT ${i}] Không lấy được request_id. Bỏ qua các lần submit của đợt này.`);
        executionHistory.push({
          init_round: i,
          status: 'FAILED_NO_REQUEST_ID',
          http_status: api1Response.status,
          response: api1ResponseBody,
          submits: []
        });
        continue;
      }

      console.log(`[INIT ĐỢT ${i}] ✅ Lấy thành công request_id: ${requestId}`);

      // VÒNG LẶP CON: Gọi Submit 3 lần
      const roundSubmits = [];
      for (let j = 1; j <= submitRepeatCount; j++) {
        console.log(`   [SUBMIT ${j}/${submitRepeatCount} (Đợt Init ${i})] Đang gửi OTP tới: ${api2Data}`);

        const api2Payload = {
          action: api2Action,
          data: api2Data,
          request_id: requestId
        };

        const api2Controller = new AbortController();
        const api2Timeout = setTimeout(() => api2Controller.abort(), 20000);

        try {
          const api2Response = await fetch(api2Url, {
            method: 'POST',
            headers,
            body: JSON.stringify(api2Payload),
            signal: api2Controller.signal
          });
          clearTimeout(api2Timeout);

          const api2RawText = await api2Response.text();
          let api2ResponseBody;
          try {
            api2ResponseBody = JSON.parse(api2RawText);
          } catch (err) {
            api2ResponseBody = api2RawText;
          }

          console.log(`   [SUBMIT ${j}] HTTP ${api2Response.status}:`, typeof api2ResponseBody === 'object' ? JSON.stringify(api2ResponseBody) : api2ResponseBody);

          roundSubmits.push({
            submit_index: j,
            http_status: api2Response.status,
            payload: api2Payload,
            response: api2ResponseBody
          });
        } catch (subErr) {
          console.error(`   [SUBMIT ${j}] Gặp lỗi:`, subErr.message);
          roundSubmits.push({
            submit_index: j,
            error: subErr.message
          });
        }

        if (j < submitRepeatCount && delayBetweenSubmitsMs > 0) {
          console.log(`   [WAIT] Nghỉ ${delayBetweenSubmitsMs}ms...`);
          await sleep(delayBetweenSubmitsMs);
        }
      }

      executionHistory.push({
        init_round: i,
        status: 'SUCCESS',
        extracted_request_id: requestId,
        duration_ms: Date.now() - initStart,
        submits: roundSubmits
      });

      if (i < initRepeatCount && delayBetweenInitsMs > 0) {
        console.log(`\n[WAIT] Nghỉ ${delayBetweenInitsMs}ms trước Đợt 2...`);
        await sleep(delayBetweenInitsMs);
      }
    }

    const totalDuration = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      current_account: api1Account,
      total_duration_ms: totalDuration,
      timestamp: new Date().toISOString(),
      config: {
        init_repeats: initRepeatCount,
        submits_per_init: submitRepeatCount,
        delay_between_submits_ms: delayBetweenSubmitsMs,
        delay_between_inits_ms: delayBetweenInitsMs
      },
      history: executionHistory
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    return res.status(500).json({
      success: false,
      total_duration_ms: totalDuration,
      error: error.message,
      history: executionHistory
    });
  }
};
