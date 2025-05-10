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
import ProcessedPapersDisplay from '@/components/chat/ProcessedPapersDisplay'; // Import the new component

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
    isLoadingSessions,
    handleNewChat,
    handleSessionSelect,
    handleFileSelected,
    handleAddMessage
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

  const handleSendMessage = async (message: string) => {
    // Primero agregamos el mensaje del usuario
    await handleAddMessage(message, 'user');
    
    // Aquí podríamos implementar una respuesta de la IA, pero por ahora solo mostraremos el mensaje del usuario
    // Si quisiéramos una respuesta automática, podríamos hacer algo como:
    // await handleAddMessage(`Respuesta a: ${message}`, 'assistant');
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
              {isLoadingSessions ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Cargando conversaciones...</p>
                </div>
              ) : (
                <ChatHistory 
                  messages={currentSession.messages}
                  isProcessing={isProcessing}
                  processingStage={processingStage}
                  messagesEndRef={messagesEndRef}
                  handleFileSelected={handleFileSelected}
                />
              )}
            </div>
            
            <ChatInput 
              isProcessing={isProcessing}
              onSendMessage={handleSendMessage}
            />
          </div>
          
          {(currentPaperData || currentProcessedData) && (
             <PaperAnalysis 
                paperData={currentPaperData}
                processedData={currentProcessedData}
                scrollToTop={scrollToTop}
              />
          )}

          {/* Display Past Paper Analyses First */}
          <ProcessedPapersDisplay />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
