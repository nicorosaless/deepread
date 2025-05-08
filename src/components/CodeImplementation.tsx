import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CodeFile {
  filename: string;
  code: string;
}

interface CodeImplementationProps {
  codeFile: CodeFile;
  language: string;
}

const CodeImplementation: React.FC<CodeImplementationProps> = ({ codeFile, language }) => {
  const { toast } = useToast();
  
  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeFile.code);
    toast({
      title: "Code copied to clipboard",
      description: "The code has been copied to your clipboard",
      duration: 3000
    });
  };
  
  return (
    <div className="space-y-2 my-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-sm font-semibold text-gray-700 mr-2">File: {codeFile.filename}</span>
          <span className="text-sm font-medium text-gray-500 mr-2">Language:</span>
          <span className="text-sm">{language}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyCode}>
            <Check className="h-4 w-4 mr-1" /> Copy Code
          </Button>
        </div>
      </div>
      
      <Card className="relative font-mono text-sm overflow-x-auto p-4 bg-gray-50 border border-gray-200">
        <pre className="whitespace-pre-wrap break-all">
          {codeFile.code}
        </pre>
      </Card>
    </div>
  );
};

export default CodeImplementation;
