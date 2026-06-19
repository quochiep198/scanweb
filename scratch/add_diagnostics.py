import json

def add_diagnostics():
    path = "scratch/colab_custom.ipynb"
    with open(path, "r", encoding="utf-8") as f:
        nb = json.load(f)

    modified = False
    for cell in nb.get("cells", []):
        if cell.get("cell_type") == "code":
            source = cell.get("source", [])
            for idx, line in enumerate(source):
                if "Hardware allocated:" in line:
                    # Let's insert diagnostic print lines right before or after this line
                    diag_lines = [
                        '        write_log(f"Torch version: {torch.__version__}", db, history_id)\n',
                        '        write_log(f"Torch CUDA version: {torch.version.cuda}", db, history_id)\n',
                        '        if hasattr(torch.cuda, "get_arch_list"):\n',
                        '            write_log(f"Torch CUDA architectures: {torch.cuda.get_arch_list()}", db, history_id)\n',
                        '        import torchvision\n',
                        '        write_log(f"Torchvision version: {torchvision.__version__}", db, history_id)\n',
                    ]
                    # Insert after the Hardware allocated line
                    source = source[:idx+1] + diag_lines + source[idx+1:]
                    cell["source"] = source
                    modified = True
                    print("Successfully added diagnostics to notebook code cell!")
                    break
            if modified:
                break

    if modified:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(nb, f, indent=2)
    else:
        print("Could not find 'Hardware allocated:' in the notebook cells.")

if __name__ == "__main__":
    add_diagnostics()
