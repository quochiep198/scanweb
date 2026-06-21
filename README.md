---
title: Scanweb API
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---
# OsteoAI Platform

Monorepo structure for OsteoAI - medical imaging data collection.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) |
| Backend | FastAPI |
| Database | Neon PostgreSQL |
| Deployment | Vercel |

## Quick Start

```bash
# Backend
cd backend
copy .env.example .env
pip install -r requirements.txt
.\.venv\Scripts\activate
uvicorn app.main:app --reload

# Frontend
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
```

## Environment Variables

### Backend: `backend/.env`

```env
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
SECRET_KEY=change-this-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
OTP_EXPIRE_MINUTES=5
OTP_MAX_ATTEMPTS=3
OTP_RATE_LIMIT_SECONDS=60
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM=OsteoAI <noreply@python.thtsolution.online>
FRONTEND_URL=http://localhost:3000
```

### Frontend: `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Triển khai thực tế (HuggingFace Spaces & Vercel)

Dự án được cấu hình chạy tối ưu theo mô hình:
- **Backend (FastAPI)** chạy trên **HuggingFace Spaces** (sử dụng Docker).
- **Frontend (Next.js)** chạy trên **Vercel**.

### 1. Triển khai Backend trên HuggingFace Spaces
1. Tạo một Space mới trên HuggingFace:
   - SDK: **Docker**
   - Chế độ: **Private** (khuyên dùng để bảo vệ mã nguồn) hoặc **Public**.
2. Đẩy toàn bộ mã nguồn lên Space. File `Dockerfile` ở thư mục gốc sẽ tự động cấu hình và khởi chạy ứng dụng ở cổng `7860`.
3. **Cấu hình Variables & Secrets trong Settings của Space**:
   Khai báo các biến môi trường từ file `backend/.env` (vì Git bỏ qua không đẩy file `.env` lên):
   - `DATABASE_URL` (Bắt buộc - Chuỗi kết nối Neon PostgreSQL)
   - `SECRET_KEY` (Chuỗi bảo mật JWT)
   - Các biến cấu hình Cloudflare R2 (nếu có: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_PUBLIC_URL`).
4. Kiểm tra xem Space đã ở trạng thái **Running** (màu xanh lá) chưa.
5. Xác định **Direct App URL** (Đường dẫn chạy trực tiếp) của Space:
   - Có định dạng: `https://<username>-<tên-space>.hf.space` (Ví dụ: `https://quochiepho-scanweb-api.hf.space`).
   - *Lưu ý: Không dùng link trang giao diện dạng `huggingface.co/spaces/...`*.

### 2. Triển khai Frontend trên Vercel
1. Liên kết và nhập dự án của bạn trên Vercel.
2. Thiết lập cấu hình dự án:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Next.js`
3. **Cấu hình Environment Variables trên Vercel**:
   - **`NEXT_PUBLIC_API_URL`**: Điền **Direct App URL** của HuggingFace Space ở trên (Ví dụ: `https://quochiepho-scanweb-api.hf.space` - *Lưu ý không thêm dấu gạch chéo `/` ở cuối*).
   - **Nếu HuggingFace Space của bạn là Private**:
     - Thêm biến **`HF_TOKEN`**: Điền mã HuggingFace Access Token của bạn (Tạo trong HuggingFace Settings -> Access Tokens -> chọn loại **Read**).
     - Token này giúp Vercel vượt qua lớp bảo mật để gọi API của Space Private một cách an toàn.
4. **Lưu ý quan trọng khi thay đổi cấu hình**:
   - Mỗi lần thay đổi các biến môi trường (`NEXT_PUBLIC_API_URL` hoặc `HF_TOKEN`) trên Vercel, bạn bắt buộc phải **Re-deploy** dự án thì cấu hình mới mới có hiệu lực trên server.

## Project Structure

```
scanweb/
├── backend/           # FastAPI
│   └── app/
│       ├── core/      # Config, DB, Security
│       ├── models/    # SQLAlchemy models
│       ├── schemas/   # Pydantic schemas
│       ├── services/  # Business logic
│       ├── api/       # Routes
│       └── main.py
├── frontend/          # Next.js
│   ├── app/           # App Router pages
│   ├── components/    # UI components
│   ├── lib/           # API client, utils
│   └── hooks/         # Custom hooks
└── docs/
    └── rules/         # Architecture guidelines
```

## Documentation

- [Architecture Overview](./docs/rules/architecture.md)
- [Backend Guidelines](./docs/rules/backend.md)
- [Frontend Guidelines](./docs/rules/frontend.md)

## Test1