# app/api/auth_router.py
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database as MongoDatabase

from app.models.user_models import UserCreate, UserLogin, Token, UserResponse, LoginResponse, UserInDB
from app.db.database import get_db
from app.core.security import create_access_token, get_current_active_user, verify_password
from app.crud import user_crud

router = APIRouter()

@router.post("/register", response_model=Token, tags=["Authentication"])
async def register(user: UserCreate, db: MongoDatabase = Depends(get_db)):
    print(f"Registration attempt for: {user.email}, username: {user.username}")
    
    existing_user = user_crud.get_user_by_email(db, email=user.email)
    if existing_user:
        print(f"Registration failed: Email already exists: {user.email}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    created_user = user_crud.create_user(db, user=user)
    print(f"User created successfully: {user.email}, ID: {created_user.id}")

    access_token = create_access_token(data={"sub": created_user.email})
    print(f"Token generated for new user: {user.email} (first 10 chars): {access_token[:10]}...")
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=LoginResponse, tags=["Authentication"])
async def login(user: UserLogin, db: MongoDatabase = Depends(get_db)):
    print(f"Login attempt for user: {user.email}")
    
    db_user = user_crud.get_user_by_email(db, email=user.email)
    if not db_user:
        print(f"Login failed: User not found: {user.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials, user not found")
    
    if not verify_password(user.password, db_user.hashed_password):
        print(f"Login failed: Password mismatch for user: {user.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials, password mismatch")
    
    print(f"Password verified for user: {user.email}")
    access_token = create_access_token(data={"sub": db_user.email})
    print(f"Token generated for user: {user.email} (first 10 chars): {access_token[:10]}...")
    
    user_response = UserResponse(
        id=str(db_user.id),
        email=db_user.email,
        username=db_user.username,
        name=db_user.username,  # Map username to name for frontend
        credits=db_user.credits,
        created_at=db_user.created_at
    )
    return {"access_token": access_token, "token_type": "bearer", "user": user_response}

@router.get("/user", response_model=UserResponse, tags=["User"])
async def get_user_profile(current_user: UserInDB = Depends(get_current_active_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        username=current_user.username,
        name=current_user.username,  # Map username to name for frontend
        credits=current_user.credits,
        created_at=current_user.created_at
    )
