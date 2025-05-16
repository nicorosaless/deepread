from fastapi import APIRouter, HTTPException, Depends, Request
from pymongo.database import Database as MongoDatabase
from bson import ObjectId # Keep ObjectId for session_oid conversion
from datetime import datetime # Keep for error logging timestamp
import traceback # For logging
from typing import List # For type hinting

# Models
from app.models.user_models import UserInDB
from app.models.chat_models import (
    ChatMessage, # This is the input model for a new message by user
    SaveChatSessionRequest, 
    ChatSessionResponse, 
    ChatSessionsResponse, 
    ChatMessageResponse,
    ChatMessageCreate, # Used for creating messages in CRUD
    ChatSessionCreate, # Used for creating sessions in CRUD
    ChatMessageRole # Enum for sender role
)

# Core and DB
# settings removed if not directly used
from app.db.database import get_db
from app.core.security import get_current_active_user

# Services
from app.services.ai_services import get_ai_client_from_state
from app.core.config import settings # For AI model names, error collection name

# Utilities / Logging
from app.core.logging import log_error_to_db

# CRUD imports
from app.crud import chat_crud

router = APIRouter()

@router.post("/sessions", response_model=ChatSessionResponse, tags=["Chat"])
async def create_chat_session_endpoint(
    request_data: SaveChatSessionRequest,
    current_user: UserInDB = Depends(get_current_active_user),
    db: MongoDatabase = Depends(get_db)
):
    chat_session_create = ChatSessionCreate(title=request_data.title, model_name=request_data.model_name)
    session = chat_crud.create_chat_session(db, session_data=chat_session_create, user_id=current_user.id)

    initial_chat_messages_response: List[ChatMessageResponse] = []
    if request_data.messages:
        for msg_data in request_data.messages:
            # msg_data.role is string, ChatMessageRole expects enum member
            sender_role = ChatMessageRole.USER if msg_data.role == "user" else ChatMessageRole.ASSISTANT
            chat_message_create = ChatMessageCreate(sender=sender_role, content=msg_data.content)
            created_msg = chat_crud.create_chat_message(db, message_data=chat_message_create, session_id=session.id)
            initial_chat_messages_response.append(ChatMessageResponse(
                id=str(created_msg.id),
                session_id=str(session.id),
                sender=created_msg.sender.value, # Use enum value
                content=created_msg.content,
                timestamp=created_msg.timestamp
            ))
            
    return ChatSessionResponse(
        id=str(session.id),
        user_id=str(session.user_id),
        title=session.title,
        created_at=session.created_at,
        last_updated_at=session.last_updated_at,
        model_name=session.model_name,
        messages=initial_chat_messages_response
    )

@router.get("/sessions", response_model=ChatSessionsResponse, tags=["Chat"])
async def get_chat_sessions_endpoint(
    current_user: UserInDB = Depends(get_current_active_user),
    db: MongoDatabase = Depends(get_db)
):
    sessions_db = chat_crud.get_chat_sessions_by_user(db, user_id=current_user.id)
    
    response_sessions: List[ChatSessionResponse] = []
    for session_db in sessions_db:
        messages_db = chat_crud.get_messages_by_session(db, session_id=session_db.id, chronological=True)
        messages_response = [
            ChatMessageResponse(
                id=str(msg.id),
                session_id=str(session_db.id),
                sender=msg.sender.value, # Use enum value
                content=msg.content,
                timestamp=msg.timestamp
            ) for msg in messages_db
        ]
        
        response_sessions.append(ChatSessionResponse(
            id=str(session_db.id),
            user_id=str(session_db.user_id),
            title=session_db.title,
            created_at=session_db.created_at,
            last_updated_at=session_db.last_updated_at,
            model_name=session_db.model_name,
            messages=messages_response
        ))
    return ChatSessionsResponse(sessions=response_sessions)

@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse, tags=["Chat"])
async def post_chat_message_endpoint(
    session_id: str,
    message: ChatMessage, # Input from user: ChatMessage(role: str, content: str)
    request: Request,
    current_user: UserInDB = Depends(get_current_active_user),
    db: MongoDatabase = Depends(get_db)
):
    session = chat_crud.get_chat_session_by_id(db, session_id=session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found or access denied")

    # Save user message
    user_message_create = ChatMessageCreate(sender=ChatMessageRole.USER, content=message.content)
    chat_crud.create_chat_message(db, message_data=user_message_create, session_id=session.id)
    
    # Retrieve history for AI context (last 10 messages, chronological for AI)
    # chat_crud.get_messages_by_session returns in specified order, default chronological=True
    history_db = chat_crud.get_messages_by_session(db, session_id=session.id, limit=10, chronological=False) # False for recent first
    
    ai_message_history = []
    for msg_db in reversed(history_db): # Reverse to make it chronological for AI
        ai_message_history.append({"role": msg_db.sender.value, "content": msg_db.content})
    
    # Add current user message to history for AI
    ai_message_history.append({"role": ChatMessageRole.USER.value, "content": message.content})

    ai_client, client_name = get_ai_client_from_state(request, preferred_model=session.model_name or 'groq')
    ai_response_content = "AI response could not be generated at this time."

    try:
        if not ai_client:
            raise HTTPException(status_code=503, detail=f"AI client ({client_name or 'default'}) not available.")

        if client_name == "gemini":
            response = await ai_client.generate_content_async(ai_message_history)
            ai_response_content = response.text
        elif client_name == "groq":
            chat_completion = await ai_client.chat.completions.create(
                messages=ai_message_history,
                model=settings.GROQ_CHAT_MODEL, # Or make this dynamic based on session.model_name if applicable
            )
            ai_response_content = chat_completion.choices[0].message.content
        else:
            raise HTTPException(status_code=503, detail="Unsupported AI client specified.")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error calling AI for chat (session: {session_id}): {e}")
        await log_error_to_db({
            "user_id": str(current_user.id), 
            "session_id": session_id, 
            "error_message": f"AI chat API error: {str(e)}", 
            "traceback": traceback.format_exc(),
            "timestamp": datetime.utcnow(),
            "path": str(request.url),
            "method": request.method,
            "context": "AI Call in Chat Message"
        }, db)

    # Save AI message
    ai_message_create = ChatMessageCreate(sender=ChatMessageRole.ASSISTANT, content=ai_response_content)
    created_ai_msg = chat_crud.create_chat_message(db, message_data=ai_message_create, session_id=session.id)

    return ChatMessageResponse(
        id=str(created_ai_msg.id),
        session_id=str(session.id),
        sender=created_ai_msg.sender.value,
        content=created_ai_msg.content,
        timestamp=created_ai_msg.timestamp
    )
