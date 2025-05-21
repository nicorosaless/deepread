
import React, { useEffect, useRef, useState } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatHistory from '@/components/chat/ChatHistory';
import PaperAnalysis from '@/components/chat/PaperAnalysis';
import { useChatSessions } from '@/components/chat/useChatSessions';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Coins, MessageSquare } from 'lucide-react';
import ProcessedPapersDisplay from '@/components/chat/ProcessedPapersDisplay'; 
import ArxivSearch from '@/components/arxiv/ArxivSearch';
import { ArxivPaper } from '@/lib/types';
import LoadingState from '@/components/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const Chat = () => {
  const [isArxivSearchActive, setIsArxivSearchActive] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("content");
  const [chatMessage, setChatMessage] = useState<string>("");

  const {
    isProcessing,
    processingStage,
    chatSessions,
    currentSessionId,
    currentSession,
    currentPaperData,
    currentProcessedData,
    isLoadingSessions,
    isAutoProcessing,
    handleNewChat,
    handleSessionSelect,
    handleFileSelected,
    handleNewChatWithArxivPaper,
    deleteChatSession,
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
    handleNewChat();
  }

  const handlePaperSelectedFromArxiv = (paper: ArxivPaper) => {
    setIsArxivSearchActive(false);
    handleNewChatWithArxivPaper(paper);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      // Aquí implementarías la lógica para enviar el mensaje al chatbot
      console.log("Mensaje enviado:", chatMessage);
      setChatMessage("");
    }
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
            handleDeleteSession={deleteChatSession}
          />
        </Sidebar>
        
        <SidebarInset className="bg-background flex flex-col h-screen">
          {user && (
            <div className="flex justify-end p-3 border-b border-border">
              <Button variant="outline" size="sm" className="text-foreground border-border hover:bg-accent">
                <Coins className="h-4 w-4 mr-2" />
                Créditos: {user?.credits ?? 0}
              </Button>
            </div>
          )}

          <div className="flex flex-col flex-1 overflow-hidden">
            {isArxivSearchActive ? (
              <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                  <h1 className="text-2xl font-semibold mb-6">Explorar ArXiv</h1>
                  <ArxivSearch onPaperSelectedForDeepRead={handlePaperSelectedFromArxiv} />
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto flex flex-col p-4 md:p-6">
                {isLoadingSessions || isAutoProcessing ? (
                  <div className="flex items-center justify-center h-full">
                    <LoadingState 
                      message={
                        isAutoProcessing 
                          ? processingStage || 'Procesando paper de ArXiv...'
                          : 'Cargando chats...'
                      }
                    />
                  </div>
                ) : (
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                      <TabsTrigger value="content">Contenido</TabsTrigger>
                      {currentPaperData && <TabsTrigger value="chat">Chat</TabsTrigger>}
                      <TabsTrigger value="history">Historial</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="content" className="flex-1">
                      <ChatHistory 
                        messages={currentSession.messages}
                        isProcessing={isProcessing}
                        processingStage={processingStage}
                        messagesEndRef={messagesEndRef}
                        handleFileSelected={handleFileSelected}
                        onShowArxivSearch={showArxivSearch}
                      />
                      
                      {!isAutoProcessing && (currentPaperData || currentProcessedData) && (
                        <div className="mt-4">
                          <PaperAnalysis 
                            paperData={currentPaperData}
                            processedData={currentProcessedData}
                            scrollToTop={scrollToTop}
                          />
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="chat" className="flex-1 flex flex-col h-full">
                      {currentPaperData && (
                        <>
                          <div className="flex-1 overflow-y-auto mb-4 border rounded-lg p-4">
                            <h3 className="font-medium mb-2">Preguntas sobre {currentPaperData.title}</h3>
                            <p className="text-muted-foreground text-sm mb-4">
                              Haz preguntas específicas sobre este paper o solicita aclaraciones sobre la implementación del código.
                            </p>
                            
                            <div className="space-y-4 py-4">
                              {/* Aquí se mostrarían los mensajes del chat */}
                              <div className="bg-muted p-3 rounded-lg">
                                <p className="text-sm italic text-muted-foreground">
                                  No hay mensajes aún. Comienza la conversación haciendo una pregunta.
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <form onSubmit={handleChatSubmit} className="flex gap-2">
                            <Textarea 
                              value={chatMessage}
                              onChange={(e) => setChatMessage(e.target.value)}
                              placeholder="Escribe tu pregunta sobre el paper..."
                              className="flex-1"
                            />
                            <Button type="submit">
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Enviar
                            </Button>
                          </form>
                        </>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="history">
                      <ProcessedPapersDisplay />
                    </TabsContent>
                  </Tabs>
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
