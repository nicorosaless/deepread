import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface ChatInputProps {
  isProcessing: boolean;
  onSendMessage: (message: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ isProcessing, onSendMessage }) => {
  const [message, setMessage] = useState('');

  const handleSendMessage = () => {
    if (message.trim() && !isProcessing) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="p-4 border-t">
      <div className="flex items-center space-x-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="resize-none"
          rows={1}
          disabled={isProcessing}
        />
        <Button 
          onClick={handleSendMessage}
          size="icon"
          disabled={!message.trim() || isProcessing}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {isProcessing && <p className="text-xs text-muted-foreground mt-2">Processing...</p>}
    </div>
  );
};

export default ChatInput;
