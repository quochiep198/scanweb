import os
import sys
import subprocess

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ["KAGGLE_USERNAME"] = "hodinhquochiep"
os.environ["KAGGLE_KEY"] = "KGAT_03ee1ca5b6915504392eedb1283842b3"
os.environ["KAGGLE_API_TOKEN"] = "KGAT_03ee1ca5b6915504392eedb1283842b3"
os.environ["PYTHONIOENCODING"] = "utf-8"

try:
    res = subprocess.run(
        ["kaggle", "kernels", "logs", "hodinhquochiep/osteoai-training-job"],
        capture_output=True,
        text=True,
        encoding="utf-8"
    )
    with open("scratch/kaggle_kernel_logs.txt", "w", encoding="utf-8") as f:
        f.write("=== STDOUT ===\n")
        f.write(res.stdout)
        f.write("\n=== STDERR ===\n")
        f.write(res.stderr)
    print("Logs written to scratch/kaggle_kernel_logs.txt successfully.")
except Exception as e:
    print(f"Error: {e}")
