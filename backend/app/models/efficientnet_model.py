import torch
import torch.nn as nn
import torchvision.models as models

class OsteoporosisEfficientNetB3(nn.Module):
    def __init__(self, num_classes: int = 3, pretrained: bool = True):
        super().__init__()
        
        # Load EfficientNet-B3 backbone
        if pretrained:
            try:
                # Try modern torchvision API (>=0.13)
                from torchvision.models import EfficientNet_B3_Weights
                self.backbone = models.efficientnet_b3(weights=EfficientNet_B3_Weights.DEFAULT)
            except ImportError:
                # Fallback for older torchvision versions
                self.backbone = models.efficientnet_b3(pretrained=True)
        else:
            self.backbone = models.efficientnet_b3(weights=None)
            
        # Get input dimension for the classifier layer (usually 1536 for EfficientNet-B3)
        in_features = self.backbone.classifier[1].in_features
        
        # Replace the backbone classifier with Identity to use it as a feature extractor
        self.backbone.classifier = nn.Identity()
        
        # Metadata processing block: expects shape (batch, 3) for [age, sex, bmi]
        self.meta_fc = nn.Sequential(
            nn.Linear(3, 16),
            nn.ReLU(),
            nn.BatchNorm1d(16)
        )
        
        # Combined classifier: inputs image features (1536) + metadata features (16)
        self.classifier = nn.Sequential(
            nn.Linear(in_features + 16, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes)
        )
        
    def forward(self, x: torch.Tensor, meta: torch.Tensor) -> torch.Tensor:
        # If image is grayscale (1 channel), repeat to 3 channels for EfficientNet-B3
        if x.shape[1] == 1:
            x = x.repeat(1, 3, 1, 1)
            
        # Extract image features
        img_feats = self.backbone(x) # shape: (batch_size, 1536)
        
        # Extract metadata features
        # BatchNorm1d requires batch_size > 1. If batch_size is 1, bypass BatchNorm1d or handle gracefully.
        if meta.shape[0] == 1 and self.training:
            # Avoid batch norm crash during training with batch size 1
            meta_feats = meta
            # We can map it via self.meta_fc's Linear layer directly if batch size is 1
            for layer in self.meta_fc:
                if isinstance(layer, nn.BatchNorm1d):
                    continue
                meta_feats = layer(meta_feats)
        else:
            meta_feats = self.meta_fc(meta) # shape: (batch_size, 16)
            
        # Concatenate image features and metadata features
        combined_feats = torch.cat([img_feats, meta_feats], dim=1) # shape: (batch_size, 1552)
        
        # Classify
        logits = self.classifier(combined_feats)
        return logits
