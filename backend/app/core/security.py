# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional, Any

import jwt
import bcrypt
from fastapi import HTTPException, Header, Depends
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings, JWT_EXPIRATION_DELTA
from app.models.user_models import UserInDB, TokenData
from app.db.database import get_db # Import get_db
from pymongo.database import Database as MongoDatabase # For type hinting

# OAuth2PasswordBearer with correct router prefix
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + JWT_EXPIRATION_DELTA
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def get_current_active_user(
    db: MongoDatabase = Depends(get_db), # Use Depends to inject DB connection
    authorization: Optional[str] = Header(None, alias="Authorization") 
) -> UserInDB:
    # Mejorar el registro para diagnósticos
    print(f"Auth header received: {authorization[:20]}... (truncated)")
    
    if authorization is None:
        print("ERROR: Authorization header missing")
        raise HTTPException(status_code=401, detail="Not authenticated, Authorization header missing")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        print(f"ERROR: Invalid auth scheme: {parts[0] if parts else 'empty'}")
        raise HTTPException(status_code=401, detail="Invalid authentication scheme. Use Bearer token.")
    
    token = parts[1]
    print(f"Token received (first 10 chars): {token[:10]}...")
    
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        print("JWT token decoded successfully")
        email: Optional[str] = payload.get("sub")
        if email is None:
            print("ERROR: No email found in JWT payload")
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        print("ERROR: JWT token expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError as e:
        print(f"ERROR: JWT validation error: {str(e)}")
        raise credentials_exception
    
    print(f"Looking up user with email: {email}")
    user_data = db[settings.USERS_COLLECTION].find_one({"email": email})
    
    if user_data is None:
        print(f"ERROR: No user found with email: {email}")
        raise credentials_exception
    
    try:
        user = UserInDB(**user_data)
        print(f"User authenticated successfully: {email}")
        return user
    except Exception as e: # Catch Pydantic validation errors or others
        print(f"ERROR: User model validation error: {str(e)}")
        raise credentials_exception # Or a 500 error if it's an internal issue
