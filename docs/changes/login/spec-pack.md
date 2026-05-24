# Gói đặc tả chức năng Login

> Tạo: 2026-04-03 · Giai đoạn: 1  
> **Nguồn tham chiếu duy nhất cho thay đổi này.**  
> Không triển khai bất kỳ nội dung nào không được viết ở đây. Các điểm chưa rõ → Open Issues.

---

## 1. Bối cảnh / Mục đích
Hiện tại mong muốn triển khai màn hình login cho ứng dụng OsteoAI Platform. Người dùng cần xác thực trước khi truy cập vào hệ thống thu thập dữ liệu hình ảnh y tế.

---

## 2. Phạm vi

### Trong phạm vi
- Màn hình đăng nhập bằng email + password
- Nút đăng ký cho người dùng chưa có tài khoản
- JWT Authentication (Access + Refresh tokens)
- Hỗ trợ HTTPBearer cho protected route
- Quên mật khẩu: gửi OTP qua email + form reset password
- Yêu cầu giao diện login phải giống với raw/login

### Ngoài phạm vi
- OAuth2 (Google, Facebook) — giai đoạn sau
- 2FA/MFA — giai đoạn sau
- Social login — giai đoạn sau

---

## 3. Thuật ngữ

| #  | Thuật ngữ | Định nghĩa |
|----|-----------|------------|
| 1  | JWT (JSON Web Token) | Token dạng JSON dùng để xác thực người dùng |
| 2  | Access Token | Token ngắn hạn dùng để truy cập API (thường 15-30 phút) |
| 3  | Refresh Token | Token dài hạn dùng để lấy Access Token mới (thường 7-30 ngày) |
| 4  | OTP (One-Time Password) | Mật khẩu dùng một lần, gửi qua email |
| 5  | HTTPBearer | Cơ chế xác thực qua header Authorization: Bearer <token> |
| 6  | Protected Routes | Các route cần xác thực mới được truy cập |

---

## 4. Hiện trạng / Trạng thái mục tiêu

| #  | Khía cạnh | Hiện trạng | Trạng thái mục tiêu |
|----|-----------|------------|---------------------|
| 1  | Xác thực người dùng | Chưa có hệ thống auth | Đăng nhập bằng email/password với JWT |
| 2  | Đăng ký tài khoản | Chưa có | Người dùng mới có thể đăng ký |
| 3  | Quên mật khẩu | Chưa có | Gửi OTP qua email + reset password |
| 4  | Bảo mật API | Không có | Tất cả API protected dùng JWT Bearer |

---

## 5. Chi tiết đặc tả

### 5.1 LOGIN-001 — Màn hình đăng nhập

**Pre-conditions:**
- Người dùng chưa đăng nhập (không có valid token).

**Luồng chính:**
1. Người dùng nhập email vào ô "Email".
2. Người dùng nhập password vào ô "Password".
3. Người dùng nhấn nút "Đăng nhập".
4. Hệ thống gửi request POST `/api/v1/auth/login`.
5. Backend validate credentials.
6. Backend trả về access_token và refresh_token.
7. Frontend lưu tokens vào localStorage/cookies.
8. Frontend chuyển hướng đến trang Dashboard.

**Luồng phụ:**
1. Nếu email/password sai → hiển thị thông báo lỗi "Email hoặc mật khẩu không đúng".
2. Nếu email chưa đăng ký → hiển thị thông báo "Tài khoản không tồn tại".

**Business rules:**
- BR-1: Email phải có định dạng hợp lệ (regex validation).
- BR-2: Password tối thiểu 8 ký tự.
- BR-3: Access token expire sau 15 phút.
- BR-4: Refresh token expire sau 7 ngày.
- BR-5: Sau 5 lần đăng nhập thất bại → khóa tài khoản 15 phút.

**Post-conditions:** Người dùng đăng nhập thành công, được chuyển đến Dashboard.

---

### 5.2 LOGIN-002 — Màn hình đăng ký

**Pre-conditions:**
- Người dùng chưa có tài khoản.

**Luồng chính:**
1. Người dùng nhấn link "Đăng ký" từ màn hình login.
2. Hiển thị form đăng ký với các trường: Họ tên, Email, Password, Xác nhận password.
3. Người dùng điền thông tin và nhấn "Đăng ký".
4. Backend tạo user mới.
5. Backend gửi email xác thực (verify email).
6. Hiển thị thông báo "Đăng ký thành công, vui lòng kiểm tra email để xác thực".

