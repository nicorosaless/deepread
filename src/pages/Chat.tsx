import React, { useEffect, useRef } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatHistory from '@/components/chat/ChatHistory';
import ChatInput from '@/components/chat/ChatInput';
import PaperAnalysis from '@/components/chat/PaperAnalysis';
import { useChatSessions } from '@/components/chat/useChatSessions';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Coins } from 'lucide-react';

const Chat = () => {
  const {
    isProcessing,
    processingStage,
    chatSessions,
    currentSessionId,
    currentSession,
    currentPaperData,
    currentProcessedData,
    fileUploadedForCurrentSession,
    handleNewChat,
    handleSessionSelect,
    handleFileSelected
  } = useChatSessions();
  const { user } = useAuth();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession.messages]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar side="left" variant="inset" className="bg-sidebar-background text-sidebar-foreground">
          <ChatSidebar 
            chatSessions={chatSessions}
            currentSessionId={currentSessionId}
            handleSessionSelect={handleSessionSelect}
            handleNewChat={handleNewChat}
          />
        </Sidebar>
        
        <SidebarInset className="bg-background flex flex-col h-screen">
          {user && (
            <div className="flex justify-end p-3 border-b border-border">
              <Button variant="outline" size="sm" className="text-foreground border-border hover:bg-accent">
                <Coins className="h-4 w-4 mr-2" />
                Credits: {user?.credits ?? 0}
              </Button>
            </div>
          )}

          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto flex flex-col">
              <ChatHistory 
                messages={currentSession.messages}
                isProcessing={isProcessing}
                processingStage={processingStage}
                messagesEndRef={messagesEndRef}
                handleFileSelected={handleFileSelected}
              />
            </div>
            
            <ChatInput 
              isProcessing={isProcessing}
            />
          </div>
          
          {(currentPaperData || currentProcessedData) && (
             <PaperAnalysis 
                paperData={currentPaperData}
                processedData={currentProcessedData}
                scrollToTop={scrollToTop}
              />
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
