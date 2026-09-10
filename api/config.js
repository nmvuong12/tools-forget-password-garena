/**
 * API Endpoint: Lấy và Cập nhật cấu hình API1_ACCOUNT từ giao diện người dùng
 */

const { getConfig, saveConfig } = require('../lib/storage');

module.exports = async (req, res) => {
  // Cho phép CORS nếu gọi từ giao diện
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const config = await getConfig();
      return res.status(200).json({
        success: true,
        data: config
      });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {}
      }

      if (!body || !body.account) {
        return res.status(400).json({
          success: false,
          error: 'Thiếu trường account (tài khoản Garena).'
        });
      }

      const updated = await saveConfig({
        account: body.account.trim(),
        api2_data: body.api2_data ? body.api2_data.trim() : undefined,
        cookie: body.cookie ? body.cookie.trim() : undefined
      });

      console.log(`[CONFIG] Đã cập nhật tài khoản thành công: ${updated.account}`);

      return res.status(200).json({
        success: true,
        message: 'Cập nhật cấu hình thành công!',
        data: updated
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('[CONFIG API ERROR]', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
