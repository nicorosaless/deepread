import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatSession, ChatMessage, PaperData, ProcessedPaper } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { extractTextFromPDF, processPaperWithLLM, saveUserChatSession, getUserChatSessions } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export function useChatSessions() {
  const { toast } = useToast();
  const { refreshUserProfile, user, isAuthenticated } = useAuth();
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
  const [isSavingSession, setIsSavingSession] = useState<boolean>(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  
  // En lugar de usar una ref que persiste entre recargas, usamos un estado
  const [sessionsAttempted, setSessionsAttempted] = useState<boolean>(false);
  
  // Usar un ref para evitar actualizaciones innecesarias del perfil
  const lastProfileRefresh = useRef<Date | null>(null);
  // Usar un ref para rastrear la última sesión guardada
  const lastSavedSession = useRef<{id: string, timestamp: Date} | null>(null);

  // Cargar sesiones de chat del usuario cuando se inicia sesión
  useEffect(() => {
    console.log("Auth state changed, checking for sessions:", { isAuthenticated, user, sessionsAttempted });
    
    const loadUserSessions = async () => {
      // Solo cargar sesiones si el usuario está autenticado y hay un usuario
      if (isAuthenticated && user && !sessionsAttempted) {
        setIsLoadingSessions(true);
        setSessionsAttempted(true); // Marcar que ya intentamos cargar las sesiones
        
        try {
          console.log("Fetching user chat sessions from API...");
          console.log("User ID:", user.id);
          
          // Intentar acceder al nuevo endpoint de diagnóstico para verificar el estado de la base de datos
          try {
            const token = localStorage.getItem('auth_token');
            if (token) {
              const debugResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/debug/db-status`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                }
              });
              if (debugResponse.ok) {
                const dbStatus = await debugResponse.json();
                console.log("Database status:", dbStatus);
              }
            }
          } catch (debugError) {
            console.error("Error checking database status:", debugError);
          }
          
          const sessions = await getUserChatSessions();
          console.log(`Fetched ${sessions.length} sessions`);
          
          if (sessions && sessions.length > 0) {
            // Si hay sesiones guardadas, las usamos
            console.log("Retrieved sessions:", sessions);
            setChatSessions(sessions);
            
            // Seleccionamos la sesión más reciente
            const mostRecentSession = sessions.sort((a, b) => 
              new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
            )[0];
            
            setCurrentSessionId(mostRecentSession.id);
            console.log("Selected session:", mostRecentSession.id);
            
            // Actualizamos paper data si está disponible
            const lastUserMessageWithPaper = mostRecentSession.messages
              .filter(m => m.role === 'user' && m.paperData)
              .pop();
              
            if (lastUserMessageWithPaper) {
              setCurrentPaperData(lastUserMessageWithPaper.paperData);
              setCurrentProcessedData(lastUserMessageWithPaper.processedData || null);
            }
          } else {
            console.log("No sessions found, using default");
          }
        } catch (error) {
          console.error('Error loading chat sessions:', error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to load chat history. Please try again later.'
          });
        } finally {
          setIsLoadingSessions(false);
        }
      }
    };
    
    loadUserSessions();
  }, [isAuthenticated, user, toast, sessionsAttempted]); // Añadido sessionsAttempted como dependencia

  // Reiniciar sessionsAttempted cuando se cierra sesión
  useEffect(() => {
    if (!isAuthenticated) {
      setSessionsAttempted(false);
      // Volver a la sesión default cuando se cierra sesión
      setChatSessions([{
        id: 'default',
        title: 'New Chat',
        lastUpdated: new Date(),
        messages: []
      }]);
      setCurrentSessionId('default');
    }
  }, [isAuthenticated]);

  // Optimizar el refresh del perfil de usuario para que no se llame constantemente
  const refreshUserProfileOptimized = useCallback(() => {
    if (!refreshUserProfile) return;
    
    const now = new Date();
    // Solo actualizar si pasaron al menos 30 segundos desde la última actualización
    if (!lastProfileRefresh.current || now.getTime() - lastProfileRefresh.current.getTime() > 30000) {
      lastProfileRefresh.current = now;
      refreshUserProfile();
    }
  }, [refreshUserProfile]);

  // Guardar la sesión actual cuando hay cambios significativos
  useEffect(() => {
    const saveCurrentSession = async () => {
      // Solo guardar si hay un usuario autenticado, no es la sesión default y hay cambios para guardar
      if (isAuthenticated && user && currentSessionId !== 'default' && currentSessionId !== 'new') {
        const currentSession = chatSessions.find(s => s.id === currentSessionId);
        
        // Solo guardar si hay mensajes en la sesión y no se está guardando actualmente
        if (currentSession && currentSession.messages.length > 0 && !isSavingSession) {
          // Verificar si esta sesión ya se guardó recientemente (últimos 5 segundos)
          const shouldSave = 
            !lastSavedSession.current || 
            lastSavedSession.current.id !== currentSessionId ||
            new Date().getTime() - lastSavedSession.current.timestamp.getTime() > 5000;
            
          if (shouldSave) {
            setIsSavingSession(true);
            try {
              await saveUserChatSession(currentSession);
              lastSavedSession.current = {
                id: currentSessionId,
                timestamp: new Date()
              };
              console.log(`Saved session ${currentSessionId} successfully`);
            } catch (error) {
              console.error('Error saving chat session:', error);
            } finally {
              setIsSavingSession(false);
            }
          }
        }
      }
    };
    
    // Debounce para no guardar en cada pequeño cambio - aumentado a 3 segundos
    const debounceTimer = setTimeout(() => {
      saveCurrentSession();
    }, 3000);
    
    return () => clearTimeout(debounceTimer);
  }, [chatSessions, currentSessionId, isAuthenticated, user, isSavingSession]);

  // Get current chat session
  const currentSession = chatSessions.find(session => session.id === currentSessionId) || chatSessions[0];
  
  // Check if a file has already been uploaded for the current session
  const fileUploadedForCurrentSession = currentSession.messages.some(message => 
    message.role === 'user' && message.paperData !== undefined
  );

  const handleNewChat = async () => {
    const newSession: ChatSession = {
      id: 'new', // Cambiado de uuidv4() a 'new' para que el servidor asigne un ID válido
      title: 'New Chat',
      lastUpdated: new Date(),
      messages: []
    };

    setChatSessions(prev => [...prev, newSession]);
    setCurrentSessionId('new'); // Usamos 'new' temporalmente
    setCurrentPaperData(null);
    setCurrentProcessedData(null);
    
    // Si el usuario está autenticado, guardamos la nueva sesión
    if (isAuthenticated && user) {
      try {
        // Al enviar la sesión al servidor, eliminamos el id para que MongoDB asigne uno nuevo
        const sessionToSave = {
          ...newSession
        };
        delete sessionToSave.id; // Eliminamos el id para que el servidor lo genere
        
        console.log("Creating new session on server...");
        const savedSession = await saveUserChatSession(sessionToSave);
        console.log("New session created with ID:", savedSession.id);
        
        // Actualizamos el ID con el retornado del servidor
        setChatSessions(prev => 
          prev.map(session => 
            session.id === 'new' ? { ...session, id: savedSession.id } : session
          )
        );
        setCurrentSessionId(savedSession.id);
        
        // Actualizar el último guardado
        lastSavedSession.current = {
          id: savedSession.id,
          timestamp: new Date()
        };
      } catch (error) {
        console.error('Error creating new chat session:', error);
        // En caso de error, volvemos a la sesión default
        setCurrentSessionId('default');
      }
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    if (sessionId === currentSessionId) return; // No hacer nada si ya es la sesión actual
    
    setCurrentSessionId(sessionId);
    
    // Find the session data
    const session = chatSessions.find(s => s.id === sessionId);
    
    // Set the current paper data based on the last user message with paper data
    const lastUserMessageWithPaper = session?.messages
      .filter(m => m.role === 'user' && m.paperData)
      .pop();
      
    setCurrentPaperData(lastUserMessageWithPaper?.paperData || null);
    setCurrentProcessedData(lastUserMessageWithPaper?.processedData || null);
    
    // Actualizar el perfil del usuario, pero de forma optimizada
    refreshUserProfileOptimized();
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

      // Refresh user profile de forma optimizada
      refreshUserProfileOptimized();

    } catch (error: any) {
      console.error('Error processing file:', error);
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

  // Función para agregar mensajes de chat normales
  const handleAddMessage = async (content: string, role: 'user' | 'assistant') => {
    const newMessage: ChatMessage = {
      id: uuidv4(),
      content,
      role,
      timestamp: new Date()
    };

    // Actualizar la sesión actual con el nuevo mensaje
    const updatedSessions = chatSessions.map(session => {
      if (session.id === currentSessionId) {
        return {
          ...session,
          lastUpdated: new Date(),
          messages: [...session.messages, newMessage]
        };
      }
      return session;
    });

    setChatSessions(updatedSessions);
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
    isLoadingSessions,
    handleNewChat,
    handleSessionSelect,
    handleFileSelected,
    handleAddMessage
  };
}
