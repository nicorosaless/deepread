# app/models/chat_models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from bson import ObjectId
from pydantic_core import core_schema
from enum import Enum # Import Enum

# Define ChatMessageRole Enum
class ChatMessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "ai" # "assistant" is often used interchangeably with "ai" for the model's role
    SYSTEM = "system" # For system messages, if needed

# Helper for ObjectId validation (consistent with user_models.py)
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, _handler): # handler is no longer used
        if isinstance(v, ObjectId):
            return v
        if ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")

    @classmethod
    def __get_pydantic_json_schema__(cls, _core_schema, handler):
        return handler(core_schema.str_schema())
        
    # __modify_schema__ is deprecated
    # @classmethod
    # def __modify_schema__(cls, field_schema):
    #     field_schema.update(type="string")

class ChatMessageBase(BaseModel):
    session_id: PyObjectId # Link to ChatSession
    sender: ChatMessageRole # Changed from Literal to ChatMessageRole
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    # model_used: Optional[str] = None # e.g., "gemini-pro", "groq-llama3"
    # cost: Optional[float] = None # Cost associated with this message (if AI)

class ChatMessageCreate(ChatMessageBase):
    metadata: Optional[dict] = None # Added to match usage in chat_crud
    pass

class ChatMessageInDB(ChatMessageBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True # Pydantic V2

class ChatMessageResponse(BaseModel): # This is what's sent to client
    id: str
    session_id: str
    sender: ChatMessageRole # Changed from Literal to ChatMessageRole
    content: str
    timestamp: datetime
    # model_used: Optional[str] = None
    # cost: Optional[float] = None

# Models for Chat (as previously in main.py)
class ChatMessage(BaseModel): # This is used for request bodies, distinct from ChatMessageResponse
    role: ChatMessageRole # Changed from Literal to ChatMessageRole
    content: str

class ChatSessionBase(BaseModel):
    user_id: PyObjectId
    # paper_id: Optional[PyObjectId] = None # If chat is related to a specific paper
    title: Optional[str] = "New Chat" # Default title, user can rename
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated_at: datetime = Field(default_factory=datetime.utcnow)
    model_name: Optional[str] = None # Added field to store the model name for the session
    # : Optional[str] = None # Optional AI-generated summary of the chat

class ChatSessionCreate(ChatSessionBase):
    initial_messages: Optional[List[ChatMessage]] = None # For creating a session with some history

class ChatSessionInDB(ChatSessionBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True # Pydantic V2

class ChatSessionResponse(BaseModel): # For individual session details
    id: str
    user_id: str
    # paper_id: Optional[str] = None
    title: Optional[str]
    created_at: datetime
    last_updated_at: datetime
    messages: List[ChatMessageResponse] # Include messages for the session
    # summary: Optional[str] = None

class ChatSessionsResponse(BaseModel): # For listing multiple sessions
    sessions: List[ChatSessionResponse] # Or a lighter version like ChatSessionListItem

class SaveChatSessionRequest(BaseModel):
    session_id: Optional[str] = None # If updating an existing session
    # user_id is implicit from auth
    # paper_id: Optional[str] = None
    title: Optional[str] = None
    messages: List[ChatMessage] # Full list of messages in the current chat
    model_name: Optional[str] = None # Added field
