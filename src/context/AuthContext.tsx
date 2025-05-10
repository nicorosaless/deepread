import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { getUserProfile, loginUser, registerUser } from '@/lib/api';
import { UserData, AuthState, AuthContextType, ChatMessage } from '@/lib/types'; // Import ChatMessage
import { useToast } from '@/hooks/use-toast';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true,
    processedPaperMessages: [], // Added to store processed paper messages
  });
  const [error, setError] = useState<string | null>(null);
  
  // Referencia para rastrear la última vez que se actualizó el perfil
  const lastProfileUpdate = useRef<Date | null>(null);
  // Flag para evitar múltiples solicitudes de perfil simultáneas
  const isRefreshing = useRef(false);

  const fetchUserProfile = async (token: string) => {
    // Si ya hay una solicitud en curso, no hacer nada
    if (isRefreshing.current) {
      return authState.user;
    }
    
    isRefreshing.current = true;
    
    try {
      const user = await getUserProfile(token);
      setAuthState({
        isAuthenticated: true,
        user,
        token,
        loading: false,
        processedPaperMessages: authState.processedPaperMessages, // Preserve messages on profile fetch
      });
      lastProfileUpdate.current = new Date();
      isRefreshing.current = false;
      return user; // Return user data
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      localStorage.removeItem('auth_token');
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        processedPaperMessages: [], // Clear messages on error
      });
      toast({
        title: "Authentication error",
        description: "Failed to retrieve your profile. Please try logging in again.",
        variant: "destructive",
      });
      isRefreshing.current = false;
      throw error; // Re-throw error
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('auth_token');
      const processedMessagesString = localStorage.getItem('processedPaperMessages'); // Load messages from localStorage

      if (token) {
        const processedPaperMessages = processedMessagesString ? JSON.parse(processedMessagesString) : [];
        await fetchUserProfile(token).catch(() => {
          // Error handling is done within fetchUserProfile
        });
        setAuthState(prevState => ({ ...prevState, processedPaperMessages }));
      } else {
        setAuthState(prevState => ({ ...prevState, loading: false }));
      }
    };

    initializeAuth();
  }, []);

  const login = async (token: string) => {
    localStorage.setItem('auth_token', token);
    const user = await fetchUserProfile(token);
    if (user) {
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name}!`,
      });
    }
    const processedMessagesString = localStorage.getItem('processedPaperMessages');
    const processedPaperMessages = processedMessagesString ? JSON.parse(processedMessagesString) : [];
    setAuthState(prevState => ({ ...prevState, processedPaperMessages }));
  };

  const register = async (name: string, email: string, password: string): Promise<void> => {
    setAuthState(prevState => ({ ...prevState, loading: true }));
    setError(null);
    try {
      const { token } = await registerUser(name, email, password);
      localStorage.setItem('auth_token', token);
      await fetchUserProfile(token); // This will set the auth state
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      setAuthState(prevState => ({ ...prevState, loading: false }));
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('processedPaperMessages'); // Clear messages on logout
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      processedPaperMessages: [], // Clear messages on logout
    });
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };

  const updateUserCredits = (newCredits: number) => {
    if (authState.user) {
      setAuthState(prevState => ({
        ...prevState,
        user: { ...prevState.user!, credits: newCredits }
      }));
    }
  };

  // Function to explicitly refresh user profile, optimizado para limitar frecuencia
  const refreshUserProfile = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    
    // Si ya hay una solicitud en curso, no hacer nada
    if (isRefreshing.current) return;
    
    // Limitar actualizaciones a una vez cada 30 segundos como máximo
    const now = new Date();
    if (lastProfileUpdate.current && now.getTime() - lastProfileUpdate.current.getTime() < 30000) {
      return; // Si ha pasado menos de 30 segundos desde la última actualización, no hacer nada
    }
    
    try {
      await fetchUserProfile(token);
    } catch (error) {
      // Error is handled in fetchUserProfile
      console.error("Error refreshing user profile from refreshUserProfile", error);
    }
  }, []);

  // New function to allow updating messages, e.g., after a new paper processing
  const setProcessedPaperMessages = (messages: ChatMessage[]) => {
    localStorage.setItem('processedPaperMessages', JSON.stringify(messages));
    setAuthState(prevState => ({ ...prevState, processedPaperMessages: messages }));
  };

  return (
    <AuthContext.Provider 
      value={{
        ...authState, 
        login, 
        register,
        logout,
        error,
        updateUserCredits,
        refreshUserProfile,
        setProcessedPaperMessages, // Add to context
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
