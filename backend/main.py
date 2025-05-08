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
import math
import tiktoken
import google.generativeai as genai # Added Google AI import

load_dotenv()

# Configuración para poder usar ambos clientes de IA según disponibilidad

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
MESSAGES_COLLECTION = "messages" # Added messages collection name

# API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "") # Added Google API Key

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")  # Change in production
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DELTA = timedelta(days=7)

# Models
# SUMMARY_MODEL and CODE_MODEL are no longer needed as we'll use Google's model directly
GOOGLE_MODEL_NAME = "gemini-2.0-flash"

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
    
    if has_groq and GROQ_API_KEY: # Keep Groq for now as a potential fallback or for other uses
        try:
            app.state.groq_client = Groq(api_key=GROQ_API_KEY)
            print("Groq client initialized")
        except Exception as e:
            print(f"Failed to initialize Groq client: {e}")
            app.state.groq_client = None

    if GOOGLE_API_KEY:
        try:
            genai.configure(api_key=GOOGLE_API_KEY)
            app.state.google_ai_client = genai.GenerativeModel(GOOGLE_MODEL_NAME)
            print("Google AI client initialized with model:", GOOGLE_MODEL_NAME)
        except Exception as e:
            print(f"Failed to initialize Google AI client: {e}")
            app.state.google_ai_client = None
    else:
        print("Google API Key not found. Google AI client not initialized.")
        app.state.google_ai_client = None
    
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
    credits: int

class PaperData(BaseModel):
    title: str
    content: str
    authors: Optional[List[str]] = None
    abstract: Optional[str] = None
    date: Optional[str] = None

class CodeFile(BaseModel):
    filename: str
    code: str

class ProjectSuggestion(BaseModel):
    title: str
    description: str
    codeImplementation: List[CodeFile] # Changed from str
    language: str

class ProcessedPaper(BaseModel):
    summary: str
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
    """Returns the Google AI client if available, otherwise Groq (or raises error)."""
    if hasattr(app.state, "google_ai_client") and app.state.google_ai_client:
        print("Using Google AI client")
        return {"client": app.state.google_ai_client, "type": "google"}
    elif hasattr(app.state, "groq_client") and app.state.groq_client: # Fallback, can be removed if Google is sole provider
        print("Warning: Google AI client not available, falling back to Groq.")
        return {"client": app.state.groq_client, "type": "groq"}
    else:
        raise HTTPException(status_code=503, detail="No AI client available (Google or Groq).")

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
            "created_at": datetime.utcnow(),
            "credits": 1000  # Initial credits for new user (integer)
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
        "name": current_user["name"],
        "credits": current_user.get("credits", 0) # Return credits, default to 0 (integer)
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
        
        # Title is the filename without .pdf
        title = file.filename.replace(".pdf", "")
        
        paper_data = PaperData(
            title=title,
            content=text[:16000],  # Limit content length for processing
            authors=None, # Simplified: No author extraction
            abstract=None, # Simplified: No abstract extraction
            date=None # Simplified: No date extraction
        )
        
        return paper_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# Credit cost constants
TOKEN_TO_CREDIT_RATIO = 10000  # Example: 10000 tokens = 1 credit, adjust as needed
SUMMARY_COST_PER_TOKEN = 1 / TOKEN_TO_CREDIT_RATIO 
CODE_GEN_COST_PER_TOKEN = 2 / TOKEN_TO_CREDIT_RATIO # Example: Code generation is twice as expensive

# Estimated output tokens for pre-calculation
ESTIMATED_SUMMARY_OUTPUT_TOKENS = 500  # Increased from a typical 300-word summary to give buffer
ESTIMATED_CODE_OUTPUT_TOKENS = 1500    # Estimate for advanced code snippets

