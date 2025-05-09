import React from 'react';

interface ChatInputProps {
  isProcessing: boolean;
  // handleFileSelected is no longer needed here as FileUploader is in ChatHistory
  // showFileUploader is no longer needed here
}

const ChatInput: React.FC<ChatInputProps> = ({ isProcessing }) => {
  return (
    <div className="p-4 border-t">
      <div className="flex items-center space-x-4">
        {/* The file upload button is removed from here */}
        {/* Placeholder for future input elements if any */}
        {isProcessing && <p className="text-sm text-muted-foreground">Processing...</p>}
      </div>
    </div>
  );
};

export default ChatInput;
