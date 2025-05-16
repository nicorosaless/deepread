// Configuration settings for the DeepRead application

// API settings
export const apiConfig = {
  // Base API URL with dynamic port detection
  baseUrl: import.meta.env.VITE_API_URL || 
    (typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.hostname}:8080` 
      : 'http://localhost:8080'),
      
  // Authentication endpoints
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    user: '/api/auth/user',
  },
  
  // Paper processing endpoints
  papers: {
    upload: '/api/papers/upload',
    process: '/api/papers/process',
    list: '/api/papers/list',
    get: '/api/papers/get', 
  },
  
  // Chat endpoints
  chat: {
    send: '/api/chat/send',
    sessions: '/api/chat/sessions',
    history: '/api/chat/history',
  }
};

// Feature flags
export const features = {
  arxivSearch: true,
  fileUpload: true,
};
