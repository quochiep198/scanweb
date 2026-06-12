import json
import os

new_dataset_lines = [
    "class OsteoporosisDataset(Dataset):\n",
    "    def __init__(self, metadata: list, use_augmentation: bool = True):\n",
    "        self.metadata = metadata\n",
    "        self.use_augmentation = use_augmentation\n",
    "        self.cached_images = {}\n",
    "        \n",
    "        print(f\"Pre-loading and preprocessing {len(metadata)} images into RAM cache...\")\n",
    "        success_count = 0\n",
    "        for idx, record in enumerate(metadata):\n",
    "            image_path = record[\"image_path\"]\n",
    "            try:\n",
    "                safe_filename = image_path.replace(\"/\", \"_\")\n",
    "                local_path = os.path.join(\"tmp\", \"training_images\", safe_filename)\n",
    "                if not os.path.exists(local_path):\n",
    "                    continue\n",
    "                with open(local_path, \"rb\") as f:\n",
    "                    image_bytes = f.read()\n",
    "                filename = image_path.split(\"/\")[-1]\n",
    "                np_arr = ImageLoaderService.load_image_to_numpy(image_bytes, filename)\n",
    "                xray_arr = XRayAnalyzerService.preprocess_xray(np_arr)\n",
    "                self.cached_images[idx] = xray_arr\n",
    "                success_count += 1\n",
    "            except Exception as e:\n",
    "                print(f\"   -> Warning: Failed to pre-load image {image_path}: {e}\")\n",
    "        print(f\"Pre-loaded successfully {success_count}/{len(metadata)} images.\")\n",
    "\n",
    "    def __len__(self):\n",
    "        return len(self.metadata)\n",
    "\n",
    "    def __getitem__(self, idx: int):\n",
    "        record = self.metadata[idx]\n",
    "        try:\n",
    "            if idx in self.cached_images:\n",
    "                xray_arr = self.cached_images[idx]\n",
    "            else:\n",
    "                # Fallback in case caching failed\n",
    "                image_path = record[\"image_path\"]\n",
    "                safe_filename = image_path.replace(\"/\", \"_\")\n",
    "                local_path = os.path.join(\"tmp\", \"training_images\", safe_filename)\n",
    "                if not os.path.exists(local_path):\n",
    "                    raise FileNotFoundError(f\"Local file {local_path} not found\")\n",
    "                with open(local_path, \"rb\") as f:\n",
    "                    image_bytes = f.read()\n",
    "                filename = image_path.split(\"/\")[-1]\n",
    "                np_arr = ImageLoaderService.load_image_to_numpy(image_bytes, filename)\n",
    "                xray_arr = XRayAnalyzerService.preprocess_xray(np_arr)\n",
    "                self.cached_images[idx] = xray_arr\n",
    "                \n",
    "            image_tensor = MonaiProcessingService.process_image(xray_arr, self.use_augmentation)\n",
    "            \n",
    "            age = float(record[\"age\"]) if record[\"age\"] is not None else 0.0\n",
    "            sex_val = 2.0\n",
    "            if record[\"sex\"] == \"M\":\n",
    "                sex_val = 0.0\n",
    "            elif record[\"sex\"] == \"F\":\n",
    "                sex_val = 1.0\n",
    "            bmi = float(record[\"bmi\"]) if record[\"bmi\"] is not None else 0.0\n",
    "            metadata_tensor = torch.tensor([age, sex_val, bmi], dtype=torch.float32)\n",
    "            \n",
    "            label_str = str(record[\"label\"]).lower().strip() if record[\"label\"] is not None else \"normal\"\n",
    "            label_map = {\"normal\": 0, \"osteopenia\": 1, \"osteoporosis\": 2}\n",
    "            label_tensor = torch.tensor(label_map.get(label_str, 0), dtype=torch.long)\n",
    "            \n",
    "            t_score_val = float(record[\"t_score\"]) if record.get(\"t_score\") is not None else float('nan')\n",
    "            t_score_tensor = torch.tensor(t_score_val, dtype=torch.float32)\n",
    "            \n",
    "            return {\n",
    "                \"image\": image_tensor,\n",
    "                \"metadata\": metadata_tensor,\n",
    "                \"label\": label_tensor,\n",
    "                \"t_score\": t_score_tensor\n",
    "            }\n",
    "        except Exception as e:\n",
    "            import random\n",
    "            if not hasattr(self, \"_failed_indices\"):\n",
    "                self._failed_indices = set()\n",
    "            self._failed_indices.add(idx)\n",
    "            available_indices = [i for i in range(len(self.metadata)) if i not in self._failed_indices]\n",
    "            if not available_indices: \n",
    "                raise e\n",
    "            next_idx = random.choice(available_indices)\n",
    "            return self.__getitem__(next_idx)\n"
]

def update_notebook_dataset(filepath):
    print(f"Updating dataset in {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    updated = False
    for cell in data["cells"]:
        if cell["cell_type"] == "code":
            source_str = "".join(cell["source"])
            if "class OsteoporosisDataset(Dataset):" in source_str:
                # Replace this cell's source with the new class definition
                # Keep other imports/definitions in the same cell if any
                # Let's inspect where class OsteoporosisDataset(Dataset): begins
                lines = cell["source"]
                start_idx = -1
                for idx, line in enumerate(lines):
                    if "class OsteoporosisDataset(Dataset):" in line:
                        start_idx = idx
                        break
                if start_idx != -1:
                    cell["source"] = lines[:start_idx] + new_dataset_lines
                    updated = True
                    print(f"Found and updated OsteoporosisDataset in {filepath}!")
                    break
                    
    if updated:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        print(f"Successfully wrote updates to {filepath}")
    else:
        print(f"Failed to find target class in {filepath}")

update_notebook_dataset("scratch/colab_custom.ipynb")
update_notebook_dataset("scratch/colab_training_notebook.ipynb")
print("Finished!")
