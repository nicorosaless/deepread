import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { SearchCheck } from 'lucide-react';

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  return (
    <header className="bg-background border-b py-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <Link to="/" className="text-xl font-bold text-paper">DeepRead</Link>
          <span className="text-sm text-muted-foreground">.ai</span>
        </div>

        <nav>
          <ul className="flex items-center space-x-6">
            {isAuthenticated && (
              <li>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/arxiv-search" className="flex items-center">
                    <SearchCheck className="mr-2 h-4 w-4" />
                    Explorar ArXiv
                  </Link>
                </Button>
              </li>
            )}
          </ul>
        </nav>

        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-muted-foreground">{user?.name}</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => logout()}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="outline" size="sm">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
