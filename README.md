# Muse Studio — mã nguồn mở bằng VS Code

Phiên bản: 0.2.0. Bản sao mã nguồn ngày 01/11/2026.

## Dự án dùng ngôn ngữ gì?

- **HTML**: bố cục trang.
- **CSS**: màu sắc, kích thước, giao diện và bố cục thích ứng.
- **JavaScript thuần (ES modules)**: dự án, prompt, media, tài khoản và lập kế hoạch phân luồng.
- **Python** chỉ dùng để mở máy chủ web cục bộ khi chạy thử. Logic ứng dụng hiện không viết bằng Python.
- Không dùng React/Vue, không cần cài gói npm để mở giao diện. Chưa có backend Muse.

## Mở và chạy trên Windows 10

1. Giải nén file ZIP ra một thư mục, ví dụ `D:\Huy-Video-Studio`.
2. Mở VS Code, chọn **File → Open Folder**, chọn thư mục có file README này.
3. Chọn **Terminal → New Terminal**.
4. Chạy lệnh sau từ thư mục dự án:

   ```powershell
   py -3 -m http.server 8765 --bind 127.0.0.1 --directory dist
   ```

   Nếu máy không nhận lệnh `py`, dùng:

   ```powershell
   python -m http.server 8765 --bind 127.0.0.1 --directory dist
   ```

5. Mở trình duyệt và nhập **http://127.0.0.1:8765**.
6. Sửa mã trong VS Code, nhấn **Ctrl+S**, rồi tải lại trang bằng **Ctrl+F5**.
7. Khi xong, nhấn **Ctrl+C** trong terminal để dừng máy chủ.

Có thể nhấp đúp `CHAY_TREN_WINDOWS.cmd` để chạy cùng máy chủ này. Giữ cửa sổ đó mở trong lúc sử dụng. Bạn vẫn cần mở địa chỉ trên trong trình duyệt.

Không mở `dist/index.html` bằng cách nhấp đúp: dự án dùng JavaScript modules, cần chạy qua địa chỉ localhost.

Nếu cổng 8765 đang được ứng dụng khác sử dụng, thay số cổng trong lệnh và địa chỉ trình duyệt, ví dụ 8766. Dữ liệu trình duyệt gắn với địa chỉ/cổng; giữ cùng một địa chỉ cho các lần sử dụng.

## Sửa file nào?

| File | Nội dung |
| --- | --- |
| `dist/index.html` | Bố cục, các ô nhập, bảng tác vụ, cửa sổ tài khoản |
| `dist/styles.css` | Màu sắc, font chữ, kích thước, bố cục |
| `dist/app.js` | Thao tác trên giao diện, lưu dữ liệu, nhập/xuất file |
| `dist/queue-core.js` | Tách prompt và phân tác vụ theo credit/số luồng |
| `queue-core.test.mjs` | Kiểm tra logic phân luồng |
| `package.json` | Khai báo JavaScript module và lệnh kiểm tra |
| `CHAY_TREN_WINDOWS.cmd` | Chạy thử trên Windows bằng Python |
| `.vscode/tasks.json` | Tác vụ chạy thử trong VS Code |

Trong VS Code có thể dùng **Terminal → Run Task → Chạy Muse Studio (Python)**.

## Đang hoạt động

- Tạo, đổi tên và chuyển dự án.
- Chuẩn bị tác vụ Prompt → Video, Tạo ảnh, Ảnh → Video.
- Nhập nhiều prompt theo dòng, dòng trống hoặc ký tự ngăn cách.
- Lưu ảnh tham chiếu; nhập ảnh/video kết quả có sẵn để xem hoặc tải lại.
- Quản lý danh sách email tài khoản, số credit nhập tay và 1–4 luồng dự kiến.
- Lập kế hoạch phân luồng theo credit dự kiến: bỏ qua tài khoản tắt, hết credit hoặc chưa biết số dư; không giao trùng tác vụ và không trừ credit thật.
- Chỉnh sửa, sao chép, nhân bản, tìm kiếm, lọc, xóa/hoàn tác.
- Xuất/nhập dự án JSON, xuất prompt TXT.

## Chưa hoàn thành

- Chưa đăng nhập nhiều tài khoản Muse bằng các phiên độc lập trong tool.
- Chưa gửi hoặc xác thực OTP từ tool.
- Chưa đọc số credit thật từ Muse.
- Chưa tự gửi yêu cầu tạo ảnh/video, theo dõi tiến độ hoặc tải kết quả từ Muse.
- Nút “Chạy” hiện mở phần thiết lập tài khoản; không gửi tác vụ thật.
- “Xếp luồng thử” chỉ tính kế hoạch cho dự án đang chọn, không chạy nền.

Ba tab tạo nội dung là các chế độ chuẩn bị yêu cầu. Chúng chưa kết nối dịch vụ tạo nội dung. Số luồng, chi phí và thời lượng trong giao diện chưa được đối chiếu với giới hạn Muse thực tế.

Để hoàn thiện cần nối API được Muse hỗ trợ, hoặc thiết kế bộ chạy cục bộ phù hợp sau khi xác minh quy trình tạo nội dung. Mỗi tài khoản dùng đồng thời cần phiên riêng; nhiều tab của một trình duyệt vẫn có thể dùng chung phiên đăng nhập.

## Dữ liệu được lưu ở đâu?

- Prompt, danh sách tài khoản và thông số: localStorage của trình duyệt.
- File ảnh/video: IndexedDB của trình duyệt.
- Chưa có đồng bộ giữa trình duyệt hoặc giữa bản web và bản chạy trên máy.
- Để chuyển prompt từ bản web, dùng **Xuất dự án**, rồi **Nhập dự án .json** trên bản chạy cục bộ.
- File JSON không chứa nội dung ảnh/video. Cần giữ và nhập lại file media gốc.
- Mã nguồn này không kèm email, OTP, cookie, token, phiên đăng nhập hoặc thông tin triển khai của tài khoản thật.

## Kiểm tra logic (không bắt buộc để mở giao diện)

Nếu đã cài Node.js:

```powershell
node queue-core.test.mjs
```

Hoặc chạy `npm test`. Không cần `npm install` vì không có dependency.

Các kiểm tra hiện có: tách prompt, giới hạn credit, giới hạn luồng, không giao trùng và không trừ credit khi chỉ lập kế hoạch. Chưa kiểm tra giao diện trực tiếp trên Windows và chưa kiểm tra tích hợp Muse.

# toolmuse