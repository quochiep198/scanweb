import torch
import torch.nn as nn
import numpy as np
import matplotlib
from PIL import Image
import io
import logging

logger = logging.getLogger(__name__)

class GradCamService:
    @staticmethod
    def generate_heatmap(model: nn.Module, image_tensor: torch.Tensor, metadata_tensor: torch.Tensor) -> bytes:
        """
        Generates a Grad-CAM heatmap overlaid on the input image.
        Uses PyTorch hooks on the last convolutional layer of the EfficientNet backbone.
        """
        try:
            # 0. Set model to eval mode
            model.eval()
            
            # Clone and enable gradients on image_tensor
            image_tensor_grad = image_tensor.clone().detach().requires_grad_(True)
            metadata_tensor_grad = metadata_tensor.clone().detach()
            
            # 1. Hooks to store activations and gradients
            features = None
            gradients = None
            
            def save_activation(module, input, output):
                nonlocal features
                features = output
                
            def save_gradient(module, grad_input, grad_output):
                nonlocal gradients
                gradients = grad_output[0]
                
            # Find the last convolutional layer block in EfficientNet backbone
            target_layer = model.backbone.features[-1]
            
            forward_hook = target_layer.register_forward_hook(save_activation)
            if hasattr(target_layer, 'register_full_backward_hook'):
                backward_hook = target_layer.register_full_backward_hook(save_gradient)
            else:
                backward_hook = target_layer.register_backward_hook(save_gradient)
                
            try:
                with torch.enable_grad():
                    # Forward pass
                    logits, t_score_pred = model(image_tensor_grad, metadata_tensor_grad)
                    
                    # Backward pass on the highest probability class
                    pred_class = logits.argmax(dim=1).item()
                    score = logits[0, pred_class]
                    
                    model.zero_grad()
                    score.backward()
            except Exception as hook_err:
                logger.error(f"Error inside Grad-CAM forward/backward pass: {hook_err}")
                return None
            finally:
                # Always remove hooks to prevent memory leaks
                forward_hook.remove()
                backward_hook.remove()
                
            if features is None or gradients is None:
                logger.error("Grad-CAM hooks failed to capture activations or gradients.")
                return None
                
            # 2. Compute Grad-CAM Map
            # Mean gradients over height and width as weights
            weights = gradients.mean(dim=(2, 3), keepdim=True)
            # Weighted combination of activation channels
            grad_cam_map = (weights * features).sum(dim=1).squeeze(0)
            # Apply ReLU
            grad_cam_map = torch.relu(grad_cam_map)
            
            # Normalize map to [0, 1]
            map_min = grad_cam_map.min()
            map_max = grad_cam_map.max()
            if map_max - map_min > 0:
                grad_cam_map = (grad_cam_map - map_min) / (map_max - map_min + 1e-8)
            else:
                grad_cam_map = torch.zeros_like(grad_cam_map)
                
            grad_cam_map = grad_cam_map.cpu().detach().numpy()
            
            # 3. Reconstruct preprocessed image from image_tensor
            # image_tensor has shape (1, 1, 300, 300)
            img_np = image_tensor[0, 0].cpu().detach().numpy()
            img_min = img_np.min()
            img_max = img_np.max()
            if img_max - img_min > 0:
                img_np = ((img_np - img_min) / (img_max - img_min)) * 255.0
            else:
                img_np = np.zeros_like(img_np)
            img_np = img_np.astype(np.uint8)
            
            orig_pil = Image.fromarray(img_np).convert('RGB')
            
            # 4. Resize Grad-CAM map to image dimensions (300, 300)
            grad_cam_map_uint8 = (grad_cam_map * 255).astype(np.uint8)
            heatmap_small_pil = Image.fromarray(grad_cam_map_uint8)
            heatmap_resized_pil = heatmap_small_pil.resize((300, 300), Image.Resampling.BILINEAR)
            heatmap_resized_np = np.array(heatmap_resized_pil)
            
            # 5. Apply colormap
            cmap = matplotlib.colormaps['jet']
            heatmap_colors = cmap(heatmap_resized_np / 255.0)
            heatmap_colors = (heatmap_colors[:, :, :3] * 255).astype(np.uint8)
            
            # 6. Blend original image and heatmap
            heatmap_pil = Image.fromarray(heatmap_colors)
            blended_pil = Image.blend(orig_pil, heatmap_pil, alpha=0.5)
            
            # Save to bytes
            output_bytes = io.BytesIO()
            blended_pil.save(output_bytes, format='PNG')
            return output_bytes.getvalue()
            
        except Exception as e:
            logger.error(f"Error generating Grad-CAM heatmap: {e}")
            return None
