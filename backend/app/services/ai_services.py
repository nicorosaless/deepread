# app/services/ai_services.py
from fastapi import Request, HTTPException
from typing import Optional, Any, List
import tiktoken
import re

from app.core.config import settings

def get_ai_client_from_state(request: Request) -> tuple[Optional[Any], Optional[str]]:
    """
    Retrieves the Google Gemini AI client from the application state.
    
    Args:
        request: The FastAPI Request object to access app.state.
        
    Returns:
        A tuple containing the AI client instance and the client name ('gemini'),
        or (None, None) if the client is not available or configured.
    """
    gemini_client = getattr(request.app.state, 'gemini_client', None)

    if gemini_client is not None:
        return gemini_client, "gemini"
    
    # No client available
    return None, None

def count_tokens(text: str, model_name: str = "gpt-3.5-turbo") -> int:
    """
    Counts the number of tokens in a given text string using tiktoken.
    Uses "gpt-3.5-turbo" as a default model for encoding, falling back to "cl100k_base".
    
    Args:
        text: The text to count tokens for.
        model_name: The model name to use for token encoding.
        
    Returns:
        The number of tokens.
    """
    try:
        encoding = tiktoken.encoding_for_model(model_name)
    except KeyError:
        # Fallback encoding if the model_name is not found
        encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))

# Example of a more complex AI interaction function that could live here:
async def generate_summary_from_text(
    request: Request, 
    text_content: str,
    max_words: int = 200 # Example parameter
) -> str:
    ai_client, client_name = get_ai_client_from_state(request)
    if not ai_client:
        raise HTTPException(status_code=503, detail="AI service not available for summary generation.")

    prompt = f'''
    Analyze the following research paper text and provide a concise summary.
    The summary should be approximately {max_words} words.
    Focus on the key findings, methodology, and conclusions.
    Do not include any introductory phrases like "This paper discusses..." or "The authors of this paper...".
    Just provide the summary directly.

    Paper Text:
    {text_content}
    '''

    summary_text = "Summary generation failed."
    try:
        # Only using Gemini since we removed all other providers
        response = ai_client.generate_content(prompt)
        summary_text = response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")

    return summary_text
