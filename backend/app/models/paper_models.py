# app/models/paper_models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from bson import ObjectId
from pydantic_core import core_schema

# Helper for ObjectId validation (consistent with user_models.py)
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, _handler): # handler is no longer used, but keep for signature compatibility if needed by older Pydantic versions internally
        if isinstance(v, ObjectId):
            return v
        if ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")

    @classmethod
    def __get_pydantic_json_schema__(cls, _core_schema, handler):
        # Use the same schema that pydantic would generate for a str
        return handler(core_schema.str_schema())

    # __modify_schema__ is deprecated in Pydantic v2
    # @classmethod
    # def __modify_schema__(cls, field_schema):
    #     field_schema.update(type="string")

class PaperBase(BaseModel):
    user_id: str # or PyObjectId if you store it as ObjectId and convert on read/write
    title: Optional[str] = None
    s2_paper_id: Optional[str] = None # Semantic Scholar Paper ID
    arxiv_id: Optional[str] = None
    doi: Optional[str] = None
    # ... other metadata fields from Semantic Scholar or other sources
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    # text_content: Optional[str] = None # Full text if stored, might be large
    # summary: Optional[str] = None # AI-generated summary
    # code_implementations: Optional[List[Dict[str, str]]] = None # e.g., [{"name": "impl1.py", "code": "..."}]

class PaperCreate(PaperBase):
    # Fields required on creation, if different from PaperBase
    pass

class PaperInDB(PaperBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    # text_content_storage_ref: Optional[str] = None # If storing large text elsewhere

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True # Pydantic V2

class PaperResponse(PaperBase):
    id: str # Keep as str for responses
    # Ensure all fields intended for the client are here

# Models for PDF processing request/response (as previously in main.py)
class PaperData(BaseModel):
    file_name: str
    text_content: str
    user_id: str # This should be the ObjectId as string from the authenticated user

class CodeFile(BaseModel):
    file_name: str
    code: str

class ProjectSuggestion(BaseModel):
    project_name: str
    description: str
    technologies: List[str]
    files: List[CodeFile]

class ProcessedPaper(BaseModel):
    summary: str
    project_suggestions: List[ProjectSuggestion]
    # original_paper_id: Optional[str] = None # Link back to a stored PaperInDB if you create one
