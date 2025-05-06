from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from datetime import datetime, timedelta
import jwt
import bcrypt
import os
from together import Together
import uvicorn
import io

app = FastAPI(title="DeepRead API")

# Agregar manejador global de excepciones
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with actual frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Connection
MONGODB_URL = os.getenv("MONGODB_URI", "mongodb+srv://nirogo06:heyho@cluster0.ythepr9.mongodb.net/")
DATABASE_NAME = "DeepRead"
USERS_COLLECTION = "users"  # Declaración explícita del nombre de la colección

# Together AI API Key
TOGETHER_API_KEY = "b31965744154f5ba00c848c3817641bfba87872ac700f27fb130306fbd764e21"

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")  # Change in production
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DELTA = timedelta(days=7)

# Database connection setup
client = None

@app.on_event("startup")
async def startup_db_client():
    global client
    client = AsyncIOMotorClient(MONGODB_URL)
    # Create indexes
    db = client[DATABASE_NAME]
    await db[USERS_COLLECTION].create_index("email", unique=True)
    # Initialize Together AI client
    app.state.together_client = Together(api_key=TOGETHER_API_KEY)
    
@app.on_event("shutdown")
async def shutdown_db_client():
    global client
    if client:
        client.close()

# Models
class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str

class PaperData(BaseModel):
    title: str
    content: str
    authors: Optional[List[str]] = None
    abstract: Optional[str] = None
    date: Optional[str] = None

class ProjectSuggestion(BaseModel):
    title: str
    description: str
    difficulty: str
    codeImplementation: str
    language: str

class ProcessedPaper(BaseModel):
    summary: str
    keyPoints: List[str]
    projectSuggestions: List[ProjectSuggestion]

async def get_db():
    return client[DATABASE_NAME]

