
import React from 'react';
import { PaperData, ProcessedPaper } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowUp, FileText, Code, MessageSquare } from 'lucide-react';
import PaperSummary from '@/components/PaperSummary';
import ProjectSuggestions from '@/components/ProjectSuggestions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface PaperAnalysisProps {
  paperData: PaperData | null;
  processedData: ProcessedPaper | null;
  scrollToTop: () => void;
}

const PaperAnalysis: React.FC<PaperAnalysisProps> = ({
  paperData,
  processedData,
  scrollToTop
}) => {
  if (!paperData || !processedData) return null;

  return (
    <div className="border-t py-6">
      <div className="container max-w-4xl mx-auto">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-8">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="implementation" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Implementación
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chatbot
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-6">Resumen & Análisis</h2>
              <PaperSummary
                title={paperData.title || "Untitled Paper"}
                summary={processedData.summary}
                authors={paperData.authors}
                date={paperData.date}
              />
            </section>
          </TabsContent>
          
          <TabsContent value="implementation" className="space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-6">
                Sugerencias de Implementación
              </h2>
              <ProjectSuggestions projects={processedData.projectSuggestions} />
            </section>
          </TabsContent>
          
          <TabsContent value="chat" className="space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-6">
                Chatbot Asistente
              </h2>
              <div className="bg-secondary/30 rounded-lg p-6 text-center">
                <p className="text-muted-foreground">
                  Esta función estará disponible pronto. Podrás hacer preguntas específicas sobre el paper y recibir respuestas.
                </p>
              </div>
            </section>
          </TabsContent>
        </Tabs>
        
        <div className="fixed bottom-6 right-6">
          <Button
            onClick={scrollToTop}
            size="icon"
            className="rounded-full shadow-lg"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaperAnalysis;
