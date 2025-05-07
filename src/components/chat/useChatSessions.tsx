
import { useState } from 'react';
import { ChatSession, ChatMessage, PaperData, ProcessedPaper } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { extractTextFromPDF, processPaperWithLLM } from '@/lib/pdfExtractor';

export function useChatSessions() {
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

  // Get current chat session
  const currentSession = chatSessions.find(session => session.id === currentSessionId) || chatSessions[0];

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

  return {
    isProcessing,
    processingStage,
    selectedFile,
    chatSessions,
    currentSessionId,
    currentSession,
    currentPaperData,
    currentProcessedData,
    handleNewChat,
    handleSessionSelect,
    handleFileSelected
  };
}
