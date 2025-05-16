import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict # Import SettingsConfigDict
from pydantic import Field, AliasChoices # Import Field and AliasChoices
from typing import List, Optional
from datetime import timedelta

load_dotenv()  # Load environment variables from .env file

class Settings(BaseSettings):
    # JWT Configuration
    JWT_SECRET: str = "your-super-secret-jwt-key-please-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 7 * 24 * 60 # Default 7 days in minutes

    # MongoDB Configuration
    MONGO_URI: str = Field(
        default="mongodb://localhost:27017/deepread_dev",
        validation_alias=AliasChoices('mongo_uri', 'mongodb_uri', 'MONGO_URI', 'MONGODB_URI') # Added alias
    )
    DATABASE_NAME: str = "DeepRead"

    # AI API Keys
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_MODEL_NAME: str = "gemini-2.0-flash" # Ensure this is the correct model

    # Database Collection Names - Updated to match actual collections
    USERS_COLLECTION: str = "users"
    CHAT_SESSIONS_COLLECTION: str = "chat_sessions"
    CHAT_MESSAGES_COLLECTION: str = "chat_messages"
    CREDIT_LOGS_COLLECTION: str = "credit_logs"
    ERRORS_LOG_COLLECTION: str = "errors_log"
    # Removed PAPERS_COLLECTION as it's not in the actual database

    # Database Connection Parameters
    MAX_DB_CONNECT_RETRIES: int = 5
    DB_CONNECT_TIMEOUT_MS: int = 15000  # ms
    DB_SOCKET_TIMEOUT_MS: int = 45000   # ms

    # Credit System Configuration
    TOKEN_TO_CREDIT_RATIO: int = 1000
    SUMMARY_COST_PER_TOKEN_NUMERATOR: int = 1
    CODE_GEN_COST_PER_TOKEN_NUMERATOR: int = 2

    @property
    def SUMMARY_COST_PER_TOKEN(self) -> float:
        if self.TOKEN_TO_CREDIT_RATIO == 0: return 0
        return self.SUMMARY_COST_PER_TOKEN_NUMERATOR / self.TOKEN_TO_CREDIT_RATIO

    @property
    def CODE_GEN_COST_PER_TOKEN(self) -> float:
        if self.TOKEN_TO_CREDIT_RATIO == 0: return 0
        return self.CODE_GEN_COST_PER_TOKEN_NUMERATOR / self.TOKEN_TO_CREDIT_RATIO

    # Estimated Output Tokens for Pre-calculation
    ESTIMATED_SUMMARY_OUTPUT_TOKENS: int = 500
    ESTIMATED_CODE_OUTPUT_TOKENS: int = 1500

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://deepread.vercel.app",
        "https://deepread.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    # DEBUG: bool = False

    # Pydantic V2 model_config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding='utf-8',
        extra='forbid',
        case_sensitive=False # Environment variable names are matched case-insensitively
    )

settings = Settings()

# Make timedelta available for direct use if needed elsewhere, e.g., in security.py
JWT_EXPIRATION_DELTA = timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
