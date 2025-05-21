
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Code } from 'lucide-react';
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
      title: "Código copiado al portapapeles",
      description: "El código ha sido copiado a tu portapapeles",
      duration: 3000
    });
  };
  
  return (
    <div className="space-y-2 my-4">
      <div className="flex justify-between items-center text-white">
        <div className="flex items-center">
          <span className="text-sm font-semibold mr-2">Archivo: {codeFile.filename}</span>
          <span className="text-sm font-medium text-gray-400 mr-2">Lenguaje:</span>
          <span className="text-sm text-gray-200">{language}</span>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCopyCode}
            className="bg-transparent border border-[#444] text-gray-300 hover:bg-[#2a2a2a] hover:text-white"
          >
            <Check className="h-4 w-4 mr-1" /> Copiar Código
          </Button>
        </div>
      </div>
      
      <Card className="relative font-mono text-sm overflow-x-auto p-4 bg-[#1e1e1e] border border-[#333] text-gray-200 rounded-md">
        <pre className="whitespace-pre-wrap break-words">
          {codeFile.code}
        </pre>
      </Card>
    </div>
  );
};

export default CodeImplementation;
