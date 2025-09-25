from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class Criterion(BaseModel):
    label: str
    sublabel: str
    rating: str  # "1" | "2" | "3" | "4"


class FeedbackIn(BaseModel):
    type: str = Field(..., description="fixe|mobile|ciperf")
    provider: Optional[str] = ""
    ratings: List[Dict[str, Any]]
    comments: Optional[str] = ""
    attachment: Optional[str] = ""


class FeedbackOut(BaseModel):
    id: int
    type: str
    provider: str
    ratings: List[Dict[str, Any]]  # keep as-is to mirror input
    created_at: datetime

    model_config = {
        "from_attributes": True
    }
