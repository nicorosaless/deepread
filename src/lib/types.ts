
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

export interface ProjectSuggestion {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  codeImplementation: string;
  language: string;
}

// Authentication types
export interface UserData {
  id: string;
  email: string;
  name: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserData | null;
  token: string | null;
  loading: boolean;
}
