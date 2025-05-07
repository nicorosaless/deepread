from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Body, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from bson.objectid import ObjectId
from datetime import datetime, timedelta
import jwt
import bcrypt
import os
from io import BytesIO
import PyPDF2
import re
import json
import uvicorn
from dotenv import load_dotenv

load_dotenv()

# Configuración para poder usar ambos clientes de IA según disponibilidad
try:
    from together import Together
    has_together = True
except ImportError:
    has_together = False

try:
    from groq import Groq
    has_groq = True
except ImportError:
    has_groq = False

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
    allow_origins=[
        "http://localhost:8080",  # Frontend dev server
        "http://127.0.0.1:8080"   # IPv4 localhost alternative
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Connection (opcional)
MONGODB_URL = os.getenv("MONGODB_URI", "mongodb+srv://nirogo06:heyho@cluster0.ythepr9.mongodb.net/")
DATABASE_NAME = "DeepRead"
USERS_COLLECTION = "users"

# API Keys
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")  # Change in production
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DELTA = timedelta(days=7)

# Models
SUMMARY_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free"  # Together/Groq
CODE_MODEL = "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free"   # Together/Groq

# Database connection setup
client = None
db = None

@app.on_event("startup")
async def startup_db_client():
    global client, db
    try:
        # Usar pymongo en lugar de motor
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        
        # Verificar la conexión
        client.admin.command('ping')
        
        # Crear índice para el email único
        db[USERS_COLLECTION].create_index("email", unique=True)
        print("MongoDB connection established")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        client = None
        db = None
    
    # Initialize AI clients
    if has_together and TOGETHER_API_KEY:
        try:
            app.state.together_client = Together(api_key=TOGETHER_API_KEY)
            print("Together AI client initialized")
        except Exception as e:
            print(f"Failed to initialize Together AI client: {e}")
            app.state.together_client = None
    
    if has_groq and GROQ_API_KEY:
        try:
            app.state.groq_client = Groq(api_key=GROQ_API_KEY)
            print("Groq client initialized")
        except Exception as e:
            print(f"Failed to initialize Groq client: {e}")
            app.state.groq_client = None
    
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

# Authentication utilities
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + JWT_EXPIRATION_DELTA
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(authorization: Optional[str] = Header(None, alias="Authorization")):
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection not available")

    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated: Authorization header missing or empty.")

    parts = authorization.split("Bearer ")
    if len(parts) != 2 or not parts[1]: # Check if "Bearer " prefix exists and token is not empty
        raise HTTPException(status_code=401, detail="Invalid token format. Expected 'Bearer <token>'.")
    token = parts[1]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None: # If 'sub' is not in payload
            raise HTTPException(status_code=401, detail="Invalid token: Subject (sub) claim missing.")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.PyJWTError: # Catches other JWT errors like invalid signature, malformed token etc.
        raise HTTPException(status_code=401, detail="Invalid token.")

    user = db[USERS_COLLECTION].find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found for the given token.")

    return user

# Utility function to get appropriate AI client
def get_ai_client():
    """Returns the best available AI client (Together or Groq)"""
    # Use Groq if available (preferred)
    if hasattr(app.state, "groq_client") and app.state.groq_client:
        return {"client": app.state.groq_client, "type": "groq"}
    # Fall back to Together
    elif hasattr(app.state, "together_client") and app.state.together_client:
        return {"client": app.state.together_client, "type": "together"}
    else:
        raise HTTPException(status_code=503, detail="No AI client available")

# Authentication Endpoints
@app.post("/api/register", response_model=Token)
async def register(user: UserCreate):
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection not available")
    
    try:
        hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
        
        user_data = {
            "email": user.email,
            "password": hashed_password.decode('utf-8'),
            "name": user.name,
            "created_at": datetime.utcnow()
        }
        
        try:
            result = db[USERS_COLLECTION].insert_one(user_data)
            user_id = str(result.inserted_id)
            
            access_token = create_access_token({"sub": user_id})
            return {"access_token": access_token, "token_type": "bearer"}
        except DuplicateKeyError:
            raise HTTPException(status_code=400, detail="Email already registered")
        except Exception as e:
            print(f"MongoDB insertion error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        print(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/api/login", response_model=Token)
async def login(user: UserLogin):
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection not available")
    
    db_user = db[USERS_COLLECTION].find_one({"email": user.email})
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

# PDF Processing Endpoint
@app.post("/api/extract-pdf", response_model=PaperData)
async def extract_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Read the uploaded file
        contents = await file.read()
        
        # Use PyPDF2 to extract text
        pdf_reader = PyPDF2.PdfReader(BytesIO(contents))
        
        # Extract text from all pages
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        # Extract metadata in a more sophisticated way
        title = file.filename.replace(".pdf", "")
        
        # Extract basic metadata
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
        else:
            authors = ["Extracted Author"]  # Fallback
        
        paper_data = PaperData(
            title=title,
            content=text[:15000],  # Limit content length for processing
            authors=authors,
            abstract=abstract[:500] if abstract else text[:500],  # Use first 500 chars as abstract if not found
            date=date
        )
        
        return paper_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.post("/api/process-paper", response_model=ProcessedPaper)
async def process_paper(paper_data: PaperData):
    try:
        # Get AI client (Groq or Together)
        ai_info = get_ai_client()
        client_type = ai_info["type"]
        ai_client = ai_info["client"]
        
        # Adjust max_tokens for summary and code generation
        max_summary_tokens = 2048  # Adjusted for concise summaries
        max_code_tokens = 8192  # Adjusted for detailed code implementations
        
        # 1. Generate summary and key points
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
        {paper_data.content}
        """
        
        summary_text = ""
        key_points = []
        
        # Create summary based on available client
        if client_type == "groq":
            summary_response = ai_client.chat.completions.create(
                model="deepseek-r1-distill-llama-70b",
                messages=[
                    {"role": "system", "content": "You are an AI assistant specialized in summarizing academic papers. Provide a concise and well-structured summary of the paper."},
                    {"role": "user", "content": summary_prompt}
                ],
                temperature=0.2,
                max_tokens=max_summary_tokens,
                top_p=0.2,
                stream=True
            )
            
            for chunk in summary_response:
                summary_text += chunk.choices[0].delta.content or ""
                
            # Remove formatting and <think> tags
            summary_text = re.sub(r"\*\*(.*?)\*\*", r"\1", summary_text)
            summary_text = re.sub(r"<think>.*?</think>", "", summary_text, flags=re.DOTALL)
            
            # Extract key points from summary
            if "Key Points:" in summary_text:
                parts = summary_text.split("Key Points:")
                summary = parts[0].strip()
                key_points_text = parts[1]
                key_points = [point.strip().lstrip("•-*").strip() for point in key_points_text.split("\n") 
                             if point.strip() and any(bullet in point for bullet in ["•", "-", "*", "1.", "2.", "3.", "4.", "5.", "6.", "7."])]
            else:
                summary = summary_text.strip()
                # Generate key points separately
                key_points_prompt = f"Extract 5-7 key points from this paper: {paper_data.title}"
                key_points_response = ai_client.chat.completions.create(
                    model="deepseek-r1-distill-llama-70b",
                    messages=[{"role": "user", "content": key_points_prompt}],
                    temperature=0.2,
                    max_tokens=1024,
                    stream=True
                )
                key_points_text = ""
                for chunk in key_points_response:
                    key_points_text += chunk.choices[0].delta.content or ""
                
                # Extract key points from the response
                key_points = [point.strip().lstrip("•-*1234567890.").strip() for point in key_points_text.split("\n") 
                             if point.strip() and any(char in point for char in ["•", "-", "*"]) or any(f"{i}." in point for i in range(1, 10))]
                
        elif client_type == "together":
            summary_response = ai_client.chat.completions.create(
                model=SUMMARY_MODEL,
                messages=[{"role": "user", "content": summary_prompt}]
            )
            
            summary_text = summary_response.choices[0].message.content
            
            # Parse the summary text to extract summary and key points
            parts = summary_text.split("Key Points:")
            summary = parts[0].strip()
            
            if len(parts) > 1:
                key_points_text = parts[1]
                # Extract bullet points
                key_points = [point.strip().lstrip("•-*").strip() for point in key_points_text.split("\n") 
                              if point.strip() and any(bullet in point for bullet in ["•", "-", "*", "1.", "2.", "3.", "4.", "5.", "6.", "7."])]
            else:
                # If no clear key points section, use another prompt to get them
                key_points_prompt = f"""
                Based on this research paper, list exactly 5 key points or takeaways.
                Format them as a simple list with one point per line.

                Title: {paper_data.title}
                {paper_data.abstract if paper_data.abstract else ""}
                """
                
                key_points_response = ai_client.chat.completions.create(
                    model=SUMMARY_MODEL,
                    messages=[{"role": "user", "content": key_points_prompt}]
                )
                
                key_points_text = key_points_response.choices[0].message.content
                key_points = [point.strip().lstrip("•-*123456789.").strip() for point in key_points_text.split("\n") if point.strip()]
        
        # 2. Generate code implementation
        project_suggestions = []
        
        # Generate project suggestions based on the available client
        if client_type == "groq":
            code_prompt = f"""
            You are an AI assistant specialized in generating advanced code implementations based on academic papers.
            Based on this paper titled "{paper_data.title}", generate 3 practical coding projects:
            1. A beginner project
            2. An intermediate project 
            3. An advanced project
            
            For each project, provide:
            - Title
            - Description (2-3 sentences)
            - Difficulty level (Beginner/Intermediate/Advanced)
            - Programming language to use
            - A code snippet that demonstrates core functionality
            
            Format your response as valid JSON with the following structure:
            [
              {{
                "title": "Project Title",
                "description": "Project description",
                "difficulty": "Beginner/Intermediate/Advanced",
                "language": "Programming language",
                "codeImplementation": "// Code snippet"
              }},
              ...
            ]
            """
            
            code_response = ai_client.chat.completions.create(
                model="deepseek-r1-distill-llama-70b",
                messages=[{"role": "user", "content": code_prompt}],
                temperature=0.6,
                max_tokens=max_code_tokens,
                top_p=0.1,
                stream=True
            )
            
            code_implementation = ""
            for chunk in code_response:
                code_implementation += chunk.choices[0].delta.content or ""
            
            # Remove <think> tokens from the code implementation
            code_implementation = re.sub(r"<think>.*?</think>", "", code_implementation, flags=re.DOTALL)
            
            # Try to parse JSON from the response
            try:
                # Find JSON in the response
                json_match = re.search(r'```json\n([\s\S]*?)\n```', code_implementation)
                if json_match:
                    projects_json = json_match.group(1)
                else:
                    # Try to find any JSON-like structure
                    json_match = re.search(r'(\[\s*\{[\s\S]*\}\s*\])', code_implementation)
                    if json_match:
                        projects_json = json_match.group(1)
                    else:
                        projects_json = code_implementation
                
                projects_data = json.loads(projects_json)
                
                # Process projects data
                if isinstance(projects_data, list):
                    for project in projects_data:
                        if isinstance(project, dict):
                            project_suggestions.append(
                                ProjectSuggestion(
                                    title=project.get("title", "Untitled Project"),
                                    description=project.get("description", "No description provided"),
                                    difficulty=project.get("difficulty", "Intermediate"),
                                    codeImplementation=project.get("codeImplementation", project.get("code", "# No code provided")),
                                    language=project.get("language", "Python")
                                )
                            )
            except Exception as e:
                # Fallback if JSON parsing fails
                project_suggestions.append(
                    ProjectSuggestion(
                        title="Generated Code Implementation",
                        description=f"An advanced code implementation based on the concepts in {paper_data.title}",
                        difficulty="Advanced",
                        codeImplementation=code_implementation.strip(),
                        language="python"
                    )
                )
                
        elif client_type == "together":
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
            
            projects_response = ai_client.chat.completions.create(
                model=CODE_MODEL,
                messages=[{"role": "user", "content": project_prompt}]
            )
            
            projects_text = projects_response.choices[0].message.content
            
            # Try to parse JSON from the response
            try:
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
                
                projects_data = json.loads(projects_json)
                
                # Process projects data
                if isinstance(projects_data, list):
                    for project in projects_data:
                        if isinstance(project, dict):
                            project_suggestions.append(
                                ProjectSuggestion(
                                    title=project.get("title", "Untitled Project"),
                                    description=project.get("description", "No description provided"),
                                    difficulty=project.get("difficulty", "Intermediate"),
                                    codeImplementation=project.get("codeImplementation", project.get("code", "# No code provided")),
                                    language=project.get("language", "Python")
                                )
                            )
            except json.JSONDecodeError:
                # Fallback for JSON parsing failure
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
                
                fallback_response = ai_client.chat.completions.create(
                    model=CODE_MODEL,
                    messages=[{"role": "user", "content": fallback_prompt}]
                )
                
                fallback_text = fallback_response.choices[0].message.content
                
                # Try to extract JSON again
                try:
                    json_match = re.search(r'```json\n([\s\S]*?)\n```', fallback_text)
                    if json_match:
                        projects_json = json_match.group(1)
                        projects_data = json.loads(projects_json)
                        
                        for project in projects_data:
                            if isinstance(project, dict):
                                project_suggestions.append(
                                    ProjectSuggestion(
                                        title=project.get("title", "Untitled Project"),
                                        description=project.get("description", "No description provided"),
                                        difficulty=project.get("difficulty", "Intermediate"),
                                        codeImplementation=project.get("codeImplementation", project.get("code", "# No code provided")),
                                        language=project.get("language", "Python")
                                    )
                                )
                except Exception:
                    # Last resort fallback
                    project_suggestions = [
                        ProjectSuggestion(
                            title="Basic Implementation",
                            description="A simple implementation of concepts from the paper.",
                            difficulty="Beginner",
                            language="Python",
                            codeImplementation="# Unable to generate specific code\nprint('Implementation based on paper concepts')"
                        ),
                        ProjectSuggestion(
                            title="Interactive Demo",
                            description="An interactive demonstration of the paper's key ideas.",
                            difficulty="Intermediate", 
                            language="Python",
                            codeImplementation="# Unable to generate specific code\nprint('Interactive demo of paper concepts')"
                        ),
                        ProjectSuggestion(
                            title="Advanced Application",
                            description="A comprehensive implementation of the paper's methodology.",
                            difficulty="Advanced",
                            language="Python",
                            codeImplementation="# Unable to generate specific code\nprint('Advanced application of paper concepts')"
                        )
                    ]
        
        # Ensure we have at least one project suggestion
        if not project_suggestions:
            project_suggestions = [
                ProjectSuggestion(
                    title="Basic Implementation",
                    description="A simple implementation based on the paper's concepts.",
                    difficulty="Beginner",
                    codeImplementation="# Basic implementation\nprint('Hello world')",
                    language="Python"
                )
            ]

        return ProcessedPaper(
            summary=summary.strip(),
            keyPoints=key_points[:7],  # Limit to 7 key points
            projectSuggestions=project_suggestions[:3]  # Limit to 3 projects
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing paper with LLM: {str(e)}")

@app.get("/")
async def root():
    return {"message": "DeepRead API is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


