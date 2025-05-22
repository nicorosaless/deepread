import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Code } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface CodeFile {
  filename: string;
  code: string;
}

interface CodeImplementationProps {
  codeFiles: CodeFile[]; // Updated to support multiple files
  language: string;
}

const CodeImplementation: React.FC<CodeImplementationProps> = ({ codeFiles, language }) => {
  const { toast } = useToast();

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Código copiado al portapapeles",
      description: "El código ha sido copiado a tu portapapeles",
      duration: 3000
    });
  };

  const handleDownloadZip = () => {
    const zip = new JSZip();
    codeFiles.forEach(file => {
      zip.file(file.filename, file.code);
    });
    zip.generateAsync({ type: "blob" }).then(content => {
      saveAs(content, "code_implementation.zip");
    });
  };

  return (
    <div className="space-y-4 my-4">
      <div className="flex justify-between items-center text-white">
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-400 mr-2">Lenguaje:</span>
          <span className="text-sm text-gray-200">{language}</span>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadZip}
            className="bg-transparent border border-[#444] text-gray-300 hover:bg-[#2a2a2a] hover:text-white"
          >
            Descargar ZIP
          </Button>
        </div>
      </div>

      {codeFiles.map((file, index) => (
        <div key={index} className="space-y-2">
          <div className="flex justify-between items-center text-white">
            <span className="text-sm font-semibold">Archivo: {file.filename}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleCopyCode(file.code)}
              className="bg-transparent border border-[#444] text-gray-300 hover:bg-[#2a2a2a] hover:text-white"
            >
              <Check className="h-4 w-4 mr-1" /> Copiar Código
            </Button>
          </div>
          <Card className="relative font-mono text-sm overflow-x-auto p-4 bg-[#1e1e1e] border border-[#333] text-gray-200 rounded-md">
            <pre className="whitespace-pre-wrap break-words">
              {file.code}
            </pre>
          </Card>
        </div>
      ))}
    </div>
  );
};

export default CodeImplementation;
