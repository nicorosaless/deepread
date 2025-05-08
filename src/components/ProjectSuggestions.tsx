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
import { Code, Download } from 'lucide-react'; // Added Download icon
import { Button } from '@/components/ui/button';
import { ProjectSuggestion } from '@/lib/types';
import CodeImplementation from './CodeImplementation';
import JSZip from 'jszip'; // Import JSZip
import { saveAs } from 'file-saver'; // Import file-saver for easy download prompting

interface ProjectSuggestionsProps {
  projects: ProjectSuggestion[];
}

const ProjectSuggestions: React.FC<ProjectSuggestionsProps> = ({ projects }) => {
  const [activeTab, setActiveTab] = useState<string>(projects.length > 0 ? '0' : '');
  
  const handleDownloadZip = async (project: ProjectSuggestion) => {
    if (!project || !project.codeImplementation || project.codeImplementation.length === 0) {
      // Optionally, show a toast or alert if there are no files
      console.warn("No code files to download for this project.");
      return;
    }

    const zip = new JSZip();
    project.codeImplementation.forEach(file => {
      zip.file(file.filename, file.code);
    });

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${project.title.replace(/\s+/g, '_')}_code.zip`); // Use file-saver
    } catch (error) {
      console.error("Error creating ZIP file:", error);
      // Optionally, show a toast or alert for the error
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="bg-implementation text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          <CardTitle>Implementation Projects</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {projects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No project suggestions available
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start mb-6 overflow-x-auto flex-nowrap">
              {projects.map((project, index) => (
                <TabsTrigger key={index} value={index.toString()} className="flex items-center gap-2">
                  {project.title}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {projects.map((project, index) => (
              <TabsContent key={index} value={index.toString()} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-medium">{project.title}</h3>
                    {project.codeImplementation && project.codeImplementation.length > 0 && (
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadZip(project)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download All as ZIP
                      </Button>
                    )}
                  </div>
                  <p className="text-gray-700">{project.description}</p>
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
