import React, { useEffect, useRef, useState } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatHistory from '@/components/chat/ChatHistory';
import PaperAnalysis from '@/components/chat/PaperAnalysis';
import { useChatSessions } from '@/components/chat/useChatSessions';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Coins } from 'lucide-react';
import ProcessedPapersDisplay from '@/components/chat/ProcessedPapersDisplay'; 
import ArxivSearch from '@/components/arxiv/ArxivSearch';
import { ArxivPaper } from '@/lib/types'; // Importar ArxivPaper
import LoadingState from '@/components/LoadingState'; // Import the LoadingState component

const Chat = () => {
  const [isArxivSearchActive, setIsArxivSearchActive] = useState(false);

  const {
    isProcessing,
    processingStage,
    chatSessions,
    currentSessionId,
    currentSession,
    currentPaperData,
    currentProcessedData,
    isLoadingSessions,
    isAutoProcessing, // Obtener el nuevo estado
    handleNewChat,
    handleSessionSelect,
    handleFileSelected,
    handleNewChatWithArxivPaper, // Obtener la nueva función
    deleteChatSession, // Add deleteChatSession to destructured props
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

  const showArxivSearch = () => {
    setIsArxivSearchActive(true);
  };

  const hideArxivSearchAndSelectSession = (sessionId: string) => {
    setIsArxivSearchActive(false);
    handleSessionSelect(sessionId);
  };

  const handleNewChatAndHideArxiv = () => {
    setIsArxivSearchActive(false);
    handleNewChat(); // Llama a handleNewChat sin argumentos para un chat normal
  }

  // Nueva función para manejar la selección de paper desde ArxivSearch
  const handlePaperSelectedFromArxiv = (paper: ArxivPaper) => {
    setIsArxivSearchActive(false); // Ocultar la vista de búsqueda de ArXiv
    handleNewChatWithArxivPaper(paper); // Llamar a la función del hook para crear y procesar
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar side="left" variant="inset" className="bg-sidebar-background text-sidebar-foreground">
          <ChatSidebar 
            chatSessions={chatSessions}
            currentSessionId={currentSessionId}
            handleSessionSelect={hideArxivSearchAndSelectSession} 
            handleNewChat={handleNewChatAndHideArxiv} 
            onShowArxivSearch={showArxivSearch} 
            handleDeleteSession={deleteChatSession} // Pass deleteChatSession to ChatSidebar
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
            {isArxivSearchActive ? (
              <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                  <h1 className="text-2xl font-semibold mb-6">Explorar ArXiv</h1>
                  <ArxivSearch onPaperSelectedForDeepRead={handlePaperSelectedFromArxiv} /> {/* Pasar la nueva prop */}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto flex flex-col p-4 md:p-6"> {/* Scrollable area for chat content */}
                {isLoadingSessions || isAutoProcessing ? ( // Mostrar loading si carga sesiones o auto-procesa
                  <div className="flex items-center justify-center h-full">
                    <LoadingState 
                      message={
                        isAutoProcessing 
                          ? processingStage || 'Processing ArXiv paper...'
                          : 'Loading chats...'
                      }
                    />
                  </div>
                ) : (
                  <ChatHistory 
                    messages={currentSession.messages}
                    isProcessing={isProcessing} // isProcessing normal para subida de archivos
                    processingStage={processingStage}
                    messagesEndRef={messagesEndRef}
                    handleFileSelected={handleFileSelected}
                  />
                )}
                
                {/* PaperAnalysis and ProcessedPapersDisplay MOVED INSIDE the scrollable area */}
                {!isAutoProcessing && (currentPaperData || currentProcessedData) && (
                  <div className="mt-4"> {/* Added margin-top for spacing */}
                    <PaperAnalysis 
                      paperData={currentPaperData}
                      processedData={currentProcessedData}
                      scrollToTop={scrollToTop} // Consider if scrollToTop is still needed here or if scroll focuses on new content
                    />
                  </div>
                )}
                {!isAutoProcessing && (
                  <div className="mt-4"> {/* Added margin-top for spacing */}
                    <ProcessedPapersDisplay />
                  </div>
                )}
              </div>
            )}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
