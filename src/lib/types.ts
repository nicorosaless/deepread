export interface PaperData {
  title: string;
  content: string;
  authors?: string[];
  abstract?: string;
  date?: string;
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

export interface AuthState {
  isAuthenticated: boolean;
  user: UserData | null;
  token: string | null;
  loading: boolean;
}

// Chat types
export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  paperData?: PaperData | null;
  processedData?: ProcessedPaper | null;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  lastUpdated: Date;
  messages: ChatMessage[];
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: UserData | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
  updateUserCredits: (newCredits: number) => void; // Added updateUserCredits
  refreshUserProfile?: () => Promise<void>; // Added refreshUserProfile
}
