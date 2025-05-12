import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { ChatSession } from '@/lib/types';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, Plus, Search, FileSearch, Trash2 } from 'lucide-react'; // Import FileSearch and Trash2 icons

interface ChatSidebarProps {
  chatSessions: ChatSession[];
  currentSessionId: string;
  handleSessionSelect: (sessionId: string) => void;
  handleNewChat: () => void;
  onShowArxivSearch: () => void;
  handleDeleteSession: (sessionId: string) => void; // New prop for deleting a session
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  chatSessions,
  currentSessionId,
  handleSessionSelect,
  handleNewChat,
  onShowArxivSearch,
  handleDeleteSession, // Use the new prop
}) => {
  const { user, logout } = useAuth();

  const handleSignOut = async () => {
    try {
      await logout();
      // El redireccionamiento debería manejarse en el AuthContext después del logout
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-sidebar-foreground">DeepRead</h2> 
          <Button 
            variant="ghost" 
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleNewChat}
            title="New Chat"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        {/* Sección para el botón de ArXiv Search */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Search for papers" // Changed tooltip
                  onClick={onShowArxivSearch}
                  className={`
                    w-full justify-start text-sm
                    hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
                  `}
                >
                  <FileSearch className="mr-2 h-4 w-4" /> {/* Changed icon */}
                  Search for papers {/* Changed text */}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarSeparator />

        {/* Sección del historial de chats */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {chatSessions.map((session) => (
                <SidebarMenuItem key={session.id}>
                  <div className="flex items-center w-full">
                    <SidebarMenuButton
                      tooltip={session.title}
                      isActive={currentSessionId === session.id}
                      onClick={() => handleSessionSelect(session.id)}
                      className={`
                        flex-grow justify-start text-sm truncate
                        ${currentSessionId === session.id
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}
                      `}
                    >
                      <span className="truncate">{session.title}</span>
                    </SidebarMenuButton>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 text-sidebar-foreground/70 hover:text-red-500 hover:bg-sidebar-accent flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent session selection
                        handleDeleteSession(session.id);
                      }}
                      title="Delete chat"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </SidebarMenuItem>
              ))}
              {chatSessions.length === 0 && (
                <p className="p-4 text-sm text-sidebar-foreground/70 text-center">
                  Start a new chat or explore ArXiv.
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarSeparator />
        
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <div className="flex flex-col space-y-3">
          <div className="text-xs text-sidebar-foreground/70">
            <span>{user?.name || 'Guest User'}</span>
          </div>
          <Button 
            variant="outline"
            size="sm"
            className="w-full flex items-center justify-center gap-2 text-sidebar-foreground bg-sidebar-accent hover:bg-sidebar-accent/80 border-sidebar-border"
            onClick={handleSignOut}
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </>
  );
};

export default ChatSidebar;