**Business rules:**
- BR-6: Email phải là duy nhất trong hệ thống.
- BR-7: Password phải >= 8 ký tự, có ít nhất 1 chữ hoa, 1 chữ thường, 1 số.
- BR-8: Password và Xác nhận password phải giống nhau.
- BR-9: Họ tên bắt buộc, tối thiểu 2 ký tự.

**Post-conditions:** Tài khoản được tạo, chờ xác thực email.

---

### 5.3 LOGIN-003 — Quên mật khẩu

**Luồng chính:**
1. Người dùng nhấn link "Quên mật khẩu".
2. Hiển thị form nhập email.
3. Người dùng nhập email và nhấn "Gửi mã OTP".
4. Backend tạo OTP (6 số), lưu với thời hạn 5 phút.
5. Backend gửi email chứa mã OTP.
6. Hiển thị form nhập OTP + Password mới.
7. Người dùng nhập OTP và password mới.
8. Backend verify OTP và cập nhật password.
9. Hiển thị thông báo "Đặt lại mật khẩu thành công".

**Business rules:**
- BR-10: OTP có 6 chữ số, expire sau 5 phút.
- BR-11: Mỗi email chỉ gửi được 1 OTP trong 1 phút.
- BR-12: OTP chỉ được nhập sai tối đa 3 lần, sau đó phải yêu cầu OTP mới.
- BR-13: Password mới phải thỏa mãn BR-7.

**Post-conditions:** Password được cập nhật, người dùng có thể đăng nhập với password mới.

---

### 5.4 LOGIN-004 — Refresh Token

**Pre-conditions:**
- Access token hết hạn.

**Luồng chính:**
1. Frontend nhận được response 401 Unauthorized.
2. Frontend gửi request POST `/api/v1/auth/refresh` với refresh_token.
3. Backend verify refresh_token và trả về access_token mới.
4. Frontend tiếp tục request ban đầu với token mới.

**Business rules:**
- BR-14: Refresh token chỉ dùng để lấy access token mới.
- BR-15: Khi refresh token hết hạn → user phải đăng nhập lại.

**Post-conditions:** Người dùng tiếp tục sử dụng mà không cần đăng nhập lại.

---

## 6. Yêu cầu phi chức năng

| #  | Danh mục | Yêu cầu |
|----|----------|---------|
| 1  | Hiệu năng | Login response < 500ms (không tính network) |
| 2  | Bảo mật | Password được hash (bcrypt), không lưu plain text |
| 3  | Bảo mật | Refresh token stored securely, HTTPOnly cookie |
| 4  | Bảo mật | Rate limit: 5 login attempts/15 phút/tài khoản |
| 5  | Tính sẵn sàng | 99.9% uptime cho auth service |
| 6  | Khả năng quan sát | Log tất cả attempts (success/failure) với IP |
| 7  | Scalability | Support 1000 concurrent users |

---

## 7. Tiêu chí chấp nhận

| #  | ID | Mô tả | Loại kiểm thử |
|----|----|-------|---------------|
| 1  | AC-LOGIN-1 | Đăng nhập với email/password đúng → chuyển đến Dashboard | E2E |
| 2  | AC-LOGIN-2 | Đăng nhập với email sai → hiển thị lỗi | E2E |
| 3  | AC-LOGIN-3 | Đăng nhập với password sai → hiển thị lỗi | E2E |
| 4  | AC-LOGIN-4 | Đăng nhập 5 lần thất bại → khóa 15 phút | E2E |
| 5  | AC-LOGIN-5 | Access token hết hạn → tự động refresh | E2E |
| 6  | AC-LOGIN-6 | Refresh token hết hạn → yêu cầu đăng nhập lại | E2E |
| 7  | AC-REGISTER-1 | Đăng ký với thông tin hợp lệ → tạo tài khoản | E2E |
| 8  | AC-REGISTER-2 | Đăng ký với email đã tồn tại → báo lỗi | E2E |
| 9  | AC-FORGOT-1 | Gửi yêu cầu quên mật khẩu → nhận email OTP | E2E |
| 10 | AC-FORGOT-2 | Nhập OTP đúng + password mới → đặt lại thành công | E2E |
| 11 | AC-FORGOT-3 | Nhập OTP sai 3 lần → phải yêu cầu OTP mới | E2E |
| 12 | AC-SECURITY-1 | Password không được hash dạng plain text trong DB | IT |
| 13 | AC-SECURITY-2 | Token không leak trong URL hoặc logs | IT |

---

## 8. Ví dụ

### Các luồng bình thường

1. **Đăng nhập thành công:** User nhập email/password đúng → nhận tokens → chuyển Dashboard.
2. **Đăng ký thành công:** User điền form đăng ký → tạo tài khoản → nhận email xác thực.
3. **Quên mật khẩu:** User nhập email → nhận OTP → nhập OTP + password mới → đăng nhập được.

