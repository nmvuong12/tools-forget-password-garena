# 📖 SÁCH HƯỚNG DẪN SỬ DỤNG HỆ THỐNG GARENA API SCHEDULER

Tài liệu này hướng dẫn chi tiết cách cài đặt, sử dụng giao diện web tĩnh và triển khai hệ thống tự động gọi API 2 ngày/lần lên **Vercel**.

---

## 📑 MỤC LỤC
1. [Giới thiệu tổng quan](#1-giới-thiệu-tổng-quan)
2. [Cấu trúc tệp tin](#2-cấu-trúc-tệp-tin)
3. [Cách sử dụng trên máy tính (Chạy Local)](#3-cách-sử-dụng-trên-máy-tính-chạy-local)
4. [Hướng dẫn lấy Cookie vượt tường lửa DataDome](#4-hướng-dẫn-lấy-cookie-vượt-tường-lửa-datadome)
5. [Hướng dẫn triển khai tự động lên Vercel](#5-hướng-dẫn-triển-khai-tự-động-lên-vercel)
6. [Quản lý tài khoản từ giao diện tĩnh](#6-quản-lý-tài-khoản-từ-giao-diện-tĩnh)
7. [Khắc phục sự cố thường gặp (Troubleshooting)](#7-khắc-phục-sự-cố-thường-gặp)

---

## 1. Giới thiệu tổng quan

Hệ thống được thiết kế để tự động hóa hoàn toàn quy trình kích hoạt và gửi OTP của Garena:
- **Chu kỳ chạy:** Định kỳ **2 ngày 1 lần** (Vercel Cron: `0 0 */2 * *`).
- **Quy trình mỗi lượt chạy:**
  - **Đợt 1:** Gọi API Init $\rightarrow$ Lấy `request_id` $\rightarrow$ Gọi Submit 3 lần liên tiếp (nghỉ 2 giây giữa các lần).
  - **Nghỉ 3 giây.**
  - **Đợt 2:** Gọi API Init $\rightarrow$ Lấy `request_id` mới $\rightarrow$ Gọi Submit 3 lần liên tiếp.
  - *Tổng cộng: 2 lần Init và 6 lần Submit cho mỗi chu kỳ.*
- **Giao diện Web:** Cho phép bạn đổi tài khoản Garena, dán Cookie và kích hoạt chạy test ngay từ trình duyệt.

---

## 2. Cấu trúc tệp tin

```
d:/ToolsFCO/
├── public/
│   └── index.html           # Giao diện Web tĩnh (Bảng điều khiển trực quan)
├── api/
│   ├── cron.js              # Mã nguồn chạy tự động của Vercel Cron
│   └── config.js            # API lưu/đọc cấu hình từ giao diện
├── lib/
│   └── storage.js           # Xử lý lưu trữ cấu hình (Vercel KV / File)
├── .env                     # File cấu hình nội bộ trên máy bạn (bảo mật)
├── .env.example             # File mẫu tham khảo các biến môi trường
├── vercel.json              # Cấu hình Cron Job và thời gian chạy Vercel
├── server.js                # Máy chủ chạy thử giao diện trên máy tính
├── test-local.js            # Script test mô phỏng nhanh
├── package.json             # Cấu hình dự án Node.js
└── HUONG_DAN_SU_DUNG.md     # Tài liệu hướng dẫn sử dụng (file này)
```

---

## 3. Cách sử dụng trên máy tính (Chạy Local)

### Bước 1: Mở giao diện Web trên máy tính
Mở Terminal / Command Prompt tại thư mục `d:\ToolsFCO` và gõ lệnh:
```bash
node server.js
```
Hoặc:
```bash
npm start
```

### Bước 2: Truy cập trang quản trị
Mở trình duyệt (Chrome/Edge/Cốc Cốc) và vào địa chỉ:
👉 **[http://localhost:3000](http://localhost:3000)**

Tại đây bạn sẽ thấy:
- **Ô nhập Tài khoản Garena (`API1_ACCOUNT`):** Nhập tài khoản bạn muốn tiến trình chạy.
- **Ô nhập Số điện thoại (`API2_DATA`):** Số điện thoại nhận OTP (mặc định: `84123456789`).
- **Ô nhập Cookie DataDome:** Dán chuỗi cookie để tránh bị chặn 403.
- **Nút "Lưu Cấu Hình":** Lưu thông tin để hệ thống ghi nhớ cho các lần chạy sau.
- **Nút "Kích Hoạt Chạy Ngay":** Bấm để chạy ngay lập tức chuỗi 2 Init x 3 Submit và theo dõi log hiển thị trực tiếp.

### Bước 3: Chạy test nhanh với dữ liệu giả lập (Mock Test)
Nếu muốn kiểm tra logic luồng dữ liệu mà không cần gọi API thật:
```bash
npm run test-mock
```

---

## 4. Hướng dẫn lấy Cookie vượt tường lửa DataDome

Garena sử dụng hệ thống chống bot **DataDome**. Nếu không có Cookie, API sẽ trả về lỗi **HTTP 403 (Captcha)**. Hãy làm theo các bước sau để lấy Cookie:

1. Mở trình duyệt và truy cập trang: [https://account.garena.com/recovery](https://account.garena.com/recovery)
2. Nhấn phím **`F12`** trên bàn phím (hoặc click chuột phải chọn **Inspect / Kiểm tra**).
3. Chuyển sang tab **Network** (Mạng).
4. Trên trang web Garena, nhập tài khoản của bạn và bấm Tiếp tục.
5. Ở danh sách các request trong tab Network:
   - Tìm request tên là **`init`**.
   - Bấm vào request đó $\rightarrow$ ở khung bên phải chọn tab **Headers**.
   - Cuộn xuống tìm mục **Request Headers** $\rightarrow$ tìm dòng **`Cookie:`**.
   - Copy toàn bộ giá trị của Cookie (chuỗi này dài và có chứa `datadome=...`).
6. Dán chuỗi vừa copy vào ô **Cookie DataDome** trên giao diện Web (hoặc vào biến `GARENA_COOKIE` trong file `.env`) rồi bấm **Lưu Cấu Hình**.

---

## 5. Hướng dẫn triển khai tự động lên Vercel

Sau khi triển khai lên Vercel, hệ thống sẽ tự động chạy ngầm trên đám mây **2 ngày 1 lần** mà không cần bật máy tính.

### Bước 1: Đưa mã nguồn lên GitHub
1. Mở Terminal tại thư mục `d:\ToolsFCO` và chạy các lệnh:
   ```bash
   git init
   git add .
   git commit -m "Khoi tao he thong Garena API Scheduler"
   git branch -M main
   git remote add origin <URL_GITHUB_REPOSITORY_CỦA_BẠN>
   git push -u origin main
   ```

### Bước 2: Kết nối và Deploy trên Vercel
1. Đăng nhập vào [https://vercel.com](https://vercel.com).
2. Bấm **Add New...** $\rightarrow$ chọn **Project**.
3. Chọn Repository GitHub bạn vừa tải lên $\rightarrow$ bấm **Import**.

### Bước 3: Cài đặt Biến Môi Trường (Environment Variables)
Trước khi bấm Deploy (hoặc vào mục **Settings > Environment Variables**), thêm các biến sau:

| Tên biến (Key) | Giá trị mẫu | Ý nghĩa |
| :--- | :--- | :--- |
| `API1_URL` | `https://account.garena.com/api/account/recovery/init` | URL gọi Init |
| `API1_ACCOUNT` | `nghjalsss` | Tài khoản Garena mặc định |
| `API1_APP_ID` | `100001` | App ID |
| `API1_SOURCE` | `account center` | Nguồn gọi |
| `API2_URL` | `https://account.garena.com/api/account/recovery/send_otp` | URL gọi Submit OTP |
| `API2_ACTION` | `1` | Action |
| `API2_DATA` | `84123456789` | Số điện thoại nhận OTP |
| `GARENA_COOKIE` | *(chuỗi cookie lấy từ F12)* | Vượt tường lửa DataDome |
| `CRON_SECRET` | `my_secure_cron_secret_2026` | Mã bảo mật của bạn |

Bấm **Deploy**.

### Bước 4: Kiểm tra và theo dõi trên Vercel
- **Xem giao diện Web:** Truy cập đường link dự án của bạn (ví dụ: `https://ten-du-an.vercel.app`).
- **Xem lịch Cron:** Vào **Settings** $\rightarrow$ **Cron Jobs** $\rightarrow$ bạn sẽ thấy job `/api/cron` được kích hoạt chạy mỗi 2 ngày.
- **Xem Logs:** Vào mục **Logs** trên Vercel Dashboard để theo dõi nhật ký mỗi lần chạy.

---

## 6. Quản lý tài khoản từ giao diện tĩnh

Khi đã deploy lên Vercel, bất kỳ khi nào bạn muốn đổi sang tài khoản Garena khác:
1. Mở trang web Vercel của bạn trên điện thoại hoặc máy tính (`https://ten-du-an.vercel.app`).
2. Nhập tài khoản mới vào ô **Tài khoản Garena (API1_ACCOUNT)**.
3. Bấm **Lưu Cấu Hình**.
4. Toàn bộ các chu kỳ chạy tự động định kỳ tiếp theo sẽ tự động chuyển sang tài khoản mới này!

---

## 7. Khắc phục sự cố thường gặp

### Lỗi 1: `HTTP 403` hoặc xuất hiện `geo.captcha-delivery.com`
- **Nguyên nhân:** Cookie DataDome bị hết hạn hoặc bạn chưa nhập Cookie.
- **Khắc phục:** Thực hiện lại mục 4 (mở F12 trên trình duyệt để lấy Cookie mới) và dán vào ô Cookie trên giao diện web, sau đó bấm Lưu Cấu Hình.

### Lỗi 2: `Không tìm thấy trường request_id`
- **Nguyên nhân:** Tài khoản Garena không tồn tại, sai định dạng hoặc hệ thống Garena tạm thời bảo trì.
- **Khắc phục:** Kiểm tra lại tên tài khoản trên web Garena xem có gửi được OTP thủ công hay không.

### Lỗi 3: Muốn đổi tần suất chạy (ví dụ 1 ngày/lần thay vì 2 ngày/lần)
- Mở file `vercel.json`:
  - 2 ngày 1 lần: `"schedule": "0 0 */2 * *"`
  - 1 ngày 1 lần (vào 0h UTC): `"schedule": "0 0 * * *"`
  - Mỗi 12 tiếng: `"schedule": "0 */12 * * *"` *(yêu cầu Vercel Pro nếu chạy nhiều hơn 1 lần/ngày).*
- Lưu lại và commit đẩy lên GitHub, Vercel sẽ tự động cập nhật lịch mới.
