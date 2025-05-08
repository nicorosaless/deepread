
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
      <SidebarHeader className="border-b border-sidebar-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-sidebar-foreground">Chat History</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleNewChat}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Chat
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {chatSessions.map((session) => (
                <SidebarMenuItem key={session.id}>
                  <SidebarMenuButton 
                    tooltip={session.title}
                    isActive={currentSessionId === session.id}
                    onClick={() => handleSessionSelect(session.id)}
                  >
                    <span>{session.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 px-4 py-3">
        <div className="flex items-center text-xs text-sidebar-foreground/70">
          <span>Logged in as {user?.name}</span>
        </div>
      </SidebarFooter>
    </>
  );
};

export default ChatSidebar;
