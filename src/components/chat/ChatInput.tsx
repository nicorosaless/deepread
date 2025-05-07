
import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface ChatInputProps {
  isProcessing: boolean;
  handleFileSelected: (file: File) => Promise<void>;
}

const ChatInput: React.FC<ChatInputProps> = ({
  isProcessing,
  handleFileSelected,
}) => {
  return (
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
  );
};

export default ChatInput;
