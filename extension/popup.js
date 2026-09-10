const apiUrlInput = document.getElementById('apiUrlInput');
const btnSyncNow = document.getElementById('btnSyncNow');
const statusText = document.getElementById('statusText');
const lastSyncText = document.getElementById('lastSyncText');

const DEFAULT_URL = "http://localhost:3000/api/config";

// Tải thông tin lưu trữ
chrome.storage.local.get(['apiUrl', 'lastSync', 'syncStatus'], (data) => {
  apiUrlInput.value = data.apiUrl || DEFAULT_URL;
  if (data.lastSync) {
    lastSyncText.textContent = new Date(data.lastSync).toLocaleTimeString() + ' ' + new Date(data.lastSync).toLocaleDateString();
  }
  if (data.syncStatus) {
    statusText.textContent = data.syncStatus === 'SUCCESS' ? 'Đã đồng bộ thành công' : data.syncStatus;
  }
});

// Lưu URL khi người dùng thay đổi
apiUrlInput.addEventListener('change', () => {
  const url = apiUrlInput.value.trim() || DEFAULT_URL;
  chrome.storage.local.set({ apiUrl: url });
});

// Bấm nút đồng bộ ngay
btnSyncNow.addEventListener('click', async () => {
  btnSyncNow.disabled = true;
  btnSyncNow.textContent = 'Đang đồng bộ...';
  statusText.textContent = 'Đang kiểm tra cookie...';

  const targetUrl = apiUrlInput.value.trim() || DEFAULT_URL;
  await chrome.storage.local.set({ apiUrl: targetUrl });

  try {
    const cookies = await chrome.cookies.getAll({ domain: "garena.com" });
    if (!cookies || cookies.length === 0) {
      statusText.textContent = 'Chưa có cookie Garena!';
      btnSyncNow.textContent = '🔄 Đồng Bộ Cookie Ngay';
      btnSyncNow.disabled = false;
      return;
    }

    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const hasDataDome = cookies.some(c => c.name === 'datadome');

    if (!hasDataDome) {
      statusText.textContent = 'Thiếu cookie datadome! Hãy mở trang Garena trước';
      btnSyncNow.textContent = '🔄 Đồng Bộ Cookie Ngay';
      btnSyncNow.disabled = false;
      return;
    }

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_cookie',
        cookie: cookieString
      })
    });

    if (res.ok) {
      statusText.textContent = 'Thành công!';
      const now = new Date().toISOString();
      lastSyncText.textContent = new Date(now).toLocaleTimeString();
      await chrome.storage.local.set({ lastSync: now, syncStatus: 'SUCCESS' });
    } else {
      statusText.textContent = 'Lỗi HTTP ' + res.status;
    }
  } catch (err) {
    statusText.textContent = 'Lỗi kết nối: ' + err.message;
  } finally {
    btnSyncNow.disabled = false;
    btnSyncNow.textContent = '🔄 Đồng Bộ Cookie Ngay';
  }
});
