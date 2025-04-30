
import { PaperData, ProcessedPaper } from './types';

const API_BASE_URL = 'http://localhost:8000'; // Update this to match your FastAPI server URL

export async function extractTextFromPDF(file: File): Promise<PaperData> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/api/extract-pdf`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Error extracting text from PDF');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

export async function processPaperWithLLM(paperData: PaperData): Promise<ProcessedPaper> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/process-paper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paperData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Error processing paper with LLM');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error processing paper with LLM:", error);
    throw new Error("Failed to process paper with LLM");
  }
}
