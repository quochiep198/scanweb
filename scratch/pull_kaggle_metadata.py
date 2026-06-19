import os
import sys
import json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

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
    dest_dir = os.path.join("backend", "tmp", "kaggle_pull")
    os.makedirs(dest_dir, exist_ok=True)

    print(f"Pulling kernel metadata for {kernel_ref}...")
    try:
        # Pull kernel (this downloads notebook + metadata)
        api.kernels_pull(kernel_ref, dest_dir, metadata=True)
        print("Pull successful!")
        
        meta_path = os.path.join(dest_dir, "kernel-metadata.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            print("\n=== PULL METADATA ===")
            print(json.dumps(meta, indent=2))
        else:
            print("Metadata file not found in pulled files.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
