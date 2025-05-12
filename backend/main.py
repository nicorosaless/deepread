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

# Add a global 'text' variable with a default value
# This is a defensive measure against the NameError
text = ""

# Cargar variables de entorno
load_dotenv()

# Configuración de MongoDB - Mejorada para mayor robustez
MONGODB_URI = os.getenv("MONGODB_URI")
# Valor de respaldo en caso de que la variable de entorno no esté disponible
if not MONGODB_URI:
    print("ADVERTENCIA: Variable MONGODB_URI no encontrada. Usando URL por defecto.")
    MONGODB_URI = "mongodb+srv://nirogo06:heyho@cluster0.ythepr9.mongodb.net/"

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    print("ADVERTENCIA: Variable GOOGLE_API_KEY no encontrada. La funcionalidad de AI puede estar limitada.")

# MongoDB Connection (usaremos la variable MONGODB_URI definida arriba)
MONGODB_URL = MONGODB_URI
DATABASE_NAME = "DeepRead"
USERS_COLLECTION = "users"
CHAT_SESSIONS_COLLECTION = "chat_sessions" # ADDED
CHAT_MESSAGES_COLLECTION = "chat_messages" # ADDED
CREDIT_LOGS_COLLECTION = "credit_logs" # ADDED to define the collection name

# API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "") # Added Google API Key

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")  # Change in production
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DELTA = timedelta(days=7)

# Models
# SUMMARY_MODEL and CODE_MODEL are no longer needed as we'll use Google's model directly
GOOGLE_MODEL_NAME = "gemini-2.0-flash" # Changed from 2.0-flash to 1.5-flash

# Nuevos modelos para la funcionalidad de chat (MOVED UP)
class ChatMessage(BaseModel):
    id: Optional[str] = None
    content: str
    role: str
    paperData: Optional[dict] = None
    processedData: Optional[dict] = None
    timestamp: Optional[datetime] = None
    content_type: Optional[str] = None # Ensured content_type is present

# Database connection setup
client = None
db = None
MAX_DB_CONNECT_RETRIES = 3

@app.on_event("startup")
async def startup_db_client():
    global client, db
    connect_retries = 0
    
    while connect_retries < MAX_DB_CONNECT_RETRIES:
        try:
            # Usar pymongo en lugar de motor
            print(f"Attempting to connect to MongoDB: {MONGODB_URL}")
            client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
            
            # Verificar la conexión
            client.admin.command('ping')
            db = client[DATABASE_NAME]
            
            # Crear índice para el email único
            db[USERS_COLLECTION].create_index("email", unique=True)
            print("MongoDB connection established successfully")
            break
        except Exception as e:
            connect_retries += 1
            print(f"Failed to connect to MongoDB (attempt {connect_retries}/{MAX_DB_CONNECT_RETRIES}): {e}")
            if connect_retries >= MAX_DB_CONNECT_RETRIES:
                print("Max connection attempts reached. Database might be unavailable.")
                client = None
                db = None
            else:
                # Wait before retrying
                import time
                time.sleep(2)  # Wait 2 seconds before retry
    
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

class LoginResponse(Token): # Uses ChatMessage, so ChatMessage must be defined first
    user: UserResponse
    processed_paper_messages: List[ChatMessage] = []

# Nuevos modelos para la funcionalidad de chat
class ChatSession(BaseModel):
    id: Optional[str] = None
    title: str
    lastUpdated: Optional[datetime] = None
    messages: List[ChatMessage] = []

class SaveChatSessionRequest(BaseModel):
    session: ChatSession

class ChatSessionResponse(BaseModel):
    id: str
    title: str
    lastUpdated: datetime
    messages: List[ChatMessage]

class ChatSessionsResponse(BaseModel):
    sessions: List[ChatSession]

class PaperData(BaseModel):
    title: str
    content: str

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
    credits_remaining: Optional[int] = None # Added credits_remaining

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
            "credits": 500  # Initial credits for new user (integer)
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

