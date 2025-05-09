import { PaperData, ProcessedPaper } from './types';
import BASE_URL from './utils'; // Import BASE_URL from utils.ts

export async function extractTextFromPDF(file: File): Promise<PaperData> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/api/extract-pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let isInsufficientCreditsError = false;
      let detailMessage = `HTTP error ${response.status}: ${response.statusText}`; // Default detail

      try {
        const errorData = JSON.parse(errorText);
        if (errorData && typeof errorData.detail === 'string') {
          detailMessage = errorData.detail;
          if (errorData.detail.toLowerCase().includes('insufficient credits')) {
            isInsufficientCreditsError = true;
          }
        }
      } catch (parseError) {
        // JSON parsing failed, check raw errorText
        if (typeof errorText === 'string' && errorText.toLowerCase().includes('insufficient credits')) {
          isInsufficientCreditsError = true;
        }
        // Use raw errorText for detail if parsing failed and it's not a credits error
        if (!isInsufficientCreditsError && typeof errorText === 'string') {
          detailMessage = errorText.substring(0, 200); // Limit length
        }
      }

      if (isInsufficientCreditsError) {
        throw new Error('Insufficient credits');
      } else {
        throw new Error(`Error extracting text from PDF: ${detailMessage}`);
      }
    }

    return await response.json();
  } catch (error) {
    // Log the error before re-throwing if it's not the one we specifically created for insufficient credits
    if (!(error instanceof Error && error.message === 'Insufficient credits')) {
        console.error("Error extracting text from PDF:", error);
    }
    throw error; // Re-throw the caught error (could be 'Insufficient credits' or another error)
  }
}

export async function processPaperWithLLM(paperData: PaperData): Promise<ProcessedPaper> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error("Authentication token not found. Please log in.");
    }

    const response = await fetch(`${BASE_URL}/api/process-paper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(paperData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let isInsufficientCreditsError = false;
      let detailMessage = `HTTP error ${response.status}: ${response.statusText}`; // Default detail

      try {
        const errorData = JSON.parse(errorText);
        if (errorData && typeof errorData.detail === 'string') {
          detailMessage = errorData.detail;
          if (errorData.detail.toLowerCase().includes('insufficient credits')) {
            isInsufficientCreditsError = true;
          }
        }
      } catch (parseError) {
        // JSON parsing failed, check raw errorText
        if (typeof errorText === 'string' && errorText.toLowerCase().includes('insufficient credits')) {
          isInsufficientCreditsError = true;
        }
        // Use raw errorText for detail if parsing failed and it's not a credits error
        if (!isInsufficientCreditsError && typeof errorText === 'string') {
            detailMessage = errorText.substring(0, 200); // Limit length
        }
      }

      if (isInsufficientCreditsError) {
        throw new Error('Insufficient credits');
      } else {
        // Evitamos la repetición de "Error processing paper with LLM:" en el mensaje
        if (detailMessage.startsWith("Error processing paper with LLM:")) {
          throw new Error(detailMessage);
        } else {
          throw new Error(`Error processing paper with LLM: ${detailMessage}`);
        }
      }
    }

    return await response.json();
  } catch (error) {
    // Evitamos devolver errores anidados como "Error: Error: Error:"
    if (error instanceof Error) {
      // Si el error ya viene del bloque anterior, lo pasamos directamente
      throw error;
    } else {
      // Log the error before re-throwing if it's not a known type
      console.error("Error processing paper with LLM:", error);
      throw new Error(`Error processing paper: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
