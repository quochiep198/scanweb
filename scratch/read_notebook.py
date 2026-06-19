import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def read_notebook():
    with open("scratch/colab_custom.ipynb", "r", encoding="utf-8") as f:
        nb = json.load(f)
    
    for idx, cell in enumerate(nb.get("cells", [])):
        print(f"=== CELL {idx} ({cell.get('cell_type')}) ===")
        if cell.get("cell_type") == "code":
            print("".join(cell.get("source", [])))
        else:
            # For markdown, just show first line or two
            source = "".join(cell.get("source", []))
            lines = source.split("\n")
            print("\n".join(lines[:3]))
            if len(lines) > 3:
                print("...")
        print("\n" + "="*40 + "\n")

if __name__ == "__main__":
    read_notebook()
