
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { ChatMessage, ChatSession, PaperData, ProcessedPaper } from '@/lib/types';
import FileUploader from '@/components/FileUploader';
import { extractTextFromPDF, processPaperWithLLM } from '@/lib/pdfExtractor';
import LoadingState from '@/components/LoadingState';
import PaperSummary from '@/components/PaperSummary';
import ProjectSuggestions from '@/components/ProjectSuggestions';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

const Chat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([
    {
      id: 'default',
      title: 'New Chat',
      lastUpdated: new Date(),
      messages: []
    }
  ]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  const [currentPaperData, setCurrentPaperData] = useState<PaperData | null>(null);
  const [currentProcessedData, setCurrentProcessedData] = useState<ProcessedPaper | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get current chat session
  const currentSession = chatSessions.find(session => session.id === currentSessionId) || chatSessions[0];
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession.messages]);

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      lastUpdated: new Date(),
      messages: []
    };

    setChatSessions([...chatSessions, newSession]);
    setCurrentSessionId(newSession.id);
    setCurrentPaperData(null);
    setCurrentProcessedData(null);
  };

  const handleSessionSelect = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    
    // Find the session data
    const session = chatSessions.find(s => s.id === sessionId);
    
    // Set the current paper data based on the last user message with paper data
    const lastUserMessageWithPaper = session?.messages
      .filter(m => m.role === 'user' && m.paperData)
      .pop();
      
    setCurrentPaperData(lastUserMessageWithPaper?.paperData || null);
    setCurrentProcessedData(lastUserMessageWithPaper?.processedData || null);
  };

  const handleFileSelected = async (file: File) => {
    try {
      setIsProcessing(true);
      setProcessingStage('Extracting text from PDF...');
      setSelectedFile(file);
      
      // Extract text from PDF
      const extractedPaperData = await extractTextFromPDF(file);
      setCurrentPaperData(extractedPaperData);
      
      // Process with LLM
      setProcessingStage('Analyzing with AI...');
      const processedPaper = await processPaperWithLLM(extractedPaperData);
      setCurrentProcessedData(processedPaper);
      
      // Add a user message with the uploaded paper
      const newUserMessage: ChatMessage = {
        id: uuidv4(),
        content: `Uploaded paper: ${extractedPaperData.title}`,
        role: 'user',
        paperData: extractedPaperData,
        processedData: processedPaper,
        timestamp: new Date()
      };

      // Add an assistant response
      const newAssistantMessage: ChatMessage = {
        id: uuidv4(),
        content: `I've analyzed the paper "${extractedPaperData.title}". Here's what I found:`,
        role: 'assistant',
        timestamp: new Date()
      };

      // Update the current session
      const updatedSessions = chatSessions.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            title: extractedPaperData.title.length > 30 
              ? `${extractedPaperData.title.substring(0, 30)}...` 
              : extractedPaperData.title,
            lastUpdated: new Date(),
            messages: [...session.messages, newUserMessage, newAssistantMessage]
          };
        }
        return session;
      });

      setChatSessions(updatedSessions);
      setIsProcessing(false);
      
      // Clear the selected file
      setSelectedFile(null);
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        variant: 'destructive',
        title: 'Error processing file',
        description: 'There was a problem analyzing your paper. Please try again.'
      });
      setIsProcessing(false);
      setSelectedFile(null);
    }
  };

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
          <SidebarHeader className="border-b border-sidebar-border/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-sidebar-foreground">Chat History</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={handleNewChat}
              >
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
        </Sidebar>
        
        <SidebarInset>
          <Header />
          
          <div className="container mx-auto flex flex-col h-[calc(100vh-64px)]">
            <div className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 px-4">
                {currentSession.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <h2 className="text-2xl font-semibold mb-2">Welcome to DeepRead</h2>
                    <p className="text-muted-foreground mb-8 max-w-md">
                      Upload a PDF of an arXiv paper to get started. I'll analyze it and provide a summary and implementation suggestions.
                    </p>
                    <FileUploader 
                      onFileSelected={handleFileSelected} 
                      isProcessing={isProcessing} 
                    />
                  </div>
                ) : (
                  <div className="py-8 space-y-6">
                    {currentSession.messages.map((message) => (
                      <div 
                        key={message.id} 
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-[80%] rounded-lg p-4 ${
                            message.role === 'user' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          <p className="mb-1">{message.content}</p>
                          {message.paperData && message.processedData && (
                            <div className="pt-2">
                              <div className="text-sm opacity-75">
                                {message.role === 'user' && "Uploaded paper"}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
              
              {isProcessing && (
                <div className="px-4 py-6 border-t">
                  <LoadingState message={processingStage} />
                </div>
              )}
              
              <div className="p-4 border-t">
                <div className="flex items-center space-x-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        document.getElementById('file-input')?.click();
                      }}
                      disabled={isProcessing}
                    >
                      <input
                        id="file-input"
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFileSelected(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <span className="sr-only">Upload paper</span>
                      <Upload className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-medium"
                      disabled={isProcessing}
                    >
                      1000
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {currentPaperData && currentProcessedData && !isProcessing && (
              <div className="border-t py-6">
                <div className="container max-w-4xl mx-auto space-y-10">
                  <section>
                    <h2 className="text-2xl font-semibold mb-6">Summary & Analysis</h2>
                    <PaperSummary
                      title={currentPaperData.title || "Untitled Paper"}
                      summary={currentProcessedData.summary}
                      keyPoints={currentProcessedData.keyPoints}
                      authors={currentPaperData.authors}
                      date={currentPaperData.date}
                    />
                  </section>

                  <Separator className="my-8" />
                  
                  <section>
                    <h2 className="text-2xl font-semibold mb-6">
                      Suggested Implementation Projects
                    </h2>
                    <ProjectSuggestions projects={currentProcessedData.projectSuggestions} />
                  </section>
                  
                  <div className="fixed bottom-6 right-6">
                    <Button
                      onClick={scrollToTop}
                      size="icon"
                      className="rounded-full shadow-lg"
                    >
                      <ArrowUp className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
