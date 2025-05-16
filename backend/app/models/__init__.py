# app/models/__init__.py
from .user_models import UserCreate, UserLogin, Token, UserResponse, LoginResponse, UserInDB
from .paper_models import PaperData, CodeFile, ProjectSuggestion, ProcessedPaper, PaperInDB, PaperResponse
from .chat_models import ChatMessage, SaveChatSessionRequest, ChatSessionResponse, ChatSessionsResponse, ChatMessageResponse, ChatSessionInDB, ChatSessionCreate

__all__ = [
    "UserCreate", "UserLogin", "Token", "UserResponse", "LoginResponse", "UserInDB",
    "PaperData", "CodeFile", "ProjectSuggestion", "ProcessedPaper", "PaperInDB", "PaperResponse",
    "ChatMessage", "SaveChatSessionRequest", "ChatSessionResponse", "ChatSessionsResponse", "ChatMessageResponse",
    "ChatSessionInDB", "ChatSessionCreate" # Removed ChatSession, added specific existing models
]
