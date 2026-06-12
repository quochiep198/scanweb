import sys
import os
from dotenv import load_dotenv

# Load env variables from backend/.env
load_dotenv("backend/.env")

# Add backend directory to path
sys.path.append(os.path.abspath("backend"))

import torch
from app.models.efficientnet_model import OsteoporosisEfficientNetB3
from app.services.grad_cam_service import GradCamService

def test():
    print("Initializing model...")
    model = OsteoporosisEfficientNetB3(num_classes=3, pretrained=False)
    
    # Check if we can load weights or just use random ones
    if os.path.exists("models/best_model.pt"):
        print("Loading weights...")
        model.load_state_dict(torch.load("models/best_model.pt", map_location="cpu"))
    else:
        print("Using random weights...")
        
    # Create mock inputs
    print("Creating mock inputs...")
    image_tensor = torch.randn(1, 1, 300, 300)
    metadata_tensor = torch.tensor([[50.0, 1.0, 22.0]], dtype=torch.float32)
    
    print("Generating heatmap...")
    try:
        heatmap_bytes = GradCamService.generate_heatmap(model, image_tensor, metadata_tensor)
        if heatmap_bytes is None:
            print("FAILED: generate_heatmap returned None.")
        else:
            print(f"SUCCESS: Generated heatmap of size {len(heatmap_bytes)} bytes.")
    except Exception as e:
        print("EXCEPTION RAISED:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
