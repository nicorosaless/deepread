
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { ChevronLeftIcon, ChevronRightIcon, Code, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectSuggestion } from '@/lib/types';
import CodeImplementation from './CodeImplementation';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ProjectSuggestionsProps {
  projects: ProjectSuggestion[];
}

const ProjectSuggestions: React.FC<ProjectSuggestionsProps> = ({ projects }) => {
  const [activeTab, setActiveTab] = useState<string>(projects.length > 0 ? '0' : '');
  
  const handleDownloadZip = async (project: ProjectSuggestion) => {
    if (!project || !project.codeImplementation || project.codeImplementation.length === 0) {
      console.warn("No hay archivos de código para descargar en este proyecto.");
      return;
    }

    const zip = new JSZip();
    project.codeImplementation.forEach(file => {
      zip.file(file.filename, file.code);
    });

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${project.title.replace(/\s+/g, '_')}_code.zip`);
    } catch (error) {
      console.error("Error al crear el archivo ZIP:", error);
    }
  };

  return (
    <Card className="w-full bg-[#121212] border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-[#1e1e1e] text-white py-4 px-6 border-b border-[#333]">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          <CardTitle className="text-xl">Proyectos de Implementación</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6 bg-[#121212] text-white">
        {projects.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No hay sugerencias de proyectos disponibles
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start mb-6 overflow-x-auto flex-nowrap bg-[#1e1e1e] border-b border-[#333]">
              {projects.map((project, index) => (
                <TabsTrigger 
                  key={index} 
                  value={index.toString()} 
                  className="flex items-center gap-2 text-gray-300 data-[state=active]:text-white data-[state=active]:bg-[#2a2a2a]"
                >
                  {project.title}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {projects.map((project, index) => (
              <TabsContent key={index} value={index.toString()} className="space-y-4">
                <div className="border-b border-[#333] pb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-medium text-white">{project.title}</h3>
                    {project.codeImplementation && project.codeImplementation.length > 0 && (
                      <Button 
                        variant="outline"
                        size="sm"
                        className="bg-transparent border border-[#444] text-gray-300 hover:bg-[#2a2a2a] hover:text-white"
                        onClick={() => handleDownloadZip(project)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Descargar todo como ZIP
                      </Button>
                    )}
                  </div>
                  <p className="text-gray-400">{project.description}</p>
                </div>
                
                {project.codeImplementation.map((file, fileIndex) => (
                  <CodeImplementation 
                    key={fileIndex}
                    codeFile={file}
                    language={project.language}
                  />
                ))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectSuggestions;
