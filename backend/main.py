from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from typing import List, Optional
import os
from io import BytesIO
import PyPDF2
import re

from groq import Groq


app = FastAPI()

# Enable CORS for our frontend
# Eliminar cualquier referencia a Railway y ajustar la configuración de CORS para permitir únicamente solicitudes desde Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://deepread.vercel.app"  # Permitir solo solicitudes desde Vercel
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Together AI API key

# Models
SUMMARY_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free"
CODE_MODEL = "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free"

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
        
        # Extract title (from filename or first line of text)
        title = file.filename.replace(".pdf", "")
        
        # In a real implementation, we would extract authors, abstract, etc.
        # For now, we'll return simplified data
        paper_data = PaperData(
            title=title,
            content=text[:10000],  # Limit content length
            authors=["Extracted Author"],  # Placeholder
            abstract=text[:500] if len(text) > 500 else text,  # Simple abstract extraction
            date=None  # Placeholder
        )
        
        return paper_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# Initialize Groq client
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

@app.post("/api/process-paper", response_model=ProcessedPaper)
async def process_paper(paper_data: PaperData):
    try:
        # Remove <think> tokens from the summary

        # Adjust max_tokens for summary and code generation
        max_summary_tokens = 2048  # Adjusted for concise summaries
        max_code_tokens = 8192  # Adjusted for detailed code implementations

        # Generate summary using Groq model
        summary_response = client.chat.completions.create(
            model="deepseek-r1-distill-llama-70b",
            messages=[
                {"role": "system", "content": "You are an AI assistant specialized in summarizing academic papers. Provide a concise and well-structured summary of the paper."},
                {"role": "user", "content": f"Title: {paper_data.title}\n\nContent: {paper_data.content}\n\nPlease provide a concise and well-structured summary of this paper."}
            ],
            temperature=0.2,
            max_tokens=max_summary_tokens,
            top_p=0.2,  # Reduced for more focused output
            stream=True
        )
        summary_text = ""
        for chunk in summary_response:
            summary_text += chunk.choices[0].delta.content or ""

        # Remove asterisks from key points in the summary
        summary_text = re.sub(r"\*\*(.*?)\*\*", r"\1", summary_text)
        summary_text = re.sub(r"<think>.*?</think>", "", summary_text, flags=re.DOTALL)

        # Generate code implementation based on paper content
        project_suggestions = []

        # Generate code implementation using LLM
        code_response = client.chat.completions.create(
            model="deepseek-r1-distill-llama-70b",
            messages=[
                {"role": "system", "content": "You are an AI assistant specialized in generating advanced code implementations based on academic papers."},
                {"role": "user", "content": f"Title: {paper_data.title}\n\nContent: {paper_data.content}\n\nPlease generate an advanced code implementation based on the concepts and methods described in this paper."}
            ],
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

        # Add the generated code as a project suggestion
        project_suggestions.append(
            ProjectSuggestion(
                title="Generated Code Implementation",
                description=f"An advanced code implementation based on the concepts in {paper_data.title}",
                difficulty="Advanced",
                codeImplementation=code_implementation.strip(),
                language="python"  # Assuming Python as the default language
            )
        )

        return ProcessedPaper(
            summary=summary_text.strip(),
            keyPoints=[],  # Removed key points
            projectSuggestions=project_suggestions
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing paper with LLM: {str(e)}")

@app.get("/")
async def root():
    return {"message": "DeepRead API is running"}


