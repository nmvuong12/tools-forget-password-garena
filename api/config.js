/**
 * API Endpoint: Quản lý danh sách Đa Tài Khoản & Lịch Chạy Tự Động
 */

const {
  getAllData,
  getAccounts,
  addOrUpdateAccount,
  deleteAccount,
  toggleAccount,
  getScheduleTimes,
  updateScheduleTimes
} = require('../lib/storage');

module.exports = async (req, res) => {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. LẤY DỮ LIỆU TÀI KHOẢN & LỊCH CHẠY
    if (req.method === 'GET') {
      const data = await getAllData();
      return res.status(200).json({
        success: true,
        accounts: data.accounts || [],
        settings: data.settings || {
          schedule_times: [
            { hour: 3, minute: 0 },
            { hour: 15, minute: 0 }
          ]
        },
        latest_run: data.latest_run || null,
        updated_at: data.updated_at
      });
    }

    // 2. THAO TÁC CẬP NHẬT
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }

      if (!body) {
        return res.status(400).json({ success: false, error: 'Dữ liệu không hợp lệ' });
      }

      const action = body.action || 'add';

      // Cập nhật lịch chạy tự động
      if (action === 'update_schedule') {
        if (!Array.isArray(body.schedule_times)) {
          return res.status(400).json({ success: false, error: 'Thiếu danh sách schedule_times' });
        }

        const updatedTimes = await updateScheduleTimes(body.schedule_times);
        return res.status(200).json({
          success: true,
          message: 'Đã cập nhật lịch chạy tự động thành công!',
          schedule_times: updatedTimes
        });
      }

      // Xóa tài khoản
      if (action === 'delete') {
        if (!body.id && !body.account) {
          return res.status(400).json({ success: false, error: 'Thiếu id hoặc tên tài khoản để xóa' });
        }
        const updatedAccounts = await deleteAccount(body.id || body.account);
        return res.status(200).json({
          success: true,
          message: 'Đã xóa tài khoản thành công',
          accounts: updatedAccounts
        });
      }

      // Bật/tắt tài khoản
      if (action === 'toggle') {
        if (!body.id && !body.account) {
          return res.status(400).json({ success: false, error: 'Thiếu id hoặc tên tài khoản' });
        }
        const updatedAccounts = await toggleAccount(body.id || body.account);
        return res.status(200).json({
          success: true,
          message: 'Đã thay đổi trạng thái tài khoản',
          accounts: updatedAccounts
        });
      }

      // Thêm mới hoặc cập nhật tài khoản
      if (!body.account) {
        return res.status(400).json({ success: false, error: 'Vui lòng nhập tên tài khoản Garena' });
      }

      const updatedAccounts = await addOrUpdateAccount({
        account: body.account,
        api2_data: body.api2_data,
        cookie: body.cookie
      });

      return res.status(200).json({
        success: true,
        message: 'Đã thêm/cập nhật tài khoản vào danh sách',
        accounts: updatedAccounts
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
