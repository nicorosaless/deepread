# backend/app/crud/chat_crud.py
from pymongo.database import Database as MongoDatabase
from bson import ObjectId
from typing import List, Optional
from datetime import datetime

from app.models.chat_models import ChatMessageCreate, ChatMessageInDB, ChatSessionCreate, ChatSessionInDB, ChatMessageRole
from app.models.user_models import UserInDB # For associating sessions with users
from app.core.config import settings

def create_chat_session(db: MongoDatabase, session_data: ChatSessionCreate, user_id: ObjectId) -> ChatSessionInDB:
    new_session_doc = {
        "user_id": user_id,
        "title": session_data.title if session_data.title else "New Chat",
        "created_at": datetime.utcnow(),
        "last_updated_at": datetime.utcnow(),
        "model_name": session_data.model_name
    }
    result = db[settings.CHAT_SESSIONS_COLLECTION].insert_one(new_session_doc)
    created_session_data = db[settings.CHAT_SESSIONS_COLLECTION].find_one({"_id": result.inserted_id})
    if created_session_data:
        return ChatSessionInDB(**created_session_data)
    raise Exception("Failed to create or retrieve chat session after insert")

def get_chat_session_by_id(db: MongoDatabase, session_id: str, user_id: ObjectId) -> Optional[ChatSessionInDB]:
    try:
        session_oid = ObjectId(session_id)
    except Exception:
        return None
    session_data = db[settings.CHAT_SESSIONS_COLLECTION].find_one({"_id": session_oid, "user_id": user_id})
    if session_data:
        return ChatSessionInDB(**session_data)
    return None

def get_chat_sessions_by_user(db: MongoDatabase, user_id: ObjectId) -> List[ChatSessionInDB]:
    sessions_cursor = db[settings.CHAT_SESSIONS_COLLECTION].find({"user_id": user_id}).sort("last_updated_at", -1)
    return [ChatSessionInDB(**session_data) for session_data in sessions_cursor]

def create_chat_message(db: MongoDatabase, message_data: ChatMessageCreate, session_id: ObjectId) -> ChatMessageInDB:
    new_message_doc = {
        "session_id": session_id,
        "sender": message_data.sender.value, # Use enum value
        "content": message_data.content,
        "timestamp": datetime.utcnow(),
        "metadata": message_data.metadata
    }
    result = db[settings.CHAT_MESSAGES_COLLECTION].insert_one(new_message_doc)
    # Update session's last_updated_at timestamp
    db[settings.CHAT_SESSIONS_COLLECTION].update_one(
        {"_id": session_id},
        {"$set": {"last_updated_at": new_message_doc["timestamp"]}}
    )
    created_message_data = db[settings.CHAT_MESSAGES_COLLECTION].find_one({"_id": result.inserted_id})
    if created_message_data:
        return ChatMessageInDB(**created_message_data)
    raise Exception("Failed to create or retrieve chat message after insert")

def get_messages_by_session(db: MongoDatabase, session_id: ObjectId, limit: Optional[int] = None, chronological: bool = True) -> List[ChatMessageInDB]:
    query = db[settings.CHAT_MESSAGES_COLLECTION].find({"session_id": session_id})
    sort_order = 1 if chronological else -1 # 1 for ascending (chronological), -1 for descending
    query = query.sort("timestamp", sort_order)
    if limit:
        query = query.limit(limit)
    return [ChatMessageInDB(**msg_data) for msg_data in query]

