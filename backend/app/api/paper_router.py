from fastapi import APIRouter, HTTPException, Depends, Request
from pymongo.database import Database as MongoDatabase
from bson import ObjectId
import math
import re
import json
from datetime import datetime
import traceback # For logging

# Models
from app.models.user_models import UserInDB
from app.models.paper_models import PaperData, ProcessedPaper, ProjectSuggestion, CodeFile

# Core and DB
from app.core.config import settings
from app.db.database import get_db
from app.core.security import get_current_active_user

# Services
from app.services.ai_services import get_ai_client_from_state, count_tokens
from app.services.credit_services import deduct_user_credits

# Utilities / Logging
from app.core.logging import log_error_to_db # Import the centralized logger

router = APIRouter()

@router.post("/process-paper", response_model=ProcessedPaper, tags=["Paper Processing"])
async def process_paper_endpoint( # Renamed to avoid conflict if we were to import main's version
    paper_data: PaperData,
    request: Request,
    current_user: UserInDB = Depends(get_current_active_user),
    db: MongoDatabase = Depends(get_db)
):
    ai_client, client_name = get_ai_client_from_state(request)

    input_tokens = count_tokens(paper_data.text_content)
    estimated_cost_summary = math.ceil((input_tokens + settings.ESTIMATED_SUMMARY_OUTPUT_TOKENS) * settings.SUMMARY_COST_PER_TOKEN)
    estimated_cost_codegen = math.ceil((input_tokens + settings.ESTIMATED_CODE_OUTPUT_TOKENS) * settings.CODE_GEN_COST_PER_TOKEN)
    total_estimated_cost = estimated_cost_summary + estimated_cost_codegen

    if current_user.credits < total_estimated_cost:
        raise HTTPException(status_code=402, detail=f"Insufficient credits. Required: {total_estimated_cost}, Available: {current_user.credits}")

    await deduct_user_credits(user_id=current_user.id, amount=total_estimated_cost, reason="paper_processing", db=db)

    summary_text = "Summary generation failed or skipped."
    project_suggestions_list = []

    try:
        summary_prompt = f"""
        Analyze the following research paper text and provide a concise summary.
        The summary should be between 150 and 200 words.
        Focus on the key findings, methodology, and conclusions.
        Do not include any introductory phrases like "This paper discusses..." or "The authors of this paper...".
        Just provide the summary directly.

        Paper Text:
        {paper_data.text_content}
        """
        if client_name == "gemini" and ai_client:
            response = await ai_client.generate_content_async(summary_prompt) # Assuming async version
            summary_text = response.text
        else:
            raise HTTPException(status_code=503, detail="AI summary client not available.")
        
        summary_text = re.sub(r'^```(json)?\\s*|\\s*```$', '', summary_text.strip())

        code_gen_prompt = f"""
        Based on the following research paper text, suggest 2-3 distinct small project ideas
        that could implement or explore concepts from the paper.
        For each project idea, provide:
        1. A short project_name (e.g., "SentimentAnalyzer", "ImageClassifierCNN").
        2. A brief description of the project.
        3. A list of key technologies or libraries that could be used (e.g., ["Python", "TensorFlow", "Flask"]).
        4. One example code file (e.g., a 'main.py' or a core component) with illustrative code.
           The code should be functional if possible, or at least a well-structured skeleton.
           Specify the file_name for this code.

        Format the output as a JSON list of objects. Each object should have keys:
        "project_name", "description", "technologies", and "files" (where "files" is a list of objects,
        each with "file_name" and "code").

        Example JSON structure for one project:
        {{
            "project_name": "ExampleProject",
            "description": "This project demonstrates a concept.",
            "technologies": ["Python", "FastAPI"],
            "files": [
                {{
                    "file_name": "main.py",
                    "code": "# main.py\\\\nprint(\\\\"Hello World\\\\\")"
                }}
            ]
        }}
        Ensure the entire output is a valid JSON list.

        Paper Text:
        {paper_data.text_content}
        """

        if client_name == "gemini" and ai_client:
            response = await ai_client.generate_content_async(code_gen_prompt) # Assuming async version
            raw_suggestions = response.text
        else:
            raise HTTPException(status_code=503, detail="AI code generation client not available.")

        try:
            cleaned_suggestions = re.sub(r'^```(json)?\\s*|\\s*```$', '', raw_suggestions.strip())
            project_suggestions_list_raw = json.loads(cleaned_suggestions)
            
            for proj_data in project_suggestions_list_raw:
                valid_files = []
                if "files" in proj_data and isinstance(proj_data["files"], list):
                    for file_data in proj_data["files"]:
                        if isinstance(file_data, dict) and "file_name" in file_data and "code" in file_data:
                            valid_files.append(CodeFile(file_name=file_data["file_name"], code=file_data["code"]))
                
                project_suggestions_list.append(
                    ProjectSuggestion(
                        project_name=proj_data.get("project_name", "Unnamed Project"),
                        description=proj_data.get("description", "No description provided."),
                        technologies=proj_data.get("technologies", []),
                        files=valid_files
                    )
                )
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON for project suggestions: {e}")
            # Log to DB as well
            error_details_json = {
                "timestamp": datetime.utcnow().isoformat(),
                "path": str(request.url),
                "method": request.method,
                "user_id": str(current_user.id),
                "error_type": "JSONDecodeError",
                "error_message": f"Failed to parse AI suggestions: {str(e)}",
                "context": "Project Suggestion Parsing",
                "raw_ai_output": raw_suggestions 
            }
            await log_error_to_db(error_details_json, db) # Use centralized logger
            project_suggestions_list.append(ProjectSuggestion(project_name="Error",description="Failed to parse suggestions.",technologies=[],files=[]))

        except Exception as e: # Catch other errors during suggestion processing
            print(f"Error processing project suggestions: {e}")
            error_details_processing = {
                "timestamp": datetime.utcnow().isoformat(),
                "path": str(request.url),
                "method": request.method,
                "user_id": str(current_user.id),
                "error_type": e.__class__.__name__,
                "error_message": f"General error processing AI suggestions: {str(e)}",
                "traceback": traceback.format_exc(),
                "context": "Project Suggestion Processing"
            }
            await log_error_to_db(error_details_processing, db) # Use centralized logger
            project_suggestions_list.append(ProjectSuggestion(project_name="Error",description=f"Error: {str(e)}",technologies=[],files=[]))


    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        print(f"Error during AI processing for user {current_user.email}: {e}")
        error_log = {
            "user_id": str(current_user.id),
            "paper_name": paper_data.file_name, # Ensure paper_data has file_name
            "error_message": str(e),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.utcnow(),
            "path": str(request.url),
            "method": request.method,
            "context": "Main AI Processing Block"
        }
        await log_error_to_db(error_log, db) # Use the centralized logger
        # Decide on a generic error or re-raise a specific HTTPException
        raise HTTPException(status_code=500, detail="An error occurred during paper processing.")

    return ProcessedPaper(
        summary=summary_text,
        project_suggestions=project_suggestions_list
    )
