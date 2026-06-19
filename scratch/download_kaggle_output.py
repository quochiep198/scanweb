import os
import sys
import json

# Force stdout to UTF-8
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Add backend to path
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
    dest_dir = os.path.join("backend", "tmp", "kaggle_out")
    os.makedirs(dest_dir, exist_ok=True)

    print(f"Downloading output for {kernel_ref} to {dest_dir}...")
    try:
        api.kernels_output(kernel_ref, dest_dir)
        print("Download successful!")
        
        # Look for the notebook file in dest_dir
        for root, dirs, files in os.walk(dest_dir):
            for file in files:
                if file.endswith(".ipynb"):
                    nb_path = os.path.join(root, file)
                    print(f"Found notebook: {nb_path}")
                    with open(nb_path, "r", encoding="utf-8") as f:
                        nb = json.load(f)
                    
                    # Print the output of the first cell (installation)
                    print("\n=== CELL 1 OUTPUT ===")
                    cells = nb.get("cells", [])
                    if len(cells) > 1:
                        cell1 = cells[1] # usually 0 is markdown, 1 is the pip install
                        print(f"Cell 1 type: {cell1.get('cell_type')}")
                        print(f"Cell 1 source: {''.join(cell1.get('source', []))}")
                        for output in cell1.get("outputs", []):
                            if "text" in output:
                                print(output["text"])
                            elif "data" in output and "text/plain" in output["data"]:
                                print(output["data"]["text/plain"])
                    break
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
