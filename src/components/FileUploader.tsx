
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileText, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelected, isProcessing }) => {
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
    <Card className="p-6 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
      <FileText className="w-12 h-12 text-paper mb-4" />
      <h3 className="text-xl font-medium mb-2">Upload arXiv Paper</h3>
      <p className="text-gray-500 mb-4 text-center max-w-md">
        Upload a PDF file of an arXiv paper to get a summary and implementation suggestions
      </p>
      
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="hidden"
        ref={fileInputRef}
        disabled={isProcessing}
      />
      
      <div className="space-y-3 w-full max-w-xs">
        <Button 
          onClick={handleButtonClick} 
          variant="outline" 
          className="w-full"
          disabled={isProcessing}
        >
          <Upload className="mr-2 h-4 w-4" />
          Select PDF
        </Button>
        
        {selectedFile && (
          <div className="flex flex-col space-y-2">
            <p className="text-sm text-center break-all">
              Selected: {selectedFile.name}
            </p>
            <Button 
              onClick={handleUpload} 
              className="w-full bg-paper hover:bg-paper-dark"
              disabled={isProcessing}
            >
              Process Paper
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default FileUploader;