# Helper function to calculate token count using tiktoken
def count_tokens(text: str, model_name: str = "cl100k_base") -> int:
    """Counts tokens in a string using tiktoken."""
    if not text: # Handle empty strings
        return 0
    try:
        encoding = tiktoken.get_encoding(model_name)
    except Exception:
        encoding = tiktoken.get_encoding("cl100k_base") 
    return len(encoding.encode(text))

# Helper function to deduct credits
async def deduct_credits(user_id: str, amount: int):
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection not available")
    db[USERS_COLLECTION].update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"credits": -amount}}
    )

@app.post("/api/process-paper", response_model=ProcessedPaper)
async def process_paper(paper_data: PaperData, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    user_credits = current_user.get("credits", 0)
    session_id = ObjectId() # Generate a unique session ID for this interaction

    # --- Pre-computation of Estimated Cost ---
    # 1. Estimate for Summary
    pre_summary_prompt = f""" \n    You are an academic research assistant. Your task is to analyze this research paper and provide a clear, concise summary (250-300 words).

    Here is the paper:
    Title: {paper_data.title}
    Content:
    {paper_data.content}
    
    Provide only the summary, without any additional formatting or section titles like "Summary:".
    """ # Note: This is a simplified prompt for token counting, actual prompt below might be slightly different
    estimated_summary_input_tokens = count_tokens(pre_summary_prompt)
    estimated_summary_cost = (estimated_summary_input_tokens + ESTIMATED_SUMMARY_OUTPUT_TOKENS) * SUMMARY_COST_PER_TOKEN

    # 2. Estimate for Code Generation (input depends on estimated summary)
    # For code gen input, we use the pre_summary_prompt tokens + estimated summary output tokens as a proxy
    # This is a rough estimate as the actual summary isn't generated yet.
    estimated_code_input_tokens = count_tokens(f"Title: {paper_data.title} Summary: [estimated {ESTIMATED_SUMMARY_OUTPUT_TOKENS} tokens summary]") + ESTIMATED_SUMMARY_OUTPUT_TOKENS
    estimated_code_gen_cost = (estimated_code_input_tokens + ESTIMATED_CODE_OUTPUT_TOKENS) * CODE_GEN_COST_PER_TOKEN
    
    estimated_total_cost = estimated_summary_cost + estimated_code_gen_cost
    integer_estimated_total_cost = math.ceil(estimated_total_cost)

    if user_credits < integer_estimated_total_cost:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits for estimated cost. Required: ~{integer_estimated_total_cost}, Available: {user_credits}. Please top up your credits."
        )
    # --- End of Pre-computation ---

    try:
        ai_info = get_ai_client()
        ai_client = ai_info["client"]
        client_type = ai_info["type"] # Will be "google" if successful
        
        # max_summary_tokens and max_code_tokens are now for Google's API
        # For Google, this is max_output_tokens in generation_config
        generation_config_summary = genai.types.GenerationConfig(
            max_output_tokens=600,
            temperature=0.2,
            top_p=0.2 # Google uses top_p, not top_k in the same way as some others for this param
        )
        generation_config_code = genai.types.GenerationConfig(
            max_output_tokens=60000, 
            temperature=0.6,
            top_p=0.1
        )

        # 1. Generate summary
        summary_prompt = f"""
        You are an academic research assistant. Your task is to analyze this research paper and provide a clear, concise summary (250-300 words).

        Here is the paper:
        Title: {paper_data.title}
        Content:
        {paper_data.content}
        
        Provide only the summary, without any additional formatting or section titles like "Summary:".
        """
        
        actual_summary_input_tokens = count_tokens(summary_prompt) # Stays tiktoken for now
        summary_text = ""

        if client_type == "google":
            try:
                summary_response = await ai_client.generate_content_async(
                    summary_prompt, 
                    generation_config=generation_config_summary,
                    stream=True
                )
                async for chunk in summary_response:
                    summary_text += chunk.text
            except Exception as e:
                print(f"Error during Google AI summary generation: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Google AI summary generation failed: {str(e)}")
        elif client_type == "groq": # Fallback logic
            summary_response_groq = ai_client.chat.completions.create(
                model="mixtral-8x7b-32768", # Example Groq model
                messages=[
                    {"role": "system", "content": "You are an AI assistant specialized in summarizing academic papers."},
                    {"role": "user", "content": summary_prompt}
                ],
                temperature=0.2,
                max_tokens=600, 
                top_p=0.2,
                stream=True
            )
            for chunk in summary_response_groq:
                summary_text += chunk.choices[0].delta.content or ""
        else:
            raise HTTPException(status_code=500, detail="Unsupported AI client type for summary.")
        
        actual_summary_output_tokens = count_tokens(summary_text) # Stays tiktoken

        # Calculate cost for summary
        actual_summary_cost = (actual_summary_input_tokens + actual_summary_output_tokens) * SUMMARY_COST_PER_TOKEN
        integer_actual_summary_cost = math.ceil(actual_summary_cost)

        # Store summary message
        if db:
            summary_message_record = {
                "user_id": ObjectId(user_id),
                "session_id": session_id,
                "role": "assistant",
                "content_type": "summary",
                "content": summary_text, # Storing the raw summary text before further cleaning for response
                "input_tokens": actual_summary_input_tokens,
                "output_tokens": actual_summary_output_tokens,
                "estimated_cost": integer_actual_summary_cost, # Storing the calculated cost for this part
                "timestamp": datetime.utcnow()
            }
            db[MESSAGES_COLLECTION].insert_one(summary_message_record)

        # Clean the summary output for the API response
        summary = summary_text.strip()

        # 0. Remove <think> tags
        summary = re.sub(r'<think>.*?</think>', '', summary, flags=re.DOTALL).strip()

        # 1. Attempt to extract content if wrapped in markdown-like code blocks
        markdown_match = re.search(r'```(?:text|markdown)?\s*\n([\s\S]*?)\n```', summary, re.IGNORECASE)
        if markdown_match:
            summary = markdown_match.group(1).strip()
        else:
            generic_markdown_match = re.search(r'```\s*\n([\s\S]*?)\n```', summary, re.IGNORECASE)
            if generic_markdown_match:
                summary = generic_markdown_match.group(1).strip()

        # 2. Remove common conversational prefixes and "Summary:" like headers from the beginning of the string
        prefix_patterns = [
            r"\A\s*here's the summary:\s*",
            r"\A\s*okay, here is the summary:\s*",
            r"\A\s*here is the summary:\s*",
            r"\A\s*summary\s*[:：]*\s*",  # Handles "Summary:", "Summary :", "Summary ："
        ]
        for pattern in prefix_patterns:
            summary = re.sub(pattern, "", summary, flags=re.IGNORECASE).strip()

        # 3. Final strip
        summary = summary.strip()

        # 2. Generate code implementation
        project_suggestions = []
        code_prompt = f"""
        You are an AI assistant specialized in generating advanced code implementations based on academic papers.
        Based on this paper titled "{paper_data.title}" and its summary:
        Summary: {summary}

        Generate 1 practical coding project at an advanced level.
        
        Provide:
        - Title
        - Description (2-3 sentences)
        - Programming language to use
        - Code implementation. If the project involves multiple Python files, structure the 'codeImplementation' as a list of objects, where each object has 'filename' and 'code' keys. For single file projects, you can provide a single object in the list or just the code string.
        
        Format your response as valid JSON. Ensure the JSON is well-formed.
        Example JSON structure:
        {{
          "title": "Project Title",
          "description": "Project description.",
          "language": "Python",
          "codeImplementation": [
            {{
              "filename": "main.py",
              "code": "# Python code for main.py\nprint(\'Hello World\')"
            }}
          ]
        }}
        """
        actual_code_input_tokens = count_tokens(code_prompt) # Stays tiktoken
        code_implementation_str = ""

        if client_type == "google":
            try:
                # For JSON output, it's often better to not stream and ensure the model knows to output JSON
                # Adding a system instruction or modifying the prompt to explicitly ask for JSON.
                # Google's Gemini can also use `response_mime_type="application/json"` in `generation_config` for some versions/models.
                # For gemini-1.5-flash, direct JSON mode might not be explicitly supported via response_mime_type, 
                # so clear prompting is key.
                
                # Adjusting prompt slightly for better JSON from Gemini
                code_prompt_google = f'{code_prompt}\n\nPlease ensure your entire response is a single, valid JSON object as described above, without any surrounding text or explanations.'

                code_response = await ai_client.generate_content_async(
                    code_prompt_google, 
                    generation_config=generation_config_code
                    # stream=False # Typically better for JSON, but if you need to stream, parse carefully
                )
                # If not streaming, response is not an async iterator
                code_implementation_str = code_response.text
            except Exception as e:
                print(f"Error during Google AI code generation: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Google AI code generation failed: {str(e)}")
        elif client_type == "groq": # Fallback logic
            code_response_groq = ai_client.chat.completions.create(
                model="mixtral-8x7b-32768", # Example Groq model
                messages=[{"role": "user", "content": code_prompt}],
                temperature=0.6,
                max_tokens=12000,
                top_p=0.1,
                stream=True # Groq was streaming, Google for JSON might be better non-streamed
            )
            for chunk in code_response_groq:
                code_implementation_str += chunk.choices[0].delta.content or ""
        else:
            raise HTTPException(status_code=500, detail="Unsupported AI client type for code generation.")
        
        actual_code_output_tokens = count_tokens(code_implementation_str) # Stays tiktoken

        # Calculate cost for code generation
        actual_code_gen_cost = (actual_code_input_tokens + actual_code_output_tokens) * CODE_GEN_COST_PER_TOKEN
        integer_actual_code_gen_cost = math.ceil(actual_code_gen_cost)

        # Store code generation message
        if db:
            code_message_record = {
                "user_id": ObjectId(user_id),
                "session_id": session_id,
                "role": "assistant",
                "content_type": "code_suggestion",
                "content": cleaned_code_implementation_str, # Storing the cleaned JSON string
                "input_tokens": actual_code_input_tokens,
                "output_tokens": actual_code_output_tokens,
                "estimated_cost": integer_actual_code_gen_cost, # Storing the calculated cost for this part
                "timestamp": datetime.utcnow()
            }
            db[MESSAGES_COLLECTION].insert_one(code_message_record)

        # Clean the code_implementation_str before attempting to parse JSON
        # 0. Remove <think> tags
        cleaned_code_implementation_str = re.sub(r'<think>.*?</think>', '', code_implementation_str, flags=re.DOTALL).strip()
        
        # Remove potential markdown code block fences if the model wraps JSON in them
        json_markdown_match = re.search(r'```(?:json)?\s*\n([\s\S]*?)\n```', cleaned_code_implementation_str, re.IGNORECASE)
        if json_markdown_match:
            cleaned_code_implementation_str = json_markdown_match.group(1).strip()
        
        # Remove conversational prefixes if any (less common for JSON but good to have)
        code_prefix_patterns = [
            r"\A\s*here's the json output:\s*",
            r"\A\s*okay, here is the json:\s*",
            r"\A\s*here is the json code:\s*",
        ]
        for pattern in code_prefix_patterns:
            cleaned_code_implementation_str = re.sub(pattern, "", cleaned_code_implementation_str, flags=re.IGNORECASE).strip()

        # Try to parse JSON from the cleaned response
        try:
            project_data = json.loads(cleaned_code_implementation_str)
            
            # Process projects data
            if isinstance(project_data, dict):
                raw_code_impl = project_data.get("codeImplementation", project_data.get("code"))
                code_files = []

                if isinstance(raw_code_impl, list): # Handles list of file objects
                    for file_obj in raw_code_impl:
                        if isinstance(file_obj, dict) and "filename" in file_obj and "code" in file_obj:
                            code_files.append(CodeFile(filename=file_obj["filename"], code=file_obj["code"]))
                        else: # Fallback for malformed list items
                            code_files.append(CodeFile(filename="script.py", code=str(file_obj)))
                elif isinstance(raw_code_impl, str): # Handles single code string
                    # Determine a default filename based on language or make it generic
                    lang = project_data.get("language", "python").lower()
                    default_filename = f"script.{'py' if lang == 'python' else 'txt'}"
                    code_files.append(CodeFile(filename=default_filename, code=raw_code_impl))
                else: # Fallback for unexpected type
                    code_files.append(CodeFile(filename="fallback_script.txt", code="# No valid code provided"))

                if not code_files: # Ensure there's at least one CodeFile object
                     code_files.append(CodeFile(filename="empty_script.txt", code="# Code generation failed or was empty"))


                project_suggestions.append(
                    ProjectSuggestion(
                        title=project_data.get("title", "Untitled Project"),
                        description=project_data.get("description", "No description provided"),
                        codeImplementation=code_files,
                        language=project_data.get("language", "Python")
                    )
                )
        except Exception as e:
            # Fallback if JSON parsing fails
            # Attempt to clean the raw string from <think> tags again, just in case it wasn't JSON
            fallback_code_str = re.sub(r'<think>.*?</think>', '', code_implementation_str, flags=re.DOTALL).strip()
            project_suggestions.append(
                ProjectSuggestion(
                    title="Generated Code Implementation",
                    description=f"An advanced code implementation based on the concepts in {paper_data.title}",
                    codeImplementation=[CodeFile(filename="fallback_script.py", code=fallback_code_str)], # Use cleaned string for fallback
                    language="python"
                )
            )
        if not project_suggestions: # Ensure there's a fallback
            project_suggestions = [
                ProjectSuggestion(
                    title="Advanced Implementation", 
                    description="An advanced implementation based on the paper's concepts.", 
                    codeImplementation=[CodeFile(filename="advanced_script.py", code="# Advanced implementation\nprint('Hello advanced world')")], 
                    language="Python"
                )
            ]

        # Calculate actual total cost based on individual actual costs
        actual_total_cost = actual_summary_cost + actual_code_gen_cost # Sum of individual costs
        integer_actual_total_cost = math.ceil(actual_total_cost) # This is the total to deduct

        # Though pre-check was done, it's good practice to ensure the user wasn't somehow charged more than they have
        # This could happen if estimates were way off and actual cost is higher than their current balance after pre-check.
        # However, the primary check is the pre-computation. This is more of a safeguard.
        if user_credits < integer_actual_total_cost: 
            # This scenario should ideally be rare if estimates are decent.
            # Decide on policy: refund, partial charge, or error. For now, erroring out.
            print(f"Warning: Actual cost ({integer_actual_total_cost}) exceeded user credits ({user_credits}) post-generation. Initial estimate was {integer_estimated_total_cost}.")
            raise HTTPException(status_code=402, detail=f"Processing completed, but final cost ({integer_actual_total_cost}) exceeds available credits ({user_credits}). Please contact support.")

        # Deduct actual credits
        await deduct_credits(str(current_user["_id"]), integer_actual_total_cost)

        return ProcessedPaper(
            summary=summary,
            projectSuggestions=project_suggestions[:1] 
        )

    except HTTPException as e: # Re-raise HTTPExceptions to be caught by FastAPI
        raise e
    except Exception as e:
        # Log the error for debugging
        print(f"Error processing paper with LLM: {str(e)}")
        # Fallback: if an error occurs after credit check but before deduction, 
        # it might be good to refund or not charge, but for now, we assume deduction happens on success.
        raise HTTPException(status_code=500, detail=f"Error processing paper with LLM: {str(e)}")

@app.get("/")
async def root():
    return {"message": "DeepRead API is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


