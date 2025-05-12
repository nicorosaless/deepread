export interface PaperData {
  title: string;
  content: string;
}

export interface ProcessedPaper {
  summary: string;
  keyPoints: string[];
  projectSuggestions: ProjectSuggestion[];
}

export interface CodeFile {
  filename: string;
  code: string;
}

export interface ProjectSuggestion {
  title: string;
  description: string;
  codeImplementation: CodeFile[]; // Changed from string to CodeFile[]
  language: string;
}

// Authentication types
export interface UserData {
  id: string;
  email: string;
  name: string;
  credits: number; // Added credits field
}

export interface User {
  id: string;
  name: string;
  email: string;
  credits: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
  processed_paper_messages?: ChatMessage[]; // Optional: messages from paper processing
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  processedPaperMessages: ChatMessage[]; // Ensure this is always present
}

// Chat types
export interface ChatMessage {
  id: string;
  content: any; // Can be string (summary) or object (code suggestion)
  role: "user" | "assistant";
  paperData?: PaperData | null;
  processedData?: ProcessedPaper | null;
  timestamp: Date;
  content_type?: 'summary' | 'code_suggestion' | 'user_message' | string; // Added to distinguish message types
}

export interface ChatSession {
  id: string;
  title: string;
  lastUpdated: Date;
  messages: ChatMessage[];
}

export interface AuthContextType extends AuthState {
  login: (token: string) => Promise<void>; // Changed to accept only token
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  updateUserCredits: (newCredits: number) => void;
  refreshUserProfile: () => Promise<void>;
  setProcessedPaperMessages: (messages: ChatMessage[]) => void; // Function to update messages
  processedPaperMessages: ChatMessage[]; // Add processedPaperMessages to the context type
}

// ArXiv Paper types
export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: Date;
  updated: Date;
  categories: string[];
  doi?: string;
  journalReference?: string;
  pdfUrl: string;
  htmlUrl: string;
}

export interface ArxivSearchParams {
  query: string;
  sortBy: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  sortOrder: 'ascending' | 'descending';
  maxResults: number;
  start: number;
  categories?: string[];
  timeframe?: 'all' | 'last_week' | 'last_month' | 'last_year';
}