### Các luồng lỗi

1. **Email không tồn tại:** Nhập email chưa đăng ký → lỗi "Tài khoản không tồn tại".
2. **Sai password:** Nhập password sai → lỗi "Email hoặc mật khẩu không đúng".
3. **Format email sai:** Nhập email không hợp lệ → lỗi "Email không hợp lệ".
4. **OTP hết hạn:** Để OTP hết 5 phút → lỗi "Mã OTP đã hết hạn".
5. **Tài khoản bị khóa:** Đăng nhập sai 5 lần → lỗi "Tài khoản bị khóa 15 phút".

---

## 9. Wireframe ASCII
Tham chiếu thiết kế UI tại raw/login

### LOGIN-003 — Quên mật khẩu (Bước 1: Nhập email)

```text
+------------------------------------------+
|         Quên mật khẩu                    |
|------------------------------------------|
|                                          |
|  Nhập email đã đăng ký để nhận mã OTP   |
|                                          |
|  Email                                   |
|  [________________________]              |
|                                          |
|  [   Gửi mã OTP   ]                      |
|                                          |
|  ─────────────────────────────────────   |
|  ← Quay lại đăng nhập                   |
|                                          |
+------------------------------------------+
```

### LOGIN-003 — Quên mật khẩu (Bước 2: Nhập OTP + Password)

```text
+------------------------------------------+
|         Quên mật khẩu                    |
|------------------------------------------|
|                                          |
|  Mã OTP đã được gửi đến email@...       |
|                                          |
|  Mã OTP                                  |
|  [____]  (6 chữ số)                     |
|                                          |
|  Mật khẩu mới                            |
|  [________________________]              |
|                                          |
|  Xác nhận mật khẩu mới                   |
|  [________________________]              |
|                                          |
|  [  Đặt lại mật khẩu  ]                  |
|                                          |
|  ← Quay lại                              |
|                                          |
+------------------------------------------+
```

---

## 10. Các vấn đề mở

| #  | Câu hỏi | Người phụ trách | Hạn chót |
|----|---------|-----------------|----------|
| 1  | Cần xác thực email khi đăng ký không? | - | - |
| 2  | Thời gian khóa tài khoản sau 5 lần sai: 15 phút có phù hợp? | - | - |
| 3  | Cần giới hạn số lượng refresh token không? | - | - |

---

## 11. Rủi ro

| #  | Rủi ro | Khả năng xảy ra | Mức độ ảnh hưởng | Biện pháp giảm thiểu |
|----|--------|-----------------|------------------|----------------------|
| 1  | Brute force attack | Trung bình | Cao — leo桌上 accounts | Rate limiting + account lockout |
| 2  | Token bị leak | Thấp | Cao — unauthorized access | HTTPS only, HTTPOnly cookies |
| 3  | Password patterns yếu | Trung bình | Cao — dễ crack | Validation + bcrypt |
| 4  | Email không nhận được OTP | Trung bình | Thấp — user biết retry | Thông báo hướng dẫn |

---

## Bảng truy vết

| #  | AC | API Endpoint | DB Tables | Fields | Loại kiểm thử |
|----|----|--------------|-----------|--------|---------------|
| 1  | AC-LOGIN-1 | POST /v1/auth/login | users | email, password_hash | E2E |
| 2  | AC-REGISTER-1 | POST /v1/auth/register | users | name, email, password_hash | E2E |
| 3  | AC-FORGOT-1 | POST /v1/auth/forgot-password | users, otp_codes | email | E2E |
| 4  | AC-FORGOT-2 | POST /v1/auth/reset-password | users | password_hash | E2E |
| 5  | AC-LOGIN-5 | POST /v1/auth/refresh | refresh_tokens | token, expires_at | E2E |
| 6  | AC-SECURITY-1 | - | users | password_hash (bcrypt) | IT |

---

## API Endpoints

### POST /v1/auth/register
**Request:**
```json
{
  "name": "Nguyen Van A",
  "email": "user@example.com",
  "password": "Password123"
}
```
**Response (201):**
```json
{
  "message": "Registration successful. Please verify your email.",
  "user_id": "uuid"
}
```

### POST /v1/auth/login
**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```
**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### POST /v1/auth/refresh
**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```
**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### POST /v1/auth/forgot-password
**Request:**
```json
{
  "email": "user@example.com"
}
```
**Response (200):**
```json
{
  "message": "OTP sent to your email"
}
```

### POST /v1/auth/reset-password
**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "new_password": "NewPassword123"
}
```
**Response (200):**
```json
{
  "message": "Password reset successful"
}
```