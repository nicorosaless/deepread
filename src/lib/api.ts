
import { PaperData, ProcessedPaper, UserData } from "./types";
import BASE_URL from "./utils";

// Authentication API
export async function registerUser(name: string, email: string, password: string): Promise<{ token: string }> {
  const response = await fetch(`${BASE_URL}/api/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Registration failed');
  }

  return await response.json();
}

export async function loginUser(email: string, password: string): Promise<{ token: string }> {
  const response = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Login failed');
  }

  const data = await response.json();
  return { token: data.access_token };
}

export async function getUserProfile(token: string): Promise<UserData> {
  const response = await fetch(`${BASE_URL}/api/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to fetch user profile');
  }

  return await response.json();
}

// PDF Processing API
export async function extractTextFromPDF(file: File): Promise<PaperData> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${BASE_URL}/api/extract-pdf`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Error extracting text from PDF');
  }
  
  return await response.json();
}

export async function processPaperWithLLM(paperData: PaperData): Promise<ProcessedPaper> {
  const response = await fetch(`${BASE_URL}/api/process-paper`, {
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
}
