import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

path = "backend/tmp/kaggle_jobs/f61bc535-7791-4c91-b313-e5fc2e5cdba9/kaggle_custom.ipynb"
with open(path, "r", encoding="utf-8") as f:
    nb = json.load(f)

for idx, cell in enumerate(nb.get("cells", [])):
    if cell.get("cell_type") == "code":
        source = "".join(cell.get("source", []))
        if "Hardware allocated" in source:
            print(f"=== CELL {idx} ===")
            print(source)
            print("="*40)
