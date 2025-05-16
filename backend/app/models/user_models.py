# app/models/user_models.py
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from pydantic_core import core_schema

# Helper for ObjectId validation if you need it directly in models,
# otherwise, it's often handled at the serialization/deserialization boundary.
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

class UserBase(BaseModel):
    email: EmailStr
    username: str
    credits: int = Field(default=1000) # Default credits for new users
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # email_verified: bool = False # Example of another field

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr # Or username, depending on your login logic
    password: str

class UserInDB(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    hashed_password: str

    class Config:
        json_encoders = {ObjectId: str}
        # If you are using Pydantic V2 and want to allow population by field name (e.g. _id)
        # from_attributes = True # Pydantic V2
        # allow_population_by_field_name = True # Pydantic V1
        populate_by_name = True # Pydantic V2, replaces allow_population_by_field_name

class UserResponse(BaseModel):
    id: str # Keep as str for responses
    email: EmailStr
    username: str
    name: str  # Add name field to map to frontend expectations
    credits: int
    created_at: datetime
    # email_verified: bool

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
    # initial_chat_history: Optional[List[dict]] = None # If you send initial chat history
