import json
import os

new_monai_lines = [
    "class MonaiProcessingService:\n",
    "    _train_transforms = None\n",
    "    _val_transforms = None\n",
    "\n",
    "    @staticmethod\n",
    "    def get_transforms(use_augmentation: bool = True):\n",
    "        if use_augmentation:\n",
    "            if MonaiProcessingService._train_transforms is None:\n",
    "                MonaiProcessingService._train_transforms = Compose([\n",
    "                    Resize(spatial_size=(300, 300)),\n",
    "                    NormalizeIntensity(),\n",
    "                    RandRotate(range_x=0.1, prob=0.5),\n",
    "                    RandZoom(min_zoom=0.9, max_zoom=1.1, prob=0.5),\n",
    "                    RandGaussianNoise(prob=0.3, mean=0.0, std=0.1),\n",
    "                    ToTensor()\n",
    "                ])\n",
    "            return MonaiProcessingService._train_transforms\n",
    "        else:\n",
    "            if MonaiProcessingService._val_transforms is None:\n",
    "                MonaiProcessingService._val_transforms = Compose([\n",
    "                    Resize(spatial_size=(300, 300)),\n",
    "                    NormalizeIntensity(),\n",
    "                    ToTensor()\n",
    "                ])\n",
    "            return MonaiProcessingService._val_transforms\n",
    "\n",
    "    @staticmethod\n",
    "    def process_image(img_array: np.ndarray, use_augmentation: bool = True) -> torch.Tensor:\n",
    "        if len(img_array.shape) == 2:\n",
    "            img_array = img_array[None, :, :]\n",
    "        elif len(img_array.shape) == 3:\n",
    "            if img_array.shape[2] in (1, 3, 4) and img_array.shape[0] not in (1, 3, 4):\n",
    "                img_array = img_array.transpose(2, 0, 1)\n",
    "        transform_pipeline = MonaiProcessingService.get_transforms(use_augmentation)\n",
    "        return transform_pipeline(img_array)\n"
]

def update_notebook_monai(filepath):
    print(f"Updating MonaiProcessingService in {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    updated = False
    for cell in data["cells"]:
        if cell["cell_type"] == "code":
            source_str = "".join(cell["source"])
            if "class MonaiProcessingService:" in source_str:
                lines = cell["source"]
                start_idx = -1
                end_idx = -1
                for idx, line in enumerate(lines):
                    if "class MonaiProcessingService:" in line:
                        start_idx = idx
                        break
                if start_idx != -1:
                    # Find end of class MonaiProcessingService (which ends before class OsteoporosisDataset)
                    for idx in range(start_idx, len(lines)):
                        if "class OsteoporosisDataset" in lines[idx]:
                            end_idx = idx
                            break
                    if end_idx == -1:
                        end_idx = len(lines)
                        
                    cell["source"] = lines[:start_idx] + new_monai_lines + lines[end_idx:]
                    updated = True
                    print(f"Found and updated MonaiProcessingService in {filepath}!")
                    break
                    
    if updated:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        print(f"Successfully wrote updates to {filepath}")
    else:
        print(f"Failed to find target class in {filepath}")

update_notebook_monai("scratch/colab_custom.ipynb")
update_notebook_monai("scratch/colab_training_notebook.ipynb")
print("Finished!")
