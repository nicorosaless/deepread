
# DeepRead Backend

This is the Python FastAPI backend for DeepRead, an application that processes academic papers using LLMs.

## Setup Instructions

1. Create a virtual environment:
   ```
   python -m venv venv
   ```

2. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Run the FastAPI server:
   ```
   uvicorn main:app --reload
   ```

The API will be available at http://localhost:8000

## API Endpoints

- `GET /`: Health check endpoint
- `POST /api/extract-pdf`: Extract text from PDF uploads
- `POST /api/process-paper`: Process paper content with LLMs

## Environment Variables

In a production environment, you should set:
- `TOGETHER_API_KEY`: Your Together AI API key
