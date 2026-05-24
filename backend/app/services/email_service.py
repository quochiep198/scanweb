import resend
import asyncio
from app.core.config import settings

# Initialize Resend client
resend.api_key = settings.RESEND_API_KEY

def send_otp_email(to_email: str, otp_code: str):
    """Send OTP code via email using Resend."""
    if not settings.RESEND_API_KEY:
        print(f"[DEV] OTP for {to_email}: {otp_code}")
        return True

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Inter', -apple-system, sans-serif; background: #f8f9fb; margin: 0; padding: 20px; }}
            .container {{ max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
            .header {{ text-align: center; margin-bottom: 24px; }}
            .logo {{ background: #003d9b; width: 48px; height: 48px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; margin-bottom: 16px; }}
            h1 {{ color: #191c1e; font-size: 24px; margin: 0 0 8px; }}
            p {{ color: #434654; font-size: 16px; line-height: 24px; margin: 0 0 24px; }}
            .otp-box {{ background: #f3f4f6; border-radius: 8px; padding: 16px 24px; text-align: center; margin: 24px 0; }}
            .otp-code {{ font-size: 32px; font-weight: 700; color: #003d9b; letter-spacing: 8px; }}
            .warning {{ font-size: 14px; color: #ba1a1a; margin-top: 24px; }}
            .footer {{ text-align: center; margin-top: 24px; font-size: 12px; color: #737685; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">OsteoScan DXA</div>
                <h1>Xác thực đặt lại mật khẩu</h1>
            </div>
            <p>Mã xác thực của bạn là:</p>
            <div class="otp-box">
                <span class="otp-code">{otp_code}</span>
            </div>
            <p class="warning">⚠️ Mã này có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.</p>
            <div class="footer">
                <p>Bản quyền © 2024 OsteoScan DXA</p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        params = {
            "from": settings.EMAIL_FROM,
            "to": [to_email],  # Resend expects array
            "subject": "Mã xác thực OsteoAI - Đặt lại mật khẩu",
            "html": html_content,
        }
        result = resend.Emails.send(params)
        print(f"[EMAIL] OTP sent to {to_email}, id: {result}")
        return True
    except resend.errors.ResendError as e:
        print(f"[EMAIL ERROR] Resend API Error: {e}")
        return False
    except Exception as e:
        print(f"[EMAIL ERROR] Unexpected error: {e}")
        return False


def send_verification_email(to_email: str, name: str, verification_token: str = ""):
    """Send account verification email."""
    if not settings.RESEND_API_KEY:
        print(f"[DEV] Verification email to {to_email}")
        return True

    # Build verification URL
    frontend_url = "http://localhost:3000"  # In production, use actual frontend URL
    verify_url = f"{frontend_url}/verify-email?token={verification_token}" if verification_token else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Inter', -apple-system, sans-serif; background: #f8f9fb; margin: 0; padding: 20px; }}
            .container {{ max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
            .header {{ text-align: center; margin-bottom: 24px; }}
            .logo {{ background: #003d9b; width: 48px; height: 48px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; margin-bottom: 16px; }}
            h1 {{ color: #191c1e; font-size: 24px; margin: 0 0 8px; }}
            p {{ color: #434654; font-size: 16px; line-height: 24px; margin: 0 0 24px; }}
            .button {{ display: inline-block; background: #003d9b; color: white; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }}
            .footer {{ text-align: center; margin-top: 24px; font-size: 12px; color: #737685; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">OsteoScan DXA</div>
                <h1>Chào mừng, {name}!</h1>
            </div>
            <p>Cảm ơn bạn đã đăng ký tài khoản OsteoScan DXA. Vui lòng xác thực email để hoàn tất đăng ký.</p>
            {'<a href="' + verify_url + '" class="button">Xác thực email</a>' if verify_url else ''}
            <p style="font-size: 12px; color: #737685; margin-top: 16px;">Hoặc copy link này vào trình duyệt:<br/><a href="' + verify_url + '" style="word-break: break-all;">' + verify_url + '</a></p>
            <div class="footer">
                <p>Bản quyền © 2024 OsteoScan DXA</p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        params = {
            "from": settings.EMAIL_FROM,
            "to": [to_email],  # Resend expects array
            "subject": "Xác thực email - OsteoAI Platform",
            "html": html_content,
        }
        result = resend.Emails.send(params)
        print(f"[EMAIL] Verification sent to {to_email}, id: {result}")
        return True
    except resend.errors.ResendError as e:
        print(f"[EMAIL ERROR] Resend API Error: {e}")
        return False
    except Exception as e:
        print(f"[EMAIL ERROR] Unexpected error: {e}")
        return False


def test_resend():
    """Test Resend API connection"""
    print(f"[TEST] Resend API Key: {settings.RESEND_API_KEY[:10]}...")
    print(f"[TEST] Email From: {settings.EMAIL_FROM}")

    try:
        result = resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": ["delivered@resend.dev"],  # Test email
            "subject": "Test Email",
            "html": "<h1>Test</h1><p>This is a test email from OsteoAI</p>",
        })
        print(f"[TEST] Result: {result}")
        return True
    except Exception as e:
        print(f"[TEST ERROR] {e}")
        return False