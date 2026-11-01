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
| `MO_TAI_KHOAN.cmd` + `tools/mo-tai-khoan.ps1` | Mở mỗi tài khoản Muse trong một hồ sơ Chrome/Edge riêng |
| `tai-khoan.example.txt` | Mẫu danh sách tài khoản cho script |

Trong VS Code có thể dùng **Terminal → Run Task → Chạy Muse Studio (Python)**.

## Dùng nhiều tài khoản Muse (điều phối thủ công)

Tool **không** tự đăng nhập, không đọc mã 6 số và không tự bấm tạo video. Tool giúp bạn:
mở mỗi tài khoản trong một cửa sổ trình duyệt riêng, chia prompt cho từng tài khoản, và theo dõi tiến độ.

### Bước 1 — Nhập tài khoản vào tool

1. Bấm **Tài khoản** ở góc trên bên phải.
2. Thêm từng email, credit hiện có và số luồng. Nếu tài khoản có link hộp thư để lấy mã, dán vào ô **Link hộp thư lấy mã**.
3. Nhập **Credit dự kiến / tác vụ**.
4. Bấm **Tải danh sách cho MO_TAI_KHOAN.cmd**. File `tai-khoan.txt` sẽ nằm trong thư mục Downloads.

### Bước 2 — Mở mỗi tài khoản trong một cửa sổ riêng

1. Nhấp đúp **`MO_TAI_KHOAN.cmd`** trong thư mục dự án (cần Google Chrome hoặc Microsoft Edge).
2. Script tự tìm `tai-khoan.txt` (trong thư mục dự án, hoặc file mới nhất trong Downloads) và hiện danh sách đánh số.
   Số thứ tự trùng với **Tài khoản 1, 2, 3…** trong tool.
3. Gõ số cần mở: `1`, `1 3 5`, `1-4`, hoặc `A` để mở tất cả. Gõ `Q` để thoát.
4. **Lần đầu** với mỗi tài khoản: trên trang muse.ai nhập email → mở link hộp thư (script mở kèm nếu có) → lấy mã 6 số → nhập vào Muse.
5. **Các lần sau** cửa sổ đó đã nhớ đăng nhập, không cần nhập mã lại (trừ khi Muse đăng xuất).

Mỗi tài khoản có hồ sơ trình duyệt riêng tại `%LOCALAPPDATA%\MuseStudio\profiles\<email>`. Vì vậy 10 cửa sổ mở cùng lúc không đè đăng nhập của nhau.
Để đăng xuất hẳn một tài khoản khỏi máy, đóng cửa sổ đó rồi xóa thư mục hồ sơ tương ứng.
Mẹo: trong mỗi cửa sổ, bấm biểu tượng hồ sơ → **Tùy chỉnh** để đặt tên/màu (ví dụ "TK 3") cho dễ phân biệt.

Muốn tự sửa danh sách bằng tay: xem mẫu `tai-khoan.example.txt` (mỗi dòng: `email [link lấy mã]`).
`tai-khoan.txt` đã được đưa vào `.gitignore` để email không bị đẩy lên GitHub.

### Bước 3 — Điều phối

1. Nhập prompt và bấm **Thêm vào hàng đợi**.
2. Bấm **Điều phối**. Tool tự xếp luồng (nếu chưa xếp) và mở **Bảng điều phối**: mỗi tài khoản có danh sách cảnh riêng.
3. Với từng tài khoản: bấm **Sao chép prompt kế tiếp** → dán vào Muse trong **đúng cửa sổ của tài khoản đó** → bấm tạo → tick **Đã gửi**.
4. Khi video xong, tải về máy rồi bấm nút nhập (mũi tên lên) ở cảnh đó.
5. Khi credit thay đổi, sửa số credit trong **Tài khoản** rồi bấm **Xếp lại luồng**. Cảnh đã gửi giữ nguyên tài khoản, chỉ các cảnh chưa gửi được chia lại.

## Đang hoạt động

- Tạo, đổi tên và chuyển dự án.
- Chuẩn bị tác vụ Prompt → Video, Tạo ảnh, Ảnh → Video.
- Nhập nhiều prompt theo dòng, dòng trống hoặc ký tự ngăn cách.
- Lưu ảnh tham chiếu; nhập ảnh/video kết quả có sẵn để xem hoặc tải lại.
- Quản lý danh sách email tài khoản, số credit nhập tay và 1–4 luồng dự kiến.
- Lập kế hoạch phân luồng theo credit dự kiến: bỏ qua tài khoản tắt, hết credit hoặc chưa biết số dư; không giao trùng tác vụ và không trừ credit thật.
- Chỉnh sửa, sao chép, nhân bản, tìm kiếm, lọc, xóa/hoàn tác.
- Xuất/nhập dự án JSON, xuất prompt TXT.
- Mở mỗi tài khoản trong hồ sơ trình duyệt riêng (`MO_TAI_KHOAN.cmd`).
- Bảng điều phối: sao chép prompt kế tiếp cho từng tài khoản, đánh dấu đã gửi, nhập kết quả.

## Chưa hoàn thành

- Tool không tự đăng nhập, không đọc hay nhập mã 6 số (bạn làm trên trang Muse).
- Chưa đọc số credit thật từ Muse.
- Không tự gửi yêu cầu tạo ảnh/video, theo dõi tiến độ hoặc tải kết quả từ Muse.
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