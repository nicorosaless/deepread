import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage, UserData } from '@/lib/types'; // Added UserData import
import FileUploader from '@/components/FileUploader';
import LoadingState from '@/components/LoadingState';

interface ChatHistoryProps {
  messages: ChatMessage[];
  isLoading: boolean;
  showFileUploader: boolean;
  handleFileSelected: (file: File) => void;
  isProcessing: boolean;
  user: UserData | null; // Added user prop
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  messages,
  isLoading,
  showFileUploader,
  handleFileSelected,
  isProcessing,
  user, // Destructured user prop
}) => {
  const defaultMessage = "Upload a PDF of an arXiv paper to get started. I'll analyze it and provide a summary and implementation suggestions.";

  return (
    <ScrollArea className="h-full p-4">
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-muted-foreground mb-4 text-center max-w-lg">
            {defaultMessage}
          </p>
          {showFileUploader && (
            <div className="w-full max-w-md mt-4">
              <FileUploader 
                onFileSelected={handleFileSelected} 
                isProcessing={isProcessing} 
              />
            </div>
          )}
        </div>
      )}
      {isLoading && <LoadingState />}
      {messages.map((message, index) => (
        <div key={index} className="mb-4">
          <p className="text-muted-foreground">{message.content}</p>
        </div>
      ))}
    </ScrollArea>
  );
};

export default ChatHistory;