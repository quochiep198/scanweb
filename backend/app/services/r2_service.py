import os
import boto3
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class R2Service:
    @staticmethod
    def upload_file(file_content: bytes, filename: str, content_type: str, custom_key: str = None) -> str:
        """
        Uploads file to Cloudflare R2.
        Falls back to mock URL if R2 credentials are not set.
        """
        account_id = settings.CLOUDFLARE_R2_ACCOUNT_ID
        access_key = settings.CLOUDFLARE_R2_ACCESS_KEY_ID
        secret_key = settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY
        bucket_name = settings.CLOUDFLARE_R2_BUCKET_NAME
        public_url = settings.CLOUDFLARE_R2_PUBLIC_URL

        # Determine the key to use in R2
        if custom_key:
            key_name = custom_key
        else:
            import uuid
            key_name = f"{uuid.uuid4()}_{filename}"

        # Check if R2 is configured
        if not all([account_id, access_key, secret_key, bucket_name]):
            logger.warning("Cloudflare R2 is not fully configured. Falling back to local simulated URL.")
            # Return a local simulated path or a mock R2 URL
            mock_url = f"https://mock-r2.osteoai.com/{bucket_name or 'uploads'}/{key_name}"
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
            
            s3_client.put_object(
                Bucket=bucket_name,
                Key=key_name,
                Body=file_content,
                ContentType=content_type
            )
            
            if public_url:
                # Ensure correct concatenation of URL and key_name
                base_url = public_url.rstrip('/')
                return f"{base_url}/{key_name}"
            else:
                return f"https://pub-{account_id}.r2.dev/{bucket_name}/{key_name}"
                
        except Exception as e:
            logger.error(f"Error uploading to Cloudflare R2: {e}")
            raise e

    @staticmethod
    def download_file(image_path: str) -> bytes:
        """
        Downloads a file from Cloudflare R2 based on the public URL or file name/key.
        Falls back to a mock local file read or simulated bytes if R2 credentials are not set
        or if it's a mock R2 URL.
        """
        account_id = settings.CLOUDFLARE_R2_ACCOUNT_ID
        access_key = settings.CLOUDFLARE_R2_ACCESS_KEY_ID
        secret_key = settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY
        bucket_name = settings.CLOUDFLARE_R2_BUCKET_NAME

        # Check if R2 is configured and it is not a mock URL
        if not all([account_id, access_key, secret_key, bucket_name]) or "mock-r2" in image_path:
            logger.warning(f"R2 is not configured or mock URL used. Returning simulated image bytes for path: {image_path}")
            # A minimal 1x1 PNG bytes fallback (red pixel)
            return b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\xc9\xfe\x92\xef\x00\x00\x00\x00IEND\xaeB`\x82'

        try:
            # Extract key/filename from URL path robustly
            from urllib.parse import urlparse
            parsed = urlparse(image_path)
            path = parsed.path.lstrip('/')
            
            # If path starts with bucket_name, strip it to get the correct R2 Key
            if bucket_name and path.startswith(f"{bucket_name}/"):
                key = path[len(bucket_name)+1:]
            else:
                key = path
                
            if not key:
                key = image_path.split("/")[-1]

            r2_endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
            s3_client = boto3.client(
                "s3",
                endpoint_url=r2_endpoint,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name="auto"
            )
            response = s3_client.get_object(Bucket=bucket_name, Key=key)
            return response["Body"].read()
        except Exception as e:
            logger.error(f"Error downloading from Cloudflare R2: {e}")
            raise e
