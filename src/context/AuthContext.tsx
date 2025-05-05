
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserProfile } from '@/lib/api';
import { UserData, AuthState } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType extends AuthState {
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true,
  });

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('auth_token');
      
      if (token) {
        try {
          const user = await getUserProfile(token);
          setAuthState({
            isAuthenticated: true,
            user,
            token,
            loading: false,
          });
        } catch (error) {
          console.error('Failed to restore authentication:', error);
          localStorage.removeItem('auth_token');
          setAuthState({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false,
          });
        }
      } else {
        setAuthState(prevState => ({ ...prevState, loading: false }));
      }
    };

    initializeAuth();
  }, []);

  const login = async (token: string) => {
    localStorage.setItem('auth_token', token);
    
    try {
      const user = await getUserProfile(token);
      setAuthState({
        isAuthenticated: true,
        user,
        token,
        loading: false,
      });
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name}!`,
      });
    } catch (error) {
      console.error('Failed to get user profile:', error);
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

  return (
    <AuthContext.Provider 
      value={{ 
        ...authState, 
        login, 
        logout 
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
