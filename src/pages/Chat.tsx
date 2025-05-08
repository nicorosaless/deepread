import React, { useEffect, useRef } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import Header from '@/components/Header';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatHistory from '@/components/chat/ChatHistory';
import ChatInput from '@/components/chat/ChatInput';
import PaperAnalysis from '@/components/chat/PaperAnalysis';
import { useChatSessions } from '@/components/chat/useChatSessions';
import { useAuth } from '@/context/AuthContext'; // Added import
import { Button } from '@/components/ui/button'; // Added import
import { Coins } from 'lucide-react'; // Added import

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
  const { user } = useAuth(); // Added useAuth hook
  
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
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar side="left" variant="inset">
          <ChatSidebar 
            chatSessions={chatSessions}
            currentSessionId={currentSessionId}
            handleSessionSelect={handleSessionSelect}
            handleNewChat={handleNewChat}
          />
        </Sidebar>
        
        <SidebarInset>
          <Header />
          
          <div className="container mx-auto flex flex-col h-[calc(100vh-64px)]">
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Added credit display button */}
              {user && (
                <div className="flex justify-end p-2">
                  <Button variant="outline" size="sm">
                    <Coins className="h-4 w-4 mr-2" />
                    Credits: {user?.credits ?? 0}
                  </Button>
                </div>
              )}
              <ChatHistory 
                messages={currentSession.messages}
                isProcessing={isProcessing}
                processingStage={processingStage}
                handleFileSelected={handleFileSelected}
                messagesEndRef={messagesEndRef}
                showFileUploader={!fileUploadedForCurrentSession}
              />
              
              <ChatInput 
                isProcessing={isProcessing}
                handleFileSelected={handleFileSelected}
                showFileUploader={!fileUploadedForCurrentSession}
              />
            </div>
            
            <PaperAnalysis 
              paperData={currentPaperData}
              processedData={currentProcessedData}
              scrollToTop={scrollToTop}
            />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
