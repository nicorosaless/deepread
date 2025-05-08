import { useState, useEffect } from 'react'; // Added useEffect
import { ChatSession, ChatMessage, PaperData, ProcessedPaper } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { extractTextFromPDF, processPaperWithLLM } from '@/lib/pdfExtractor';
import { useAuth } from '@/context/AuthContext'; // Import useAuth

export function useChatSessions() {
  const { toast } = useToast();
  const { refreshUserProfile, user } = useAuth(); // Get refreshUserProfile and user from useAuth
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

  // Effect to refresh user profile when currentSessionId changes or user object changes (e.g. after login)
  useEffect(() => {
    if (refreshUserProfile) {
      refreshUserProfile();
    }
  }, [currentSessionId, user?.id]); // Added user.id as a dependency

  // Get current chat session
  const currentSession = chatSessions.find(session => session.id === currentSessionId) || chatSessions[0];
  
  // Check if a file has already been uploaded for the current session
  const fileUploadedForCurrentSession = currentSession.messages.some(message => 
    message.role === 'user' && message.paperData !== undefined
  );

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
    // No need to call refreshUserProfile here, useEffect will handle it due to currentSessionId change
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
    // No need to call refreshUserProfile here, useEffect will handle it due to currentSessionId change
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

      // Refresh user profile to update credits
      if (refreshUserProfile) {
        await refreshUserProfile();
      }

    } catch (error: any) { // Added type assertion for error
      console.error('Error processing file:', error); // Log the actual error object
      // Check if error and error.message exist, then trim and compare
      if (error && typeof error.message === 'string' && error.message.trim() === 'Insufficient credits') {
        toast({
          variant: 'destructive',
          title: 'Error processing file',
          description: 'Insufficient credits'
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error processing file',
          description: 'There was a problem analyzing your paper. Please try again.'
        });
      }
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
    fileUploadedForCurrentSession,
    handleNewChat,
    handleSessionSelect,
    handleFileSelected
  };
}
