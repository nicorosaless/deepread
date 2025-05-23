import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/lib/types';
import FileUploader from '@/components/FileUploader';
import LoadingState from '@/components/LoadingState';

interface ChatHistoryProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  processingStage: string;
  handleFileSelected: (file: File) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onShowArxivSearch: () => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  messages,
  isProcessing,
  processingStage,
  handleFileSelected,
  messagesEndRef,
  onShowArxivSearch,
}) => {
  return (
    <ScrollArea className="flex-1 px-4">
      {messages.length === 0 && !isProcessing ? (
        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
          <h2 className="text-2xl font-semibold mb-2">Welcome to DeepRead</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Upload a PDF of an arXiv paper to get started, or visit the <button onClick={onShowArxivSearch} className="text-blue-500 underline">ArXiv Search</button> page. I'll analyze it and provide a summary and implementation suggestions.
          </p>
          <div className="w-full max-w-[240px]">
            <FileUploader
              onFileSelected={handleFileSelected}
              isProcessing={isProcessing}
            />
          </div>
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