@app.post("/api/login", response_model=LoginResponse)
async def login(user: UserLogin):
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection not available")
    
    db_user = db[USERS_COLLECTION].find_one({"email": user.email})
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not bcrypt.checkpw(user.password.encode('utf-8'), db_user["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id_str = str(db_user["_id"])
    access_token = create_access_token({"sub": user_id_str})
    
    # Fetch user details for the response
    user_response = UserResponse(
        id=user_id_str,
        email=db_user["email"],
        name=db_user["name"],
        credits=db_user.get("credits", 0)
    )
    
    # Fetch processed paper messages
    processed_messages = []
    if db is not None:
        message_cursor = db[CHAT_MESSAGES_COLLECTION].find({ # UPDATED
            "user_id": ObjectId(user_id_str),
            "content_type": {"$in": ["summary", "code_suggestion"]}
        }).sort("timestamp", -1) # Sort by most recent first
        
        for msg_doc in message_cursor:
            processed_messages.append(ChatMessage(
                id=str(msg_doc["_id"]),
                content=msg_doc["content"],
                role=msg_doc["role"],
                timestamp=msg_doc["timestamp"],
                paperData=msg_doc.get("paper_context"), # Use paper_context here
                processedData=None, # Or decide how to populate this
                content_type=msg_doc.get("content_type") # Added content_type
            ))
            
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response,
        processed_paper_messages=processed_messages
    )

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
        contents = await file.read()
        pdf_reader = PyPDF2.PdfReader(BytesIO(contents))
        extracted_text = ""  # Definir variable para texto extraído
        for page_num, page in enumerate(pdf_reader.pages):
            page_text = page.extract_text()
            if page_text:
                extracted_text += page_text + "\n"
        
        title = file.filename.replace(".pdf", "")
        authors = None
        abstract = None
        
        # Attempt to extract abstract and authors from the first few pages
        # This is a basic heuristic and might need refinement
        for i in range(min(2, len(pdf_reader.pages))): # Check first 2 pages
            page_text_for_meta = pdf_reader.pages[i].extract_text()
            if page_text_for_meta:
                if not abstract:
                    # Regex for abstract: case-insensitive, looks for "Abstract" followed by content until next common section or double newline
                    abstract_match = re.search(r"(?i)(?:Abstract|Summary)(?:[:.\s\n]|$)(.*?)(?:\n\n|Keywords|Introduction|1\.\s|I\.\s|Motivation|Background|Related Work|$)", page_text_for_meta, re.DOTALL)
                    if abstract_match:
                        abstract_candidate = abstract_match.group(1).strip()
                        # Further clean common non-abstract text if it starts with it
                        abstract_candidate = re.sub(r"^(?:[\d.]*\s*)?(?:Introduction|Motivation|Background|Related Work)\s*", "", abstract_candidate, flags=re.IGNORECASE).strip()
                        if len(abstract_candidate) > 50: # Basic check for meaningful abstract
                            abstract = abstract_candidate[:4000] # Increased limit for abstract

        paper_data = PaperData(
            title=title,
            content=extracted_text[:300000]  # Usar la variable extraída, con límite aumentado
        )
        return paper_data
        
    except Exception as e:
        print(f"Error in extract_pdf: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# Credit cost constants
TOKEN_TO_CREDIT_RATIO = 1000  # Example: 1000 tokens = 1 credit, adjust as needed
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

    try:
        # --- Pre-computation of Estimated Cost ---
        paper_context_for_prompt = f"Title: {paper_data.title}\n"
        content_for_estimation = paper_data.content[:20000] if paper_data.content else ""
        paper_context_for_prompt += f"Content (excerpt):\n{content_for_estimation}..."

        pre_summary_prompt_for_estimation = f"""
        Analyze this research paper excerpt and provide a summary.
        Paper Context:
        {paper_context_for_prompt}
        Summary (250-300 words):
        """
        estimated_summary_input_tokens = count_tokens(pre_summary_prompt_for_estimation)
        estimated_summary_cost = (estimated_summary_input_tokens + ESTIMATED_SUMMARY_OUTPUT_TOKENS) * SUMMARY_COST_PER_TOKEN

        estimated_code_input_base_for_estimation = f"Title: {paper_data.title}\n"
        estimated_code_input_base_for_estimation += f"Summary: [estimated {ESTIMATED_SUMMARY_OUTPUT_TOKENS} tokens summary]"
        
        estimated_code_input_tokens = count_tokens(estimated_code_input_base_for_estimation) + ESTIMATED_SUMMARY_OUTPUT_TOKENS
        estimated_code_gen_cost = (estimated_code_input_tokens + ESTIMATED_CODE_OUTPUT_TOKENS) * CODE_GEN_COST_PER_TOKEN
        
        estimated_total_cost = estimated_summary_cost + estimated_code_gen_cost
        integer_estimated_total_cost = math.ceil(estimated_total_cost)

        if user_credits < integer_estimated_total_cost:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Required: ~{integer_estimated_total_cost}, Available: {user_credits}."
            )
        # --- End of Pre-computation ---

        ai_info = get_ai_client()
        ai_client = ai_info["client"]
        client_type = ai_info["type"]
        
        # Define label variable here to ensure it's available in scope
        label = "ArxivPaper"  # Default label for the paper
        
        generation_config_summary = genai.types.GenerationConfig(
            max_output_tokens=1024, # Increased for 300-500 words summary
            temperature=0.3
        )
        generation_config_code = genai.types.GenerationConfig(
            max_output_tokens=60000, 
            temperature=0.5
        )

        # 1. Generate summary
        # Full content for actual prompt
        summary_prompt_full_context = f"Title: {paper_data.title}\n"
        summary_prompt_full_context += f"Full Content:\n{paper_data.content}" # Use full content here

        summary_prompt = f"""
        You are an expert academic research assistant. Your task is to meticulously analyze the provided research paper and generate a comprehensive, clear, and concise summary. 
        The summary should be between 300-500 words and accurately reflect the paper's core arguments, methodology, key findings, and main conclusions. 
        Ensure you capture the essence and significant contributions of the paper. Focus on extracting actionable insights and technical details relevant for understanding and potentially implementing concepts from the paper.

        Here is the paper:
        {summary_prompt_full_context}
        
        Provide only the summary itself, without any additional conversational text, formatting, or section titles like "Summary:".
        """
        
        actual_summary_input_tokens = count_tokens(summary_prompt)
        summary_text = ""

        try:
            if client_type == "google":
                summary_response = await ai_client.generate_content_async(
                    summary_prompt, 
                    generation_config=generation_config_summary,
                )
                summary_text = summary_response.text
            elif client_type == "groq":
                summary_response_groq = ai_client.chat.completions.create(
                    model="mixtral-8x7b-32768",
                    messages=[
                        {"role": "system", "content": "You are an AI assistant specialized in summarizing academic papers."},
                        {"role": "user", "content": summary_prompt}
                    ],
                    temperature=0.3,
                    max_tokens=1024, 
                    top_p=0.3,
                )
                summary_text = summary_response_groq.choices[0].message.content
            else:
                raise HTTPException(status_code=500, detail="Unsupported AI client type for summary.")
        except Exception as e_summary_ai: # Catch any exception from summary AI call
            print(f"Error during AI summary generation ({client_type}): {type(e_summary_ai).__name__}: {str(e_summary_ai)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"{client_type.capitalize()} AI summary generation failed: {str(e_summary_ai)}")
        
        actual_summary_output_tokens = count_tokens(summary_text)
        actual_summary_cost = (actual_summary_input_tokens + actual_summary_output_tokens) * SUMMARY_COST_PER_TOKEN
        integer_actual_summary_cost = math.ceil(actual_summary_cost)

        if db is not None:
            summary_message_record = {
                "user_id": ObjectId(user_id),
                "session_id": session_id,
                "role": "assistant",
                "content_type": "summary",
                "content": summary_text,
                "input_tokens": actual_summary_input_tokens,
                "output_tokens": actual_summary_output_tokens,
                "estimated_cost": integer_actual_summary_cost, # Storing the actual cost now
                "timestamp": datetime.utcnow(),
                "paper_context": {
                    "title": paper_data.title, 
                    "content_preview": paper_data.content[:500] + "..." if paper_data.content else ""
                }
            }
            db[CHAT_MESSAGES_COLLECTION].insert_one(summary_message_record)

        summary = summary_text.strip()
        summary = re.sub(r'<think>.*?</think>', '', summary, flags=re.DOTALL).strip()
        markdown_match = re.search(r'```(?:text|markdown)?\s*\n([\s\S]*?)\n```', summary, re.IGNORECASE)
        if markdown_match:
            summary = markdown_match.group(1).strip()
        else:
            generic_markdown_match = re.search(r'```\s*\n([\s\S]*?)\n```', summary, re.IGNORECASE)
            if generic_markdown_match:
                summary = generic_markdown_match.group(1).strip()
        prefix_patterns = [
            r"^\s*here(?:\'s| is) the summary:\s*",
            r"^\s*okay, here is the summary:\s*",
            r"^\s*summary\s*[:：]*\s*",
        ]
        for pattern in prefix_patterns:
            summary = re.sub(pattern, "", summary, flags= re.IGNORECASE).strip()
        summary = summary.strip()

        # 2. Generate code implementation
        project_suggestions = []
        
        code_prompt_full_context = f"Paper Title: {paper_data.title}\n"
        code_prompt_full_context += f"Generated Comprehensive Summary of the Paper: {summary}\n"
        # Include a larger excerpt of original content for code generation context, especially if abstract is short or missing
        # This helps ground the code generation in the paper's specifics.
        key_excerpt_limit = 5000
        code_prompt_full_context += f"Key Excerpt from Original Paper Content (for additional context):\n{paper_data.content[:key_excerpt_limit]}...\n"

        code_prompt = f"""
        You are an AI assistant specialized in generating advanced, practical, and well-structured code implementations based on academic research papers.
        Analyze the provided information from the paper, including its title, authors (if available), abstract (if available), a comprehensive summary, and key excerpts from the original content:
        {code_prompt_full_context}

        Your task is to generate 1 practical coding project at an advanced level that directly relates to or implements core concepts, algorithms, or methodologies discussed in the paper.
        The project should be sophisticated enough to be a good starting point for a real application or a detailed proof-of-concept.
        
        Provide:
        - title: A concise and descriptive title for the project.
        - description: A detailed description (4-6 sentences) explaining the project's purpose, how it directly relates to the paper (mention specific concepts if possible), its key features, and potential use cases.
        - language: The most suitable programming language for this project (e.g., Python, JavaScript, Java, C++, Rust). Choose the language that best fits the problem domain of the paper.
        - codeImplementation: A list of objects. Each object must have 'filename' (e.g., 'main.py', 'utils.js', 'model.java', 'Cargo.toml', 'package.json') and 'code' (the actual source code for that file). 
          The code should be as complete as possible for the core functionality, well-commented, and follow best practices for the chosen language. Include necessary boilerplate, imports, and example usage if applicable.

        Format your entire response as a single, valid JSON object. Ensure the JSON is well-formed and adheres strictly to the structure below. Do not include any text outside of this JSON object.
        Example JSON structure:
        {{
          "title": "Advanced Topic Modeling with Contextual Embeddings",
          "description": "This project implements a sophisticated topic modeling system using contextual embeddings (e.g., BERT, RoBERTa) as discussed in the paper. It goes beyond traditional LDA by capturing semantic nuances. Key features include preprocessing text data, generating embeddings, clustering embeddings to identify topics, and visualizing topic coherence. Potential use cases include analyzing large document sets for thematic trends or enhancing information retrieval systems.",
          "language": "Python",
          "codeImplementation": [
            {{
              "filename": "main.py",
              "code": "# Python code for main.py\n# Implements the core topic modeling pipeline.\nimport numpy as np\nfrom sklearn.cluster import KMeans\nfrom transformers import AutoTokenizer, AutoModel\n\n# Placeholder for actual implementation\ndef load_and_preprocess_data(texts):\n    # ... text cleaning, tokenization ...\n    return texts\n\ndef get_embeddings(texts, model_name='bert-base-uncased'):\n    tokenizer = AutoTokenizer.from_pretrained(model_name)\n    model = AutoModel.from_pretrained(model_name)\n    inputs = tokenizer(texts, padding=True, truncation=True, return_tensors='pt')\n    outputs = model(**inputs)\n    return outputs.last_hidden_state[:, 0, :].detach().numpy() # CLS token embeddings\n\ndef cluster_embeddings(embeddings, num_topics=10):\n    kmeans = KMeans(n_clusters=num_topics, random_state=42, n_init='auto')\n    kmeans.fit(embeddings)\n    return kmeans.labels_\n\ndef main():\n    sample_texts = [\"This is a document about machine learning.\", \"Deep learning is a subset of AI.\", \"Natural language processing is fascinating.\"]\n    processed_texts = load_and_preprocess_data(sample_texts)\n    embeddings = get_embeddings(processed_texts)\n    topic_labels = cluster_embeddings(embeddings)\n    for text, label in zip(sample_texts, topic_labels):\n        print(f'[Topic {label}] {text}')\n\nif __name__ == '__main__':\n    main()"
            }},
            {{
              "filename": "requirements.txt",
              "code": "numpy\nscikit-learn\ntransformers\ntorch"
            }}
          ]
        }}
        """
        actual_code_input_tokens = count_tokens(code_prompt)
        code_implementation_str = ""

        try:
            if client_type == "google":
                code_response = await ai_client.generate_content_async(
                    code_prompt, 
                    generation_config=generation_config_code # Changed from generation_config_code.to_dict()
                )
                code_implementation_str = code_response.text
            elif client_type == "groq":
                code_response_groq = ai_client.chat.completions.create(
                    model="mixtral-8x7b-32768",
                    messages=[
                        {"role": "system", "content": "You are an AI assistant that generates code implementations from academic papers in JSON format."},
                        {"role": "user", "content": code_prompt}
                    ],
                    temperature=0.5,
                    max_tokens=15000, 
                    top_p=0.2,
                    response_format={"type": "json_object"} 
                )
                code_implementation_str = code_response_groq.choices[0].message.content
            else:
                raise HTTPException(status_code=500, detail="Unsupported AI client type for code generation.")
        except Exception as e_code_ai: # Catch any exception from code AI call
            print(f"Error during AI code generation ({client_type}): {type(e_code_ai).__name__}: {str(e_code_ai)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"{client_type.capitalize()} AI code generation failed: {str(e_code_ai)}")
        
        actual_code_output_tokens = count_tokens(code_implementation_str)
        actual_code_gen_cost = (actual_code_input_tokens + actual_code_output_tokens) * CODE_GEN_COST_PER_TOKEN
        integer_actual_code_gen_cost = math.ceil(actual_code_gen_cost)

        cleaned_code_implementation_str = re.sub(r'<think>.*?</think>', '', code_implementation_str, flags= re.DOTALL).strip()
        json_markdown_match = re.search(r'```(?:json)?\s*\n([\s\S]*?)\n```', cleaned_code_implementation_str, re.IGNORECASE)
        if json_markdown_match:
            cleaned_code_implementation_str = json_markdown_match.group(1).strip()
        
        code_prefix_patterns = [
            r"^\s*here(?:\'s| is) the json(?: output| code)?:\s*",
            r"^\s*okay, here is the json(?: output| code)?:\s*",
        ]
        for pattern in code_prefix_patterns:
            cleaned_code_implementation_str = re.sub(pattern, "", cleaned_code_implementation_str, flags=re.IGNORECASE).strip()

        if db is not None:
            code_message_record = {
                "user_id": ObjectId(user_id),
                "session_id": session_id,
                "role": "assistant",
                "content_type": "code_suggestion",
                "content": cleaned_code_implementation_str, # Store the cleaned JSON string
                "input_tokens": actual_code_input_tokens,
                "output_tokens": actual_code_output_tokens,
                "estimated_cost": integer_actual_code_gen_cost, # Storing actual cost
                "timestamp": datetime.utcnow(),
                "paper_context": {
                    "title": paper_data.title, 
                    "summary_preview": summary[:300] + "..." if summary else ""
                }
            }
            db[CHAT_MESSAGES_COLLECTION].insert_one(code_message_record)

        try:
            # Ensure the string is not empty before parsing
            if not cleaned_code_implementation_str:
                raise ValueError("LLM returned an empty string for code implementation.")
            
            project_data_list = json.loads(cleaned_code_implementation_str)
            
            if isinstance(project_data_list, dict):
                project_data_list = [project_data_list]

            if not isinstance(project_data_list, list) or not project_data_list:
                 raise ValueError("Parsed JSON is not a list or is an empty list.")

            for project_data in project_data_list:
                if not isinstance(project_data, dict): 
                    print(f"Skipping non-dict item in project list: {project_data}")
                    continue

                raw_code_impl = project_data.get("codeImplementation", project_data.get("code"))
                code_files = []

                if isinstance(raw_code_impl, list): 
                    for file_obj in raw_code_impl:
                        if isinstance(file_obj, dict) and "filename" in file_obj and "code" in file_obj:
                            code_files.append(CodeFile(filename=str(file_obj["filename"]), code=str(file_obj["code"])))
                        else:
                            print(f"Skipping malformed file object in codeImplementation list: {file_obj}")
                elif isinstance(raw_code_impl, str): 
                    lang = project_data.get("language", "python").lower()
                    default_filename = f"script.{'py' if lang == 'python' else 'js' if lang == 'javascript' else 'txt'}"
                    code_files.append(CodeFile(filename=default_filename, code=raw_code_impl))
                
                if not code_files and raw_code_impl: # If raw_code_impl was present but not parsed into code_files
                    print(f"Code implementation was present but not parsed into files. Raw: {raw_code_impl}")
                    code_files.append(CodeFile(filename="unparsed_code.txt", code=str(raw_code_impl)))
                elif not code_files: # If no code files could be made at all
                     code_files.append(CodeFile(filename="empty_script.txt", code="# Code generation failed, was empty, or format was not recognized."))

                project_suggestions.append(
                    ProjectSuggestion(
                        title=str(project_data.get("title", "Untitled Project")),
                        description=str(project_data.get("description", "No description provided.")),
                        codeImplementation=code_files,
                        language=str(project_data.get("language", "Python"))
                    )
                )
            if not project_suggestions: 
                raise ValueError("JSON was parsed, but no valid project data was processed into suggestions.")

        except Exception as e_json_parsing:
            error_message = f"Error parsing JSON or processing project data: {str(e_json_parsing)}. Raw LLM output: {cleaned_code_implementation_str[:1000]}..."
            print(error_message)
            # Fallback: provide the raw (but cleaned) string as a single code file
            project_suggestions.append(
                ProjectSuggestion(
                    title="Generated Code (Fallback)",
                    description=f"Could not fully parse structured JSON output from LLM. Error: {str(e_json_parsing)}. Displaying the raw attempt.",
                    codeImplementation=[CodeFile(filename="llm_output_fallback.txt", code=cleaned_code_implementation_str if cleaned_code_implementation_str else "# Code generation failed or LLM returned empty.")],
                    language="text"
                )
            )
        
        if not project_suggestions: # Final safety net
            project_suggestions = [
                ProjectSuggestion(
                    title="Advanced Implementation (Final Fallback)", 
                    description="The system was unable to generate or parse a code suggestion. This is a default placeholder.", 
                    codeImplementation=[CodeFile(filename="final_fallback_script.py", code="# Default fallback: No code generated or parsed.")], 
                    language="Python"
                )
            ]

        # Deduct actual cost
        actual_total_cost = integer_actual_summary_cost + integer_actual_code_gen_cost
        if db is not None:
            db[USERS_COLLECTION].update_one(
                {"_id": ObjectId(user_id)},
                {"$inc": {"credits": -actual_total_cost}}
            )
            # Log the credit deduction
            credit_log_entry = {
                "user_id": ObjectId(user_id),
                "session_id": session_id, # Link to the specific interaction
                "type": "deduction",
                "amount": actual_total_cost,
                "reason": "Paper processing (summary and code generation)",
                "timestamp": datetime.utcnow(),
                "details": {
                    "summary_cost": integer_actual_summary_cost,
                    "code_gen_cost": integer_actual_code_gen_cost,
                    "paper_title": paper_data.title
                }
            }
            db[CREDIT_LOGS_COLLECTION].insert_one(credit_log_entry)

        return ProcessedPaper(
            summary=summary,
            projectSuggestions=project_suggestions,
            credits_remaining=user_credits - actual_total_cost # Return updated credits
        )

    except HTTPException as http_exc: # Specific catch for HTTPExceptions
        raise http_exc
    except NameError as name_err: # Specific catch for NameError before generic Exception
        print(f"Outer NameError caught in process_paper: {str(name_err)}")
        import traceback
        traceback.print_exc()
        # Log to DB if possible
        if db is not None and user_id and session_id:
            error_log = {
                "user_id": ObjectId(user_id),
                "session_id": session_id,
                "error_type": type(name_err).__name__,
                "error_message": str(name_err),
                "traceback": traceback.format_exc(),
                "timestamp": datetime.utcnow(),
                "api_endpoint": "/api/process-paper",
                "request_data": paper_data.model_dump_json(indent=2) 
            }
            log_error_to_db(error_log)
        raise HTTPException(status_code=500, detail=f"An unexpected NameError occurred: {str(name_err)}")
    except Exception as e_outer: # Generic catch-all for other exceptions
        print(f"Outer generic Exception caught in process_paper: {type(e_outer).__name__}: {str(e_outer)}")
        import traceback
        traceback.print_exc()
        if db is not None and user_id and session_id:
            error_log = {
                "user_id": ObjectId(user_id),
                "session_id": session_id,
                "error_type": type(e_outer).__name__,
                "error_message": str(e_outer),
                "traceback": traceback.format_exc(),
                "timestamp": datetime.utcnow(),
                "api_endpoint": "/api/process-paper",
                "request_data": paper_data.model_dump_json(indent=2)
            }
            log_error_to_db(error_log)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e_outer)}")

def log_error_to_db(error_details: dict):
    """Logs an error to the database."""
    try:
        # Remove the specific error logging to ERROR_LOGS_COLLECTION
        # db[ERROR_LOGS_COLLECTION].insert_one(error_log)
        print(f"Error logged (in theory): {error_details}")
    except Exception as e:
        print(f"Failed to log error: {str(e)}")

@app.get("/")
async def root():
    return {"message": "DeepRead API is running"}

# Endpoints para la gestión de chats
@app.post("/api/chat/sessions", response_model=ChatSessionResponse)
async def save_chat_session(request: SaveChatSessionRequest, current_user: dict = Depends(get_current_user)):
    """
    Guarda o actualiza una sesión de chat completa.
    Si la sesión tiene un ID, se actualiza. Si no, se crea una nueva.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection not available")
    
    user_id = current_user["_id"]
    user_id_str = str(user_id)
    print(f"Saving chat session for user ID: {user_id_str}")
    
    session = request.session
    now = datetime.utcnow()
    
    # Si no tiene lastUpdated o es None, establecerlo ahora
    if not session.lastUpdated:
        session.lastUpdated = now
        
    print(f"Session to save: id={session.id}, title={session.title}, messages={len(session.messages)}")
    
    # Verificar que la colección existe y crearla si no existe
    if CHAT_SESSIONS_COLLECTION not in db.list_collection_names(): # UPDATED
        print(f"Collection {CHAT_SESSIONS_COLLECTION} doesn't exist, will be created automatically")
    
    # Preparar el documento para MongoDB
    session_doc = {
        "user_id": user_id,  # Usar directamente el ObjectId
        "title": session.title,
        "last_updated": session.lastUpdated
    }
    
    try:
        # Verificar si estamos actualizando o creando
        creating_new = not session.id or session.id == "default" or session.id == "new"
        
        if not creating_new:
            # Verificar si el ID proporcionado es válido
            try:
                session_object_id = ObjectId(session.id)
                print(f"Updating existing session with ID: {session.id}")
                
                # Actualizar sesión existente
                result = db[CHAT_SESSIONS_COLLECTION].update_one( # UPDATED
                    {"_id": session_object_id, "user_id": user_id},
                    {"$set": {"title": session.title, "last_updated": session.lastUpdated}}
                )
                
                if result.matched_count == 0:
                    print(f"No session found with ID {session.id} for user {user_id_str}, creating new")
                    creating_new = True
                else:
                    print(f"Session updated: {result.modified_count} document(s) modified")
                    session_id = session.id
            except Exception as e:
                print(f"Invalid session ID format: {session.id}, error: {str(e)}")
                creating_new = True
        
        if creating_new:
            # Crear nueva sesión
            print("Creating new chat session")
            result = db[CHAT_SESSIONS_COLLECTION].insert_one(session_doc) # UPDATED
            session_id = str(result.inserted_id)
            print(f"Created new session with ID: {session_id}")
        
        # Manejar los mensajes
        session_object_id = ObjectId(session_id)
        
        # Verificar que la colección de mensajes existe
        if CHAT_MESSAGES_COLLECTION not in db.list_collection_names(): # UPDATED
            print(f"Collection {CHAT_MESSAGES_COLLECTION} doesn't exist, will be created automatically")
        
        # Primero eliminar los mensajes existentes si estamos actualizando
        if not creating_new:
            delete_result = db[CHAT_MESSAGES_COLLECTION].delete_many({"session_id": session_object_id}) # UPDATED
            print(f"Deleted {delete_result.deleted_count} existing message(s)")
        
        # Insertar los nuevos mensajes
        if session.messages:
            messages_to_insert = []
            for msg in session.messages:
                message_doc = {
                    "user_id": user_id,  # Usar directamente el ObjectId
                    "session_id": session_object_id,
                    "content": msg.content,
                    "role": msg.role,
                    "timestamp": msg.timestamp or now
                }
                
                # Si tiene paperData o processedData, incluirlos
                if msg.paperData:
                    message_doc["paper_data"] = msg.paperData
                if msg.processedData:
                    message_doc["processed_data"] = msg.processedData
                
                messages_to_insert.append(message_doc)
            
            if messages_to_insert:
                insert_result = db[CHAT_MESSAGES_COLLECTION].insert_many(messages_to_insert) # UPDATED
                print(f"Inserted {len(insert_result.inserted_ids)} message(s)")
        
        # Verificar que la sesión se creó/actualizó correctamente
        verification = db[CHAT_SESSIONS_COLLECTION].find_one({"_id": session_object_id}) # UPDATED
        if verification:
            print(f"Verified session exists: {verification.get('title', 'No title')}")
        else:
            print(f"WARNING: Could not verify session with ID {session_id}")
        
        # Verificar el número de mensajes guardados
        messages_count = db[CHAT_MESSAGES_COLLECTION].count_documents({"session_id": session_object_id})  # UPDATED
        print(f"Verified {messages_count} message(s) for session {session_id}")

        # Obtener mensajes desde la base de datos en lugar de usar session.messages
        messages = []
        messages_cursor = db[CHAT_MESSAGES_COLLECTION].find({"session_id": session_object_id}).sort("timestamp", 1)
        for msg in messages_cursor:
            msg_data = {
                "id": str(msg["_id"]),
                "content": msg["content"],
                "role": msg["role"],
                "timestamp": msg["timestamp"]
            }
            if "paper_data" in msg:
                msg_data["paperData"] = msg["paper_data"]
            if "processed_data" in msg:
                msg_data["processedData"] = msg["processed_data"]
            messages.append(ChatMessage(**msg_data))

        # Devolver la sesión guardada con sus mensajes
        return {
            "id": session_id,
            "title": session.title,
            "lastUpdated": session.lastUpdated or now,
            "messages": messages
        }
    
    except Exception as e:
        print(f"Error saving chat session: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error saving chat session: {str(e)}")

@app.get("/api/chat/sessions", response_model=ChatSessionsResponse)
async def get_chat_sessions(current_user: dict = Depends(get_current_user)):
    """
    Obtiene todas las sesiones de chat del usuario actual.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection not available")
    
    user_id = current_user["_id"]
    print(f"Finding chat sessions for user ID: {user_id}")
    
    try:
        # Obtener todas las sesiones del usuario
        # Convertir ObjectId a str para debugging
        user_id_str = str(user_id)
        print(f"User ID (str): {user_id_str}")
        
        # Verificar que la colección existe
        collections = db.list_collection_names()
        print(f"Collections in database: {collections}")
        if CHAT_SESSIONS_COLLECTION not in collections: # UPDATED
            print(f"{CHAT_SESSIONS_COLLECTION} collection does not exist in database") # UPDATED
            return {"sessions": []}
        
        # Contar documentos en la colección para debug
        total_sessions = db[CHAT_SESSIONS_COLLECTION].count_documents({}) # UPDATED
        user_sessions_count = db[CHAT_SESSIONS_COLLECTION].count_documents({"user_id": user_id}) # UPDATED
        print(f"Total sessions in DB: {total_sessions}, User sessions: {user_sessions_count}")
        
        # Obtener las sesiones usando find
        sessions_cursor = db[CHAT_SESSIONS_COLLECTION].find({"user_id": user_id}).sort("last_updated", -1) # UPDATED
        sessions_list = list(sessions_cursor)
        print(f"Found {len(sessions_list)} sessions for user {user_id_str}")
        
        if len(sessions_list) == 0:
            print("No sessions found for this user")
            return {"sessions": []}
        
        sessions = []
        
        # Función no asíncrona para obtener mensajes
        def get_messages_for_session(session_id):
            messages_cursor = db[CHAT_MESSAGES_COLLECTION].find({"session_id": session_id}).sort("timestamp", 1) # UPDATED
            messages = []
            for msg in messages_cursor:
                message = {
                    "id": str(msg["_id"]),
                    "content": msg["content"],
                    "role": msg["role"],
                    "timestamp": msg["timestamp"]
                }
                
                if "paper_data" in msg:
                    message["paperData"] = msg["paper_data"]
                if "processed_data" in msg:
                    message["processedData"] = msg["processed_data"]
                
                messages.append(ChatMessage(**message))
            
            return messages
        
        # Procesar cada sesión
        for session in sessions_list:
            session_id = session["_id"]
            
            # Debug info
            print(f"Processing session: {session_id}, title: {session.get('title', 'No title')}")
            
            messages = get_messages_for_session(session_id)
            print(f"Found {len(messages)} messages for session {session_id}")
            
            sessions.append(
                ChatSession(
                    id=str(session_id),
                    title=session.get("title", "Untitled"),  # Usar get con valor por defecto
                    lastUpdated=session.get("last_updated", datetime.utcnow()),  # Usar get con valor por defecto
                    messages=messages
                )
            )
        
        print(f"Returning {len(sessions)} sessions for user {user_id_str}")
        return {"sessions": sessions}
    
    except Exception as e:
        print(f"Error getting chat sessions: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error getting chat sessions: {str(e)}")

@app.get("/api/chat/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """
    Obtiene una sesión de chat específica con todos sus mensajes.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection not available")
    
    user_id = current_user["_id"]
    
    try:
        # Verificar que la sesión pertenezca al usuario
        session = db[CHAT_SESSIONS_COLLECTION].find_one({ # UPDATED
            "_id": ObjectId(session_id),
            "user_id": user_id
        })
        
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Obtener todos los mensajes de la sesión
        messages_cursor = db[CHAT_MESSAGES_COLLECTION].find({"session_id": ObjectId(session_id)}).sort("timestamp", 1) # UPDATED
        messages = []
        
        for msg in messages_cursor:
            message = {
                "id": str(msg["_id"]),
                "content": msg["content"],
                "role": msg["role"],
                "timestamp": msg["timestamp"]
            }
            
            if "paper_data" in msg:
                message["paperData"] = msg["paper_data"]
            if "processed_data" in msg:
                message["processedData"] = msg["processed_data"]
            
            messages.append(ChatMessage(**message))
        
        return {
            "id": session_id,
            "title": session["title"],
            "lastUpdated": session["last_updated"],
            "messages": messages
        }
    
    except Exception as e:
        print(f"Error getting chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting chat session: {str(e)}")

@app.delete("/api/chat/sessions/{session_id}", status_code=204) # Added status_code for no content
async def delete_chat_session_endpoint(session_id: str, current_user: dict = Depends(get_current_user)):
    """
    Elimina una sesión de chat específica y todos sus mensajes asociados.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection not available")

    user_id = current_user["_id"]
    print(f"Attempting to delete chat session ID: {session_id} for user ID: {user_id}")

    try:
        session_object_id = ObjectId(session_id)
    except Exception as e:
        print(f"Invalid session ID format: {session_id}, error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid session ID format: {session_id}")

    # Primero, verificar que la sesión pertenece al usuario y existe
    session_to_delete = db[CHAT_SESSIONS_COLLECTION].find_one({
        "_id": session_object_id,
        "user_id": user_id
    })

    if not session_to_delete:
        print(f"Chat session not found or user mismatch. Session ID: {session_id}, User ID: {user_id}")
        raise HTTPException(status_code=404, detail="Chat session not found or access denied")

    # Eliminar los mensajes asociados a la sesión
    delete_messages_result = db[CHAT_MESSAGES_COLLECTION].delete_many({
        "session_id": session_object_id,
        "user_id": user_id  # Asegurar que solo se borran mensajes del usuario propietario de la sesión
    })
    print(f"Deleted {delete_messages_result.deleted_count} message(s) for session ID: {session_id}")

    # Eliminar la sesión de chat
    delete_session_result = db[CHAT_SESSIONS_COLLECTION].delete_one({
        "_id": session_object_id,
        "user_id": user_id
    })

    if delete_session_result.deleted_count == 0:
        # Esto no debería ocurrir si la verificación anterior pasó, pero es una salvaguarda
        print(f"Failed to delete chat session (already deleted or error). Session ID: {session_id}")
        raise HTTPException(status_code=404, detail="Chat session could not be deleted, may have been already removed")
    
    print(f"Successfully deleted chat session ID: {session_id}")
    return # FastAPI manejará la respuesta 204 No Content

@app.get("/api/debug/db-status")
async def get_db_status():
    """
    Endpoint de diagnóstico para verificar el estado de la base de datos
    """
    if db is None:
        return {"status": "error", "message": "Database connection not available"}
    
    try:
        # Verificar la conexión a MongoDB
        client.admin.command('ping')
        
        # Obtener información sobre las colecciones
        collections = db.list_collection_names()
        collection_info = {}
        
        for collection_name in collections:
            collection_info[collection_name] = db[collection_name].count_documents({})
            
            # Para chat_sessions, mostrar información más detallada
            if collection_name == CHAT_SESSIONS_COLLECTION: # UPDATED
                # Obtener todos los user_ids únicos
                user_ids = db[collection_name].distinct("user_id")
                users_with_sessions = []
                
                for uid in user_ids:
                    session_count = db[collection_name].count_documents({"user_id": uid})
                    users_with_sessions.append({
                        "user_id": str(uid),
                        "session_count": session_count
                    })
                
                collection_info["chat_sessions_by_user"] = users_with_sessions
                
                # Mostrar una muestra de sesiones para diagnóstico
                sample_sessions = list(db[collection_name].find().limit(5))
                sample_data = []
                
                for session in sample_sessions:
                    sample_data.append({
                        "id": str(session["_id"]),
                        "user_id": str(session["user_id"]),
                        "title": session.get("title", "No title"),
                        "last_updated": session.get("last_updated", "No date")
                    })
                
                collection_info["chat_sessions_sample"] = sample_data
        
        return {
            "status": "connected",
            "database": DATABASE_NAME,
            "collections": collections,
            "collection_info": collection_info
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error checking database: {str(e)}"
        }

if __name__  == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


