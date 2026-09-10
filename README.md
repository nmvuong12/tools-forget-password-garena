# Vercel API Cron Scheduler

Dự án tự động hóa chuỗi 2 API tuần tự (2 lần Init x 3 lần Submit), hoạt động theo lịch trình **2 ngày 1 lần** và triển khai hoàn toàn tự động trên **Vercel** bằng **Vercel Cron Jobs**, tích hợp sẵn **Giao diện Web tĩnh** để quản trị.

> 📖 **Xem tài liệu chi tiết đầy đủ tại:** [**HUONG_DAN_SU_DUNG.md**](./HUONG_DAN_SU_DUNG.md)

---

## 🚀 Luồng hoạt động của hệ thống

1. **Vercel Cron:** Kích hoạt Serverless Function `/api/cron` định kỳ 2 ngày/lần (theo lịch `0 0 */2 * *` trong `vercel.json`).
2. **API 1:** Gửi request với payload xác thực tài khoản:
   ```json
   {
     "account": "triva151902",
     "app_id": 100001,
     "source": "account center"
   }
   ```
3. **Trích xuất dữ liệu:** Lấy trường `request_id` từ kết quả trả về của API 1.
4. **API 2:** Đưa `request_id` vào payload để gọi API 2:
   ```json
   {
     "action": 1,
     "data": "84123456789",
     "request_id": "<request_id_từ_API_1>"
   }
   ```
5. **Ghi log & Báo cáo:** Toàn bộ kết quả phản hồi của cả 2 API được lưu vào **Runtime Logs** trên Vercel Dashboard.

---

## 🛠️ Hướng dẫn Kiểm tra cục bộ (Local Test)

Bạn có thể chạy thử nghiệm ngay trên máy tính mà không cần cài đặt thêm bất kỳ thư viện nào:

### Cách 1: Test giả lập (Mock Server tự động)
Script sẽ tự động dựng một Mock Server nội bộ, trả về đúng response mẫu bạn đã gửi và xác nhận `request_id` được truyền chính xác sang API 2:
```bash
node test-local.js --mock
```

### Cách 2: Test với API thật
1. Mở file `.env` và điền URL thật của bạn vào:
   ```env
   API1_URL="https://your-domain.com/api1"
   API2_URL="https://your-domain.com/api2"
   API1_ACCOUNT="triva151902"
   API2_DATA="84123456789"
   ```
2. Chạy lệnh:
   ```bash
   node test-local.js
   ```

---

## 🌐 Hướng dẫn Triển khai lên Vercel

### Bước 1: Đưa mã nguồn lên GitHub
Mở Terminal tại thư mục này và chạy các lệnh sau:
```bash
git init
git add .
git commit -m "Initial commit: Vercel Cron API Scheduler"
git branch -M main
git remote add origin <URL_GITHUB_REPOSITORY_CỦA_BẠN>
git push -u origin main
```

### Bước 2: Import dự án vào Vercel
1. Truy cập [vercel.com](https://vercel.com) và đăng nhập.
2. Bấm **Add New...** -> **Project**.
3. Chọn Repository GitHub bạn vừa tải lên và bấm **Import**.

### Bước 3: Cấu hình Biến Môi Trường (Environment Variables)
Trong màn hình cấu hình trước khi bấm Deploy (hoặc vào mục **Settings > Environment Variables** sau khi deploy), thêm các biến sau:

| Key | Giá trị mẫu | Ý nghĩa |
| :--- | :--- | :--- |
| `API1_URL` | `https://your-domain.com/api1` | URL của API 1 |
| `API1_ACCOUNT` | `triva151902` | Tên tài khoản |
| `API1_APP_ID` | `100001` | App ID |
| `API1_SOURCE` | `account center` | Nguồn gọi |
| `API2_URL` | `https://your-domain.com/api2` | URL của API 2 |
| `API2_ACTION` | `1` | Action của API 2 |
| `API2_DATA` | `84123456789` | Số điện thoại / Dữ liệu gửi API 2 |
| `CRON_SECRET` | *(tạo chuỗi ngẫu nhiên bí mật)* | Bảo vệ endpoint, tránh người ngoài gọi trộm |
| `EXTRA_HEADERS_JSON` | `{}` *(tùy chọn)* | Headers bổ sung (Cookie, Auth Bearer, v.v.) |

Bấm **Deploy**.

---

## 🔍 Theo dõi & Kiểm tra trên Vercel

1. **Xem lịch trình Cron:** 
   Vào project trên Vercel -> Chọn tab **Settings** -> **Cron Jobs**. Bạn sẽ thấy job `/api/cron` được lên lịch `0 0 */2 * *` (mỗi 2 ngày một lần).
2. **Kích hoạt chạy thử thủ công trên Vercel:**
   - Bạn có thể vào tab **Cron Jobs** và bấm nút **Trigger / Test** cạnh cron job.
   - Hoặc mở trình duyệt truy cập:
     ```
     https://<ten-mien-vercel-cua-ban>.vercel.app/api/cron?secret=<CRON_SECRET>
     ```
3. **Xem Nhật ký (Logs):**
   Vào tab **Logs** hoặc **Functions** trên Vercel Dashboard để theo dõi từng lượt gọi API, mã HTTP trả về, và thời gian thực thi.
