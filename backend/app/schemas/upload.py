from pydantic import BaseModel
from typing import List

class OptionResponse(BaseModel):
    name: str
    value: str

    class Config:
        from_attributes = True

class UploadOptionsResponse(BaseModel):
    scan_zones: List[OptionResponse]
    diagnostic_labels: List[OptionResponse]
