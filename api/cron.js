/**
 * Vercel Serverless Function: Tự động chạy chuỗi API định kỳ
 * Hỗ trợ ĐA TÀI KHOẢN (Multi-Account):
 * - Tự động duyệt qua từng tài khoản đang hoạt động
 * - Mỗi tài khoản chạy: 2 lần Init x 3 lần Submit với request_id tương ứng
 * - Có thời gian nghỉ an toàn giữa các lượt submit và giữa các tài khoản
 */

const { getAccounts } = require('../lib/storage');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async (req, res) => {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-from');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();
  console.log(`\n===========================================================`);
  console.log(`[CRON] Bắt đầu tiến trình tự động lúc: ${new Date().toISOString()}`);
  console.log(`===========================================================`);

  let bodyData = req.body;
  if (typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData); } catch (e) {}
  }

  // 1. Kiểm tra xác thực bảo mật
  const cronSecret = process.env.CRON_SECRET;
  const isFromUi = req.headers && (req.headers['x-requested-from'] === 'web-ui' || (bodyData && bodyData.from_ui));

  if (cronSecret && !isFromUi) {
    const authHeader = req.headers ? req.headers['authorization'] : null;
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

  // 2. Lấy danh sách tài khoản cần chạy
  const allAccounts = await getAccounts();
  let targetAccounts = [];

  // Nếu người dùng bấm "Chạy riêng acc này" từ giao diện
  if (bodyData && bodyData.target_account) {
    const specificAcc = allAccounts.find(
      (a) => a.account.toLowerCase() === bodyData.target_account.toLowerCase()
    );
    if (specificAcc) {
      targetAccounts = [specificAcc];
    } else {
      targetAccounts = [{
        account: bodyData.target_account,
        api2_data: bodyData.api2_data || "84123456789",
        cookie: bodyData.cookie || "",
        enabled: true
      }];
    }
  } else {
    // Mặc định chạy tất cả các tài khoản đang được Bật (enabled !== false)
    targetAccounts = allAccounts.filter((a) => a.enabled !== false);
  }

  // Nếu danh sách rỗng, sử dụng tài khoản mặc định trong .env
  if (targetAccounts.length === 0) {
    targetAccounts = [{
      account: process.env.API1_ACCOUNT || "nghjalsss",
      api2_data: process.env.API2_DATA || "84123456789",
      cookie: process.env.GARENA_COOKIE || "",
      enabled: true
    }];
  }

  console.log(`[CRON] Tổng số tài khoản sẽ thực thi: ${targetAccounts.length}`);

  // Cấu hình chung
  const api1Url = process.env.API1_URL || "https://account.garena.com/api/account/recovery/init";
  const api1AppId = Number(process.env.API1_APP_ID || 100001);
  const api1Source = process.env.API1_SOURCE || "account center";

  const api2Url = process.env.API2_URL || "https://account.garena.com/api/account/recovery/send_otp";
  const api2Action = Number(process.env.API2_ACTION || 1);

  const initRepeatCount = Number(process.env.INIT_REPEAT_COUNT || 2);
  const submitRepeatCount = Number(process.env.SUBMIT_REPEAT_COUNT || 3);
  const delayBetweenSubmitsMs = Number(process.env.DELAY_BETWEEN_SUBMITS_MS || 2000);
  const delayBetweenInitsMs = Number(process.env.DELAY_BETWEEN_INITS_MS || 3000);
  const delayBetweenAccountsMs = Number(process.env.DELAY_BETWEEN_ACCOUNTS_MS || 3000);

  const userAgent = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const accountsSummary = [];

  try {
    // DUYỆT TỪNG TÀI KHOẢN TRONG DANH SÁCH
    for (let accIdx = 0; accIdx < targetAccounts.length; accIdx++) {
      const currentAcc = targetAccounts[accIdx];
      const accNumber = accIdx + 1;
      const accountName = currentAcc.account;
      const phoneData = currentAcc.api2_data || "84123456789";
      const accCookie = currentAcc.cookie || process.env.GARENA_COOKIE || "";

      console.log(`\n===========================================================`);
      console.log(`👤 [TÀI KHOẢN ${accNumber}/${targetAccounts.length}]: "${accountName}" (SĐT: ${phoneData})`);
      console.log(`===========================================================`);

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

      if (accCookie) {
        headers['Cookie'] = accCookie;
      }

      const accExecutionRounds = [];

      // VÒNG LẶP CHO TỪNG TÀI KHOẢN: 2 lần Init x 3 lần Submit
      for (let i = 1; i <= initRepeatCount; i++) {
        console.log(`   --------------------------------------------------------`);
        console.log(`   [${accountName}] [INIT ĐỢT ${i}/${initRepeatCount}] Đang gọi API 1...`);
        console.log(`   --------------------------------------------------------`);

        const api1Payload = {
          account: accountName,
          app_id: api1AppId,
          source: api1Source
        };

        const initStart = Date.now();
        const api1Controller = new AbortController();
        const api1Timeout = setTimeout(() => api1Controller.abort(), 20000);

        let api1Response;
        let api1ResponseBody;

        try {
          api1Response = await fetch(api1Url, {
            method: 'POST',
            headers,
            body: JSON.stringify(api1Payload),
            signal: api1Controller.signal
          });
          clearTimeout(api1Timeout);

          const api1RawText = await api1Response.text();
          try {
            api1ResponseBody = JSON.parse(api1RawText);
          } catch (err) {
            api1ResponseBody = api1RawText;
          }
        } catch (fetchErr) {
          clearTimeout(api1Timeout);
          console.error(`   [${accountName}] Lỗi kết nối API 1:`, fetchErr.message);
          accExecutionRounds.push({
            init_round: i,
            status: 'FETCH_ERROR',
            error: fetchErr.message
          });
          continue;
        }

        console.log(`   [${accountName}] [INIT ĐỢT ${i}] HTTP ${api1Response.status}:`, typeof api1ResponseBody === 'object' ? JSON.stringify(api1ResponseBody) : api1ResponseBody);

        // Kiểm tra DataDome Captcha
        if (api1Response.status === 403 && typeof api1ResponseBody === 'object' && api1ResponseBody.url && api1ResponseBody.url.includes('captcha-delivery.com')) {
          console.error(`   [${accountName}] Bị DataDome chặn (HTTP 403).`);
          accExecutionRounds.push({
            init_round: i,
            status: 'BLOCKED_BY_DATADOME',
            http_status: 403,
            captcha_url: api1ResponseBody.url,
            submits: []
          });
          break; // Bị chặn captcha thì dừng acc này, chuyển acc sau
        }

        const requestId = api1ResponseBody?.request_id || api1ResponseBody?.data?.request_id;

        if (!requestId) {
          console.error(`   [${accountName}] [INIT ĐỢT ${i}] Không lấy được request_id.`);
          accExecutionRounds.push({
            init_round: i,
            status: 'FAILED_NO_REQUEST_ID',
            http_status: api1Response.status,
            response: api1ResponseBody,
            submits: []
          });
          continue;
        }

        console.log(`   [${accountName}] [INIT ĐỢT ${i}] ✅ Lấy thành công request_id: ${requestId}`);

        // VÒNG LẶP SUBMIT 3 LẦN
        const roundSubmits = [];
        for (let j = 1; j <= submitRepeatCount; j++) {
          console.log(`      [${accountName}] [SUBMIT ${j}/${submitRepeatCount}] Đang gửi OTP tới ${phoneData}...`);

          const api2Payload = {
            action: api2Action,
            data: phoneData,
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

            console.log(`      [${accountName}] [SUBMIT ${j}] HTTP ${api2Response.status}:`, typeof api2ResponseBody === 'object' ? JSON.stringify(api2ResponseBody) : api2ResponseBody);

            roundSubmits.push({
              submit_index: j,
              http_status: api2Response.status,
              response: api2ResponseBody
            });
          } catch (subErr) {
            clearTimeout(api2Timeout);
            console.error(`      [${accountName}] [SUBMIT ${j}] Lỗi:`, subErr.message);
            roundSubmits.push({
              submit_index: j,
              error: subErr.message
            });
          }

          if (j < submitRepeatCount && delayBetweenSubmitsMs > 0) {
            await sleep(delayBetweenSubmitsMs);
          }
        }

        accExecutionRounds.push({
          init_round: i,
          status: 'SUCCESS',
          extracted_request_id: requestId,
          duration_ms: Date.now() - initStart,
          submits: roundSubmits
        });

        if (i < initRepeatCount && delayBetweenInitsMs > 0) {
          await sleep(delayBetweenInitsMs);
        }
      }

      accountsSummary.push({
        account: accountName,
        phone: phoneData,
        rounds: accExecutionRounds
      });

      // Nghỉ giữa các tài khoản khác nhau
      if (accIdx < targetAccounts.length - 1 && delayBetweenAccountsMs > 0) {
        console.log(`\n[CHUYỂN ACC] Nghỉ ${delayBetweenAccountsMs}ms trước khi chạy tài khoản tiếp theo...`);
        await sleep(delayBetweenAccountsMs);
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`\n===========================================================`);
    console.log(`[CRON] Hoàn tất toàn bộ ${targetAccounts.length} tài khoản sau ${totalDuration}ms`);
    console.log(`===========================================================\n`);

    return res.status(200).json({
      success: true,
      total_accounts_processed: targetAccounts.length,
      total_duration_ms: totalDuration,
      timestamp: new Date().toISOString(),
      summary: accountsSummary
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[CRON] Lỗi nghiêm trọng:`, error.message);
    return res.status(500).json({
      success: false,
      total_duration_ms: totalDuration,
      error: error.message,
      summary: accountsSummary
    });
  }
};
