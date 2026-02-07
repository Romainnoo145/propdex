"""Email sending utilities for authentication flows."""

import logging

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.core.config import settings

logger = logging.getLogger(__name__)

# FastMail configuration
mail_config = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=bool(settings.MAIL_USERNAME),
    VALIDATE_CERTS=True,
)

fm = FastMail(mail_config)


async def send_verification_email(email: str, token: str) -> None:
    """
    Send email verification link to user.

    Args:
        email: User's email address
        token: JWT verification token

    Note:
        Fails gracefully in development if mail server not configured.
        Logs verification URL to console for testing.
    """
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

    # Always log URL for dev testing (no mail server needed)
    print(f"\n[EMAIL VERIFICATION] URL for {email}:")
    print(f"  {verification_url}\n")
    logger.info(f"[EMAIL VERIFICATION] URL for {email}: {verification_url}")

    # Try to send email, but don't crash if it fails
    if not settings.MAIL_USERNAME:
        logger.warning("Mail server not configured - verification email not sent")
        return

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .button {{
                display: inline-block;
                padding: 12px 24px;
                background-color: #007bff;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 4px;
                margin: 20px 0;
            }}
            .footer {{ font-size: 12px; color: #666; margin-top: 30px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Verify Your Email</h2>
            <p>Thank you for registering with CRM Plus. Please verify your email address to complete your registration.</p>
            <p>
                <a href="{verification_url}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">{verification_url}</p>
            <p>This link will expire in 48 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <div class="footer">
                <p>CRM Plus - Property Intelligence Platform</p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        message = MessageSchema(
            subject="Verify Your Email - CRM Plus",
            recipients=[email],
            body=html_body,
            subtype=MessageType.html,
        )
        await fm.send_message(message)
        logger.info(f"Verification email sent to {email}")
    except Exception as e:
        logger.warning(f"Failed to send verification email to {email}: {e}")


async def send_password_reset_email(email: str, token: str) -> None:
    """
    Send password reset link to user.

    Args:
        email: User's email address
        token: JWT reset token

    Note:
        Fails gracefully in development if mail server not configured.
        Logs reset URL to console for testing.
    """
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    # Always log URL for dev testing (no mail server needed)
    print(f"\n[PASSWORD RESET] URL for {email}:")
    print(f"  {reset_url}\n")
    logger.info(f"[PASSWORD RESET] URL for {email}: {reset_url}")

    # Try to send email, but don't crash if it fails
    if not settings.MAIL_USERNAME:
        logger.warning("Mail server not configured - password reset email not sent")
        return

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .button {{
                display: inline-block;
                padding: 12px 24px;
                background-color: #dc3545;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 4px;
                margin: 20px 0;
            }}
            .warning {{
                background-color: #fff3cd;
                border: 1px solid #ffc107;
                padding: 12px;
                border-radius: 4px;
                margin: 20px 0;
            }}
            .footer {{ font-size: 12px; color: #666; margin-top: 30px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Reset Your Password</h2>
            <p>You requested to reset your password for your CRM Plus account.</p>
            <p>
                <a href="{reset_url}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">{reset_url}</p>
            <div class="warning">
                <strong>Security Notice:</strong> This link will expire in 1 hour.
                If you didn't request this reset, please ignore this email and your password will remain unchanged.
            </div>
            <div class="footer">
                <p>CRM Plus - Property Intelligence Platform</p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        message = MessageSchema(
            subject="Reset Your Password - CRM Plus",
            recipients=[email],
            body=html_body,
            subtype=MessageType.html,
        )
        await fm.send_message(message)
        logger.info(f"Password reset email sent to {email}")
    except Exception as e:
        logger.warning(f"Failed to send password reset email to {email}: {e}")
