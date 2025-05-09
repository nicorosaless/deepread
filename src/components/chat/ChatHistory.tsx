import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/lib/types';
// import FileUploader from '@/components/FileUploader'; // Removed FileUploader import
import LoadingState from '@/components/LoadingState';

interface ChatHistoryProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  processingStage: string;
  // handleFileSelected: (file: File) => Promise<void>; // Removed handleFileSelected prop
  messagesEndRef: React.RefObject<HTMLDivElement>;
  // showFileUploader: boolean; // Removed showFileUploader prop
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  messages,
  isProcessing,
  processingStage,
  // handleFileSelected, // Removed handleFileSelected
  messagesEndRef,
  // showFileUploader // Removed showFileUploader
}) => {
  return (
    <ScrollArea className="flex-1 px-4">
      {messages.length === 0 && !isProcessing ? ( // Added !isProcessing condition
        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
          <h2 className="text-2xl font-semibold mb-2">Welcome to DeepRead</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Upload a PDF of an arXiv paper to get started. I'll analyze it and provide a summary and implementation suggestions.
          </p>
          {/* FileUploader component removed from here */}
        </div>
      ) : (
        <div className="py-8 space-y-6">
          {messages.map((message) => (
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

      {isProcessing && (
        <div className="px-4 py-6 border-t">
          <LoadingState message={processingStage} />
        </div>
      )}
    </ScrollArea>
  );
};

export default ChatHistory;
