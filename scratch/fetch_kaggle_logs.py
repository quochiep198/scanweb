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
    print("STDOUT:")
    print(res.stdout)
    print("STDERR:")
    print(res.stderr)
except Exception as e:
    print(f"Error: {e}")
