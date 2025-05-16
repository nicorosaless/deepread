from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Any
from datetime import datetime
import traceback
from contextlib import asynccontextmanager

import google.generativeai as genai
# Removed Groq import

# Model Imports - These are no longer directly used in main.py as endpoints are moved
# from app.models.user_models import UserCreate, UserLogin, Token, UserResponse, LoginResponse, UserInDB
# from app.models.paper_models import PaperData, CodeFile, ProjectSuggestion, ProcessedPaper
# from app.models.chat_models import ChatMessage, SaveChatSessionRequest, ChatSessionResponse, ChatSessionsResponse, ChatMessageResponse

# Configuration and Core Imports
from app.core.config import settings
from app.db.database import connect_to_mongo, close_mongo_connection, get_db # get_db needed for health check
# Security functions like create_access_token, get_current_active_user, etc., are now used in routers/CRUD
from app.core.logging import log_error_to_db # Centralized logging for global exception handler

# pymongo.database.Database removed as it's not directly type hinted here anymore

# Import Routers
from app.api.auth_router import router as auth_router
from app.api.paper_router import router as paper_router
from app.api.chat_router import router as chat_router

# Service Imports - These are used by routers, not directly in main.py anymore
# from app.services.ai_services import get_ai_client_from_state, count_tokens
# from app.services.credit_services import deduct_user_credits

# Lifespan manager for startup and shutdown events
@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    # Startup logic
    print("INFO:     Starting up...")
    connect_to_mongo()
    # AI Client Initialization
    if settings.GOOGLE_API_KEY:
        try:
            genai.configure(api_key=settings.GOOGLE_API_KEY)
            app_instance.state.gemini_client = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
            print(f"INFO:     Google Gemini client ({settings.GEMINI_MODEL_NAME}) configured.")
        except Exception as e:
            app_instance.state.gemini_client = None
            print(f"ERROR:    Failed to configure Google Gemini client: {e}")
    else:
        app_instance.state.gemini_client = None
        print("INFO:     Google API Key not found. Gemini client not configured.")

    # Removed Groq client initialization block
    
    yield
    
    # Shutdown logic
    print("INFO:     Shutting down...")
    close_mongo_connection()

app = FastAPI(title="DeepRead API", lifespan=lifespan) # Add lifespan manager to FastAPI app

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    db_for_logging = None
    try:
        # Attempt to get a DB instance for logging, but don't fail if it's not available
        # This is a temporary measure; ideally, logging shouldn't depend on a successful DB connection here
        # or should have a fallback if get_db() itself fails (e.g. during startup issues)
        db_for_logging = get_db()
    except Exception as db_exc:
        print(f"Could not get DB instance for error logging: {db_exc}")
        # Fallback to console logging if DB is not available for logging the main error
        print(f"Original Error Type: {exc.__class__.__name__}")
        print(f"Original Error Message: {str(exc)}")
        print(f"Original Traceback: {traceback.format_exc()}")

    error_details: Dict[str, Any] = {
        "timestamp": datetime.utcnow().isoformat(),
        "path": str(request.url),
        "method": request.method,
        "error_type": exc.__class__.__name__,
        "error_message": str(exc),
        "traceback": traceback.format_exc(),
        "user_agent": request.headers.get("user-agent"),
        "client_host": request.client.host if request.client else None
    }
    
    if db_for_logging:
        try:
            await log_error_to_db(error_details, db_for_logging)
        except Exception as log_exc:
            print(f"Failed to log error to DB: {log_exc}")
            # Also print original error to console as DB logging failed
            print(f"Original Error Details (due to DB log failure): {error_details}")
    else:
        # If db_for_logging was None from the start
        print(f"Error occurred, and DB was not available for logging: {error_details}")

    status_code = 500
    detail_message = "An unexpected internal server error occurred."

    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        detail_message = exc.detail

    return JSONResponse(
        status_code=status_code,
        content={"detail": detail_message}
    )

# Health check endpoint
@app.get("/api/health", tags=["Health"])
async def health_check(request: Request):
    db_status = "disconnected"
    try:
        db_instance = get_db()
        db_instance.command('ping')
        db_status = "connected"
    except RuntimeError: 
        db_status = "connection_error_runtime (App not fully started or DB unavailable)"
    except Exception as e:
        db_status = f"connection_error: {str(e)}"

    gemini_status = "configured" if getattr(request.app.state, 'gemini_client', None) else "not_configured"
    
    return {
        "status": "ok", 
        "timestamp": datetime.utcnow().isoformat(),
        "database_status": db_status,
        "gemini_status": gemini_status
    }

# Include the routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(paper_router, prefix="/api/papers", tags=["Paper Processing"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])

if __name__ == "__main__":
    import uvicorn
    import sys # Add sys import
    import os # Add os import

    # Add project root to sys.path
    # This allows 'backend.main:app' to be found when running 'python backend/main.py'
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    # Ensure GEMINI_MODEL_NAME is defined in your settings, e.g., 'gemini-1.5-flash-latest'
    print(f"Gemini Model from settings: {settings.GEMINI_MODEL_NAME}")
    print("To run the application locally, use: uvicorn backend.main:app --reload --port 8000")
    # Or run this script directly: python backend/main.py
    uvicorn.run("backend.main:app", reload=True, port=8000) # Changed "main:app" to "backend.main:app"


