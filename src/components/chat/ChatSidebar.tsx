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
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ChatSidebarProps {
  chatSessions: ChatSession[];
  currentSessionId: string;
  handleSessionSelect: (sessionId: string) => void;
  handleNewChat: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  chatSessions,
  currentSessionId,
  handleSessionSelect,
  handleNewChat
}) => {
  const { user } = useAuth();

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-sidebar-foreground">Deepread</h2> 
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {chatSessions.map((session) => (
                <SidebarMenuItem key={session.id}>
                  <SidebarMenuButton 
                    tooltip={session.title}
                    isActive={currentSessionId === session.id}
                    onClick={() => handleSessionSelect(session.id)}
                    className={`
                      w-full justify-start text-sm 
                      ${currentSessionId === session.id 
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                        : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}
                    `}
                  >
                    <span className="truncate">{session.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {chatSessions.length === 0 && (
                <p className="p-4 text-sm text-sidebar-foreground/70 text-center">
                  No chat history yet. Start a new chat to see it here.
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <div className="flex flex-col space-y-1 text-xs text-sidebar-foreground/70">
          <span>{user?.name || 'Guest User'}</span>
        </div>
      </SidebarFooter>
    </>
  );
};

export default ChatSidebar;
