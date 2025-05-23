import React, { useEffect, useRef, useState } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatHistory from '@/components/chat/ChatHistory';
import PaperAnalysis from '@/components/chat/PaperAnalysis';
import { useChatSessions } from '@/components/chat/useChatSessions';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Coins, MessageSquare, Send } from 'lucide-react';
import ProcessedPapersDisplay from '@/components/chat/ProcessedPapersDisplay'; 
import ArxivSearch from '@/components/arxiv/ArxivSearch';
import { ArxivPaper } from '@/lib/types';
import LoadingState from '@/components/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import CodeImplementation from '@/components/CodeImplementation';
import { sendChatbotMessage } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const Chat = () => {
  const [isArxivSearchActive, setIsArxivSearchActive] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("summary"); // Default to 'summary'
  const [chatMessage, setChatMessage] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string, timestamp: Date}>>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const { toast } = useToast();

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
  const { user, refreshUserProfile } = useAuth();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollChatToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession.messages]);

  useEffect(() => {
    scrollChatToBottom();
  }, [chatMessages, isSendingMessage]);

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

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim() && currentPaperData && currentProcessedData && !isSendingMessage) {
      setIsSendingMessage(true);
      
      try {
        // Add user message to chat
        const userMessage = {
          id: Date.now().toString(),
          role: 'user' as const,
          content: chatMessage.trim(),
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, userMessage]);
        
        const messageToSend = chatMessage.trim();
        setChatMessage("");
        
        // Send message to chatbot API
        const response = await sendChatbotMessage(
          currentSessionId,
          messageToSend,
          currentPaperData.title,
          currentProcessedData.summary,
          currentProcessedData.projectSuggestions || []
        );
        
        // Add bot response to chat
        const botMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: response.response,
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, botMessage]);
        
        // Refresh user profile to update credits
        if (refreshUserProfile) {
          refreshUserProfile();
        }
        
        toast({
          title: "Mensaje enviado",
          description: `Créditos restantes: ${response.credits_remaining}`,
        });
        
      } catch (error: any) {
        console.error("Error sending message:", error);
        
        if (error.message === 'Insufficient credits') {
          toast({
            variant: "destructive",
            title: "Créditos insuficientes",
            description: "No tienes suficientes créditos para enviar este mensaje.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Error al enviar el mensaje. Inténtalo de nuevo.",
          });
        }
      } finally {
        setIsSendingMessage(false);
      }
    }
  };

  // Reset chat messages when switching sessions or papers
  useEffect(() => {
    setChatMessages([]);
  }, [currentSessionId, currentPaperData]);

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
                  <>
                    {currentPaperData && currentProcessedData ? (
                      <Tabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                          <TabsTrigger value="summary">Resumen</TabsTrigger>
                          <TabsTrigger value="implementation">Implementación</TabsTrigger>
                          <TabsTrigger value="chatbot">Chatbot</TabsTrigger>
                        </TabsList>

                        <TabsContent value="summary" className="flex-1">
                          <PaperAnalysis 
                            paperData={currentPaperData}
                            processedData={currentProcessedData}
                            scrollToTop={scrollToTop}
                          />
                        </TabsContent>

                        <TabsContent value="implementation" className="flex-1">
                          <CodeImplementation
                            codeFiles={currentProcessedData?.projectSuggestions?.[0]?.codeImplementation || []} // Updated to pass an array
                            language={currentProcessedData?.projectSuggestions?.[0]?.language}
                          />
                        </TabsContent>

                        <TabsContent value="chatbot" className="flex-1 flex flex-col h-full">
                          {currentPaperData && (
                            <>
                              <div className="flex-1 overflow-y-auto mb-4 border rounded-lg p-4">
                                <h3 className="font-medium mb-2">Preguntas sobre {currentPaperData.title}</h3>
                                <p className="text-muted-foreground text-sm mb-4">
                                  Haz preguntas específicas sobre este paper o solicita aclaraciones sobre la implementación del código.
                                </p>
                                <div className="space-y-4 py-4">
                                  {chatMessages.length === 0 ? (
                                    <div className="bg-muted p-3 rounded-lg">
                                      <p className="text-sm italic text-muted-foreground">
                                        No hay mensajes aún. Comienza la conversación haciendo una pregunta.
                                      </p>
                                    </div>
                                  ) : (
                                    chatMessages.map((message) => (
                                      <div
                                        key={message.id}
                                        className={`p-3 rounded-lg ${
                                          message.role === 'user'
                                            ? 'bg-primary text-primary-foreground ml-8'
                                            : 'bg-muted mr-8'
                                        }`}
                                      >
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-medium text-sm">
                                            {message.role === 'user' ? 'Tú' : 'Asistente'}
                                          </span>
                                          <span className="text-xs opacity-70">
                                            {message.timestamp.toLocaleTimeString()}
                                          </span>
                                        </div>
                                        <div className="text-sm whitespace-pre-wrap">
                                          {message.content}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                  {isSendingMessage && (
                                    <div className="bg-muted p-3 rounded-lg mr-8">
                                      <div className="flex items-center space-x-2">
                                        <div className="animate-pulse font-medium text-sm">Asistente está escribiendo</div>
                                        <div className="flex space-x-1">
                                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  <div ref={chatMessagesEndRef} />
                                </div>
                              </div>
                              <form onSubmit={handleChatSubmit} className="flex gap-2">
                                <Textarea 
                                  value={chatMessage}
                                  onChange={(e) => setChatMessage(e.target.value)}
                                  placeholder="Escribe tu pregunta sobre el paper..."
                                  className="flex-1"
                                  disabled={isSendingMessage}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleChatSubmit(e);
                                    }
                                  }}
                                />
                                <Button 
                                  type="submit" 
                                  disabled={!chatMessage.trim() || isSendingMessage}
                                >
                                  {isSendingMessage ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </Button>
                              </form>
                            </>
                          )}
                        </TabsContent>
                      </Tabs>
                    ) : (
                      <ChatHistory 
                        messages={currentSession.messages}
                        isProcessing={isProcessing}
                        processingStage={processingStage}
                        handleFileSelected={handleFileSelected}
                        messagesEndRef={messagesEndRef}
                        onShowArxivSearch={showArxivSearch}
                      />
                    )}
                  </>
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
