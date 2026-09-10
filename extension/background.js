/**
 * Background Service Worker: Tự động trích xuất Cookie Garena và gửi về Tool
 */

const DEFAULT_API_URL = "http://localhost:3000/api/config";

// Lấy URL cấu hình (Local hoặc Vercel)
async function getTargetApiUrl() {
  const data = await chrome.storage.local.get(['apiUrl']);
  return data.apiUrl || DEFAULT_API_URL;
}

// Đồng bộ cookie về máy chủ
async function syncGarenaCookie() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: "garena.com" });
    if (!cookies || cookies.length === 0) {
      console.log("[COOKIE SYNC] Chưa tìm thấy cookie nào của garena.com");
      return;
    }

    // Ghép toàn bộ cookie thành chuỗi
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const hasDataDome = cookies.some(c => c.name === 'datadome');

    if (!hasDataDome) {
      console.log("[COOKIE SYNC] Chưa có cookie datadome");
      return;
    }

    const apiUrl = await getTargetApiUrl();
    console.log(`[COOKIE SYNC] Đang gửi cookie mới về: ${apiUrl}`);

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_cookie',
        cookie: cookieString
      })
    });

    if (res.ok) {
      console.log("[COOKIE SYNC] ✅ Đồng bộ Cookie thành công!");
      await chrome.storage.local.set({
        lastSync: new Date().toISOString(),
        syncStatus: 'SUCCESS',
        cookiePreview: cookieString.substring(0, 60) + '...'
      });
    } else {
      console.warn("[COOKIE SYNC] ❌ Gửi thất bại: HTTP", res.status);
      await chrome.storage.local.set({ syncStatus: 'FAILED_HTTP_' + res.status });
    }
  } catch (err) {
    console.error("[COOKIE SYNC ERROR]", err.message);
    await chrome.storage.local.set({ syncStatus: 'ERROR: ' + err.message });
  }
}

// Lắng nghe khi cookie của Garena thay đổi
let debounceTimer = null;
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cookie.domain.includes('garena.com')) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log("[COOKIE CHANGED] Phát hiện cookie Garena được cập nhật, đồng bộ ngay...");
      syncGarenaCookie();
    }, 2000);
  }
});

// Chạy khi khởi động trình duyệt
chrome.runtime.onStartup.addListener(() => {
  syncGarenaCookie();
});

chrome.runtime.onInstalled.addListener(() => {
  syncGarenaCookie();
});
