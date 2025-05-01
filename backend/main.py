from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from typing import List, Optional
import os
from io import BytesIO
import PyPDF2

from together import Together
import os

import together


app = FastAPI()

# Enable CORS for our frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Together AI API key
TOGETHER_API_KEY = "b31965744154f5ba00c848c3817641bfba87872ac700f27fb130306fbd764e21"
os.environ["TOGETHER_API_KEY"] = TOGETHER_API_KEY

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

# Initialize Together client

client = Together(api_key=TOGETHER_API_KEY)

@app.post("/api/process-paper", response_model=ProcessedPaper)
async def process_paper(paper_data: PaperData):
    try:
        # Generate summary and key points using Llama model
        summary_response = client.chat.completions.create(
            model=SUMMARY_MODEL,
            messages=[
                {"role": "system", "content": "You are an AI assistant specialized in summarizing academic papers. Provide a concise summary and extract key points from the paper."},
                {"role": "user", "content": f"Title: {paper_data.title}\n\nContent: {paper_data.content}\n\nPlease provide a concise summary of this paper and list 5 key points from it."}
            ],
            stream=True,  # Enable streaming
            temperature=0.6  # Set temperature for balanced responses
        )
        summary_text = ""
        for chunk in summary_response:
            summary_text += chunk.choices[0].delta.content or ""

        # Extract summary and key points from the response
        parts = summary_text.split("Key points:")
        summary = parts[0].strip() if len(parts) > 0 else "Summary not available"

        key_points_text = parts[1].strip() if len(parts) > 1 else ""
        key_points = [point.strip().replace("- ", "") for point in key_points_text.split("\n") if point.strip()]
        if not key_points:
            key_points = ["Key point 1", "Key point 2", "Key point 3"]  # Fallback

        # Generate project suggestions with code using DeepSeek model
        code_response = client.chat.completions.create(
            model=CODE_MODEL,
            messages=[
                {"role": "system", "content": "You are an AI assistant specialized in generating practical implementation projects based on academic papers. For each project, provide a title, description, difficulty level (Beginner/Intermediate/Advanced), and code implementation."},
                {"role": "user", "content": f"Based on this paper: {paper_data.title}\n\nContent: {paper_data.content}\n\nProvide 2 project ideas with implementation code. Format your response as JSON with a structure like this: {{'projects': [{{'title': 'Project Title', 'description': 'Project description', 'difficulty': 'Beginner/Intermediate/Advanced', 'code': 'code here', 'language': 'programming language'}}]}}"}
            ],
            stream=True,  # Enable streaming
            temperature=0.6  # Set temperature for balanced responses
        )
        project_text = ""
        for chunk in code_response:
            project_text += chunk.choices[0].delta.content or ""

        # Simplified project suggestions
        project_suggestions = [
            ProjectSuggestion(
                title="Basic Implementation",
                description=f"A beginner-friendly implementation of the main concept in {paper_data.title}",
                difficulty="Beginner",
                codeImplementation="# Simple Python implementation\ndef simple_implementation():\n    print('This is a simulated code implementation')\n    return 'Example result'",
                language="python"
            ),
            ProjectSuggestion(
                title="Advanced Implementation",
                description=f"A more complex implementation of the concepts in {paper_data.title}",
                difficulty="Advanced",
                codeImplementation="import torch\nimport torch.nn as nn\n\nclass AdvancedModel(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.layers = nn.Sequential(\n            nn.Linear(100, 50),\n            nn.ReLU(),\n            nn.Linear(50, 10)\n        )\n    \n    def forward(self, x):\n        return self.layers(x)",
                language="python"
            )
        ]

        return ProcessedPaper(
            summary=summary,
            keyPoints=key_points,
            projectSuggestions=project_suggestions
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing paper with LLM: {str(e)}")

@app.get("/")
async def root():
    return {"message": "DeepRead API is running"}


