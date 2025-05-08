import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserProfile, loginUser, registerUser } from '@/lib/api';
import { UserData, AuthState, AuthContextType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true,
  });
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = async (token: string) => {
    try {
      const user = await getUserProfile(token);
      setAuthState({
        isAuthenticated: true,
        user,
        token,
        loading: false,
      });
      return user; // Return user data
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      localStorage.removeItem('auth_token');
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
      });
      toast({
        title: "Authentication error",
        description: "Failed to retrieve your profile. Please try logging in again.",
        variant: "destructive",
      });
      throw error; // Re-throw error
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetchUserProfile(token).catch(() => {
          // Error handling is done within fetchUserProfile
        });
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
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
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

  // Function to explicitly refresh user profile
  const refreshUserProfile = async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        await fetchUserProfile(token);
      } catch (error) {
        // Error is handled in fetchUserProfile
        console.error("Error refreshing user profile from refreshUserProfile", error);
      }
    }
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
        refreshUserProfile // Expose refreshUserProfile
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
