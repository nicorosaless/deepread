
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
import { Badge } from '@/components/ui/badge';
import { Code } from 'lucide-react';
import { ProjectSuggestion } from '@/lib/types';
import CodeImplementation from './CodeImplementation';

interface ProjectSuggestionsProps {
  projects: ProjectSuggestion[];
}

const ProjectSuggestions: React.FC<ProjectSuggestionsProps> = ({ projects }) => {
  const [activeTab, setActiveTab] = useState<string>(projects.length > 0 ? '0' : '');
  
  const getDifficultyColor = (difficulty: string) => {
    switch(difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
      case 'Advanced': return 'bg-red-100 text-red-800 hover:bg-red-100';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
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
                  <Badge className={getDifficultyColor(project.difficulty)}>
                    {project.difficulty}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            
            {projects.map((project, index) => (
              <TabsContent key={index} value={index.toString()} className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium mb-2">{project.title}</h3>
                  <p className="text-gray-700">{project.description}</p>
                </div>
                
                <CodeImplementation 
                  code={project.codeImplementation}
                  language={project.language}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectSuggestions;