# Authentication utilities
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + JWT_EXPIRATION_DELTA
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(lambda x: x.headers.get("Authorization", "").split("Bearer ")[-1])):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    db = await get_db()
    user = await db[USERS_COLLECTION].find_one({"_id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# Endpoints
@app.post("/api/register", response_model=Token)
async def register(user: UserCreate):
    db = await get_db()
    
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    
    user_data = {
        "email": user.email,
        "password": hashed_password.decode('utf-8'),
        "name": user.name,
        "created_at": datetime.utcnow()
    }
    
    try:
        result = await db[USERS_COLLECTION].insert_one(user_data)
        user_id = str(result.inserted_id)
        
        access_token = create_access_token({"sub": user_id})
        return {"access_token": access_token, "token_type": "bearer"}
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email already registered")

@app.post("/api/login", response_model=Token)
async def login(user: UserLogin):
    db = await get_db()
    
    db_user = await db[USERS_COLLECTION].find_one({"email": user.email})
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not bcrypt.checkpw(user.password.encode('utf-8'), db_user["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token({"sub": str(db_user["_id"])})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/user", response_model=UserResponse)
async def get_user(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "email": current_user["email"],
        "name": current_user["name"]
    }

# PDF Processing Endpoints
@app.post("/api/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    try:
        # Read the uploaded file
        contents = await file.read()
        file_like_object = io.BytesIO(contents)
        
        # Use pypdf or any PDF extraction library
        import PyPDF2
        pdf_reader = PyPDF2.PdfReader(file_like_object)
        
        # Extract text
        text = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text += page.extract_text()
        
        # Extract basic metadata
        title = file.filename.replace('.pdf', '') if file.filename else "Untitled Paper"
        
        # Simplistic metadata extraction - in a real app, you'd use more sophisticated extraction
        lines = text.split('\n')
        authors = []
        date = None
        abstract = ""
        abstract_started = False
        
        for i, line in enumerate(lines[:20]):  # Look in first 20 lines for metadata
            if i == 0 and not title:
                title = line.strip()
            elif "abstract" in line.lower():
                abstract_started = True
                continue
            elif abstract_started and i < 20:
                abstract += line + " "
            elif any(month in line.lower() for month in ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]):
                date = line.strip()
        
        # Clean up authors - this is simplified
        potential_authors = [l.strip() for l in lines[1:5] if l.strip() and len(l.strip()) < 100]
        if potential_authors:
            authors = potential_authors[:3]  # Take first 3 potential author lines
        
        return {
            "title": title,
            "content": text,
            "authors": authors,
            "abstract": abstract[:500] if abstract else None,  # Limit abstract size
            "date": date
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")

@app.post("/api/process-paper", response_model=ProcessedPaper)
async def process_paper(paper_data: PaperData):
    try:
        # Get Together AI client
        together_client = app.state.together_client
        
        # 1. Generate summary and key points using Llama 3
        summary_prompt = f"""
        You are an academic research assistant. Your task is to analyze this research paper and provide:
        1. A clear, concise summary (250-300 words)
        2. 5-7 key points or takeaways

        Here is the paper:
        Title: {paper_data.title}
        {f"Abstract: {paper_data.abstract}" if paper_data.abstract else ""}
        {f"Authors: {', '.join(paper_data.authors)}" if paper_data.authors else ""}
        {f"Date: {paper_data.date}" if paper_data.date else ""}

        Content:
        {paper_data.content[:15000]}  # Limit content length to avoid token limits
        """

        summary_response = together_client.chat.completions.create(
            model="meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
            messages=[{"role": "user", "content": summary_prompt}]
        )
        
        summary_text = summary_response.choices[0].message.content
        
        # Parse the summary text to extract summary and key points
        parts = summary_text.split("Key Points:")
        summary = parts[0].strip()
        
        if len(parts) > 1:
            key_points_text = parts[1]
            # Extract bullet points
            key_points = [point.strip().lstrip("•-*").strip() for point in key_points_text.split("\n") if point.strip() and any(bullet in point for bullet in ["•", "-", "*", "1.", "2.", "3.", "4.", "5.", "6.", "7."])]
        else:
            # If no clear key points section, use another prompt to get them
            key_points_prompt = f"""
            Based on this research paper, list exactly 5 key points or takeaways.
            Format them as a simple list with one point per line.

            Title: {paper_data.title}
            {paper_data.abstract if paper_data.abstract else ""}
            """
            
            key_points_response = together_client.chat.completions.create(
                model="meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
                messages=[{"role": "user", "content": key_points_prompt}]
            )
            
            key_points_text = key_points_response.choices[0].message.content
            key_points = [point.strip().lstrip("•-*123456789.").strip() for point in key_points_text.split("\n") if point.strip()]
        
        # 2. Generate project suggestions using DeepSeek model
        project_prompt = f"""
        You are an expert at translating academic research into practical coding projects.
        
        Based on this paper:
        Title: {paper_data.title}
        {f"Abstract: {paper_data.abstract}" if paper_data.abstract else ""}
        
        Key Points:
        {'. '.join(key_points)}
        
        Generate 3 practical coding projects that implement ideas from this paper:
        1. A beginner project
        2. An intermediate project 
        3. An advanced project
        
        For each project, provide:
        - Title
        - Description (2-3 sentences)
        - Difficulty level (Beginner/Intermediate/Advanced)
        - Programming language to use
        - A code snippet (50-100 lines) that demonstrates core functionality
        
        Format your response as valid JSON without any explanations or additional text.
        """
        
        projects_response = together_client.chat.completions.create(
            model="deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
            messages=[{"role": "user", "content": project_prompt}]
        )
        
        projects_text = projects_response.choices[0].message.content
        
        # Extract JSON from the response if needed
        import json
        import re
        
        # Find JSON in the response
        json_match = re.search(r'```json\n([\s\S]*?)\n```', projects_text)
        if json_match:
            projects_json = json_match.group(1)
        else:
            # Try to find any JSON-like structure
            json_match = re.search(r'(\[\s*\{[\s\S]*\}\s*\])', projects_text)
            if json_match:
                projects_json = json_match.group(1)
            else:
                projects_json = projects_text
        
        try:
            projects_data = json.loads(projects_json)
        except json.JSONDecodeError:
            # If JSON parsing fails, generate a more structured response
            fallback_prompt = f"""
            Generate 3 practical coding projects based on the paper "{paper_data.title}".
            Provide each project as a JSON object with these exact fields:
            - title (string)
            - description (string)
            - difficulty (string: "Beginner", "Intermediate", or "Advanced")
            - language (string)
            - codeImplementation (string with actual code)
            
            Return a valid JSON array containing these 3 objects. Nothing else.
            """
            
            fallback_response = together_client.chat.completions.create(
                model="deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
                messages=[{"role": "user", "content": fallback_prompt}]
            )
            
            fallback_text = fallback_response.choices[0].message.content
            # Try to extract JSON again
            json_match = re.search(r'```json\n([\s\S]*?)\n```', fallback_text)
            if json_match:
                projects_json = json_match.group(1)
            else:
                # Last resort - create a basic structure
                projects_data = [
                    {
                        "title": "Basic Implementation",
                        "description": "A simple implementation of concepts from the paper.",
                        "difficulty": "Beginner",
                        "language": "Python",
                        "codeImplementation": "# Unable to generate specific code\nprint('Implementation based on paper concepts')"
                    },
                    {
                        "title": "Interactive Demo",
                        "description": "An interactive demonstration of the paper's key ideas.",
                        "difficulty": "Intermediate", 
                        "language": "Python",
                        "codeImplementation": "# Unable to generate specific code\nprint('Interactive demo of paper concepts')"
                    },
                    {
                        "title": "Advanced Application",
                        "description": "A comprehensive implementation of the paper's methodology.",
                        "difficulty": "Advanced",
                        "language": "Python",
                        "codeImplementation": "# Unable to generate specific code\nprint('Advanced application of paper concepts')"
                    }
                ]
            
        # Make sure the project suggestions have the required format
        project_suggestions = []
        if isinstance(projects_data, list):
            for project in projects_data:
                if isinstance(project, dict):
                    project_suggestions.append({
                        "title": project.get("title", "Untitled Project"),
                        "description": project.get("description", "No description provided"),
                        "difficulty": project.get("difficulty", "Intermediate"),
                        "codeImplementation": project.get("codeImplementation", project.get("code", "# No code provided")),
                        "language": project.get("language", "Python")
                    })
        
        # Ensure we have at least one project
        if not project_suggestions:
            project_suggestions = [
                {
                    "title": "Basic Implementation",
                    "description": "A simple implementation based on the paper's concepts.",
                    "difficulty": "Beginner",
                    "codeImplementation": "# Basic implementation\nprint('Hello world')",
                    "language": "Python"
                }
            ]
        
        # Return the processed paper data
        return {
            "summary": summary,
            "keyPoints": key_points[:7],  # Limit to 7 key points
            "projectSuggestions": project_suggestions[:3]  # Limit to 3 projects
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Paper processing failed: {str(e)}")

