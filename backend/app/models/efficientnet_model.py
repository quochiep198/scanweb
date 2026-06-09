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
            nn.LayerNorm(16)
        )
        
        # Shared feature processing block
        self.shared_fc = nn.Sequential(
            nn.Linear(in_features + 16, 256),
            nn.ReLU(),
            nn.Dropout(0.3)
        )
        
        # Classification head: outputs class logits (num_classes)
        self.classifier_head = nn.Linear(256, num_classes)
        
        # Regression head: outputs predicted T-score (1)
        self.regression_head = nn.Linear(256, 1)
        
    def forward(self, x: torch.Tensor, meta: torch.Tensor):
        # If image is grayscale (1 channel), repeat to 3 channels for EfficientNet-B3
        if x.shape[1] == 1:
            x = x.repeat(1, 3, 1, 1)
            
        # Extract image features
        img_feats = self.backbone(x) # shape: (batch_size, 1536)
        
        # Extract metadata features using LayerNorm (safe for all batch sizes)
        meta_feats = self.meta_fc(meta) # shape: (batch_size, 16)
        
        # Concatenate image features and metadata features
        combined_feats = torch.cat([img_feats, meta_feats], dim=1) # shape: (batch_size, 1552)
        
        # Process shared features
        shared_feats = self.shared_fc(combined_feats) # shape: (batch_size, 256)
        
        # Branch predictions
        logits = self.classifier_head(shared_feats) # shape: (batch_size, 3)
        t_score_pred = self.regression_head(shared_feats).squeeze(-1) # shape: (batch_size,)
        
        return logits, t_score_pred
