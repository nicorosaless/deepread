
# DeepRead

DeepRead is an application that transforms academic papers into practical implementations using AI.

## Features

- Upload academic papers (PDF format)
- Extract content from papers
- Generate summaries and key points
- Suggest practical implementation projects with code examples

## Project Structure

- `/src`: React frontend
- `/backend`: Python FastAPI backend

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Run the FastAPI server:
   ```
   uvicorn main:app --reload
   ```

### Frontend Setup

1. Install frontend dependencies:
   ```
   npm install
   ```

2. Run the development server:
   ```
   npm run dev
   ```

## Technologies Used

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Python, FastAPI
- **AI Models**: Together AI (Llama-3.3-70B and DeepSeek-R1-Distill-Llama-70B)

## How It Works

1. Upload a PDF of an academic paper
2. The backend extracts text content from the PDF
3. The content is sent to Together AI's LLMs:
   - Llama-3.3-70B for generating summaries and key points
   - DeepSeek-R1-Distill-Llama-70B for generating code implementations
4. Results are displayed in an easy-to-understand format
