import os
import boto3
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class R2Service:
    @staticmethod
    def upload_file(file_content: bytes, filename: str, content_type: str) -> str:
        """
        Uploads file to Cloudflare R2.
        Falls back to mock URL if R2 credentials are not set.
        """
        account_id = settings.CLOUDFLARE_R2_ACCOUNT_ID
        access_key = settings.CLOUDFLARE_R2_ACCESS_KEY_ID
        secret_key = settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY
        bucket_name = settings.CLOUDFLARE_R2_BUCKET_NAME
        public_url = settings.CLOUDFLARE_R2_PUBLIC_URL

        # Check if R2 is configured
        if not all([account_id, access_key, secret_key, bucket_name]):
            logger.warning("Cloudflare R2 is not fully configured. Falling back to local simulated URL.")
            import uuid
            unique_filename = f"{uuid.uuid4()}_{filename}"
            # Return a local simulated path or a mock R2 URL
            mock_url = f"https://mock-r2.osteoai.com/{bucket_name or 'uploads'}/{unique_filename}"
            return mock_url

        try:
            r2_endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
            s3_client = boto3.client(
                "s3",
                endpoint_url=r2_endpoint,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name="auto"
            )
            
            import uuid
            unique_filename = f"{uuid.uuid4()}_{filename}"
            
            s3_client.put_object(
                Bucket=bucket_name,
                Key=unique_filename,
                Body=file_content,
                ContentType=content_type
            )
            
            if public_url:
                return f"{public_url.rstrip('/')}/{unique_filename}"
            else:
                return f"https://pub-{account_id}.r2.dev/{bucket_name}/{unique_filename}"
                
        except Exception as e:
            logger.error(f"Error uploading to Cloudflare R2: {e}")
            raise e
