import { PaperData, ProcessedPaper, UserData, ChatSession } from "./types";
import BASE_URL from "./utils";

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

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
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.detail || 'Registration failed');
    } catch (parseError) {
      // Si la respuesta no es JSON válido, usa el texto completo
      throw new Error(`Registration failed: ${errorText}`);
    }
  }

  const data = await response.json();
  return { token: data.access_token }; // Asegúrate de convertir access_token a token
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
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.detail || 'Login failed');
    } catch (parseError) {
      // Si la respuesta no es JSON válido, usa el texto completo
      throw new Error(`Login failed: ${errorText}`);
    }
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
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.detail || 'Failed to fetch user profile');
    } catch (parseError) {
      // Si la respuesta no es JSON válido, usa el texto completo
      throw new Error(`Failed to fetch user profile: ${errorText}`);
    }
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
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.detail && errorData.detail.startsWith('Insufficient credits')) {
        throw new Error('Insufficient credits');
      }
      throw new Error(errorData.detail || 'Error extracting text from PDF');
    } catch (parseError) {
      if (errorText.includes('Insufficient credits')) {
        throw new Error('Insufficient credits');
      }
      throw new Error(`Error extracting text from PDF: ${errorText}`);
    }
  }
  
  return await response.json();
}

export async function processPaperWithLLM(paperData: PaperData): Promise<ProcessedPaper> {
  const response = await fetch(`${BASE_URL}/api/process-paper`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
    },
    body: JSON.stringify(paperData),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.detail && errorData.detail.startsWith('Insufficient credits')) {
        throw new Error('Insufficient credits');
      }
      throw new Error(errorData.detail || 'Error processing paper with LLM');
    } catch (parseError) {
      if (errorText.includes('Insufficient credits')) {
        throw new Error('Insufficient credits');
      }
      throw new Error(`Error processing paper with LLM: ${errorText}`);
    }
  }
  
  return await response.json();
}

// Chat API
export async function saveUserChatSession(session: ChatSession): Promise<ChatSession> {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${BASE_URL}/api/chat/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ session }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.detail || 'Failed to save chat session');
    } catch (parseError) {
      throw new Error(`Failed to save chat session: ${errorText}`);
    }
  }

  return await response.json();
}

export async function getUserChatSessions(): Promise<ChatSession[]> {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  console.log('Fetching chat sessions from API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/chat/sessions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || 'Failed to fetch chat sessions');
      } catch (parseError) {
        throw new Error(`Failed to fetch chat sessions: ${errorText}`);
      }
    }

    const data = await response.json();
    console.log('Received sessions data:', data);
    return data.sessions || [];
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    throw error;
  }
}

export async function getUserChatSession(sessionId: string): Promise<ChatSession> {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${BASE_URL}/api/chat/sessions/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.detail || 'Failed to fetch chat session');
    } catch (parseError) {
      throw new Error(`Failed to fetch chat session: ${errorText}`);
    }
  }

  return await response.json();
}

export async function getChatSessions(): Promise<ChatSession[]> {
  const response = await fetch(`${API_URL}/chat_sessions`);
  if (!response.ok) {
    throw new Error('Failed to fetch chat sessions');
  }
  return response.json();
}

export async function createChatSession(sessionName: string): Promise<ChatSession> {
  const response = await fetch(`${API_URL}/chat_sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_name: sessionName }),
  });
  if (!response.ok) {
    throw new Error('Failed to create chat session');
  }
  return response.json();
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${API_URL}/chat_sessions/${sessionId}/messages`);
  if (!response.ok) {
    throw new Error('Failed to fetch chat messages');
  }
  return response.json();
}

export async function postChatMessage(sessionId: string, message: { role: 'user' | 'assistant', content: string }): Promise<ChatMessage> {
  const response = await fetch(`${API_URL}/chat_sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error('Failed to post chat message');
  }
  return response.json();
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Authentication required to delete session');
  }

  const response = await fetch(`${BASE_URL}/api/chat/sessions/${sessionId}`, { // Use BASE_URL and consistent path
    method: 'DELETE',
    headers: { // Add Authorization header
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Failed to delete chat session';
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch (e) {
      // If parsing failed, use the raw text if it's not too long or generic and provides more info
      if (errorText && response.status !== 500) { // Avoid generic server error HTML pages for the message
          errorMessage = errorText.length < 250 ? errorText : `Failed to delete chat session (status: ${response.status})`;
      } else {
          errorMessage = `Failed to delete chat session (status: ${response.status})`;
      }
    }
    throw new Error(errorMessage);
  }
  // DELETE requests might not return a body, so we don't try to parse JSON if the response is ok.
}
