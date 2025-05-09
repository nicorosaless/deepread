import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileSelected, 
  isProcessing
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      if (file.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file.",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onFileSelected(selectedFile);
    } else {
      toast({
        title: "No file selected",
        description: "Please select a PDF file first.",
        variant: "destructive"
      });
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center">
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="hidden"
        ref={fileInputRef}
        disabled={isProcessing}
      />
      
      <div className="w-full">
        {!selectedFile ? (
          <Button 
            onClick={handleButtonClick} 
            variant="outline"
            className="w-full border-dashed border-gray-500 bg-gray-800 hover:bg-gray-700"
            disabled={isProcessing}
          >
            Select PDF
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-center text-muted-foreground">
              {selectedFile.name}
            </div>
            <Button 
              onClick={handleUpload} 
              className="w-full"
              disabled={isProcessing}
            >
              Process Paper
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploader;
