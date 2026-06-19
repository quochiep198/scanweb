import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend to path and load .env
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

from app.core.config import settings

def main():
    os.environ["KAGGLE_USERNAME"] = settings.KAGGLE_USERNAME
    os.environ["KAGGLE_KEY"] = settings.KAGGLE_KEY
    os.environ["KAGGLE_API_TOKEN"] = settings.KAGGLE_KEY

    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    api.authenticate()

    kernel_ref = f"{settings.KAGGLE_USERNAME}/osteoai-training-job"
    print(f"Checking status for kernel: {kernel_ref}")
    try:
        res = api.kernels_status(kernel_ref)
        print(f"Status response: {res}")
        print(f"Status string: {getattr(res, 'status', None)}")
        print(f"Failure message: {getattr(res, 'failure_message', None)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
