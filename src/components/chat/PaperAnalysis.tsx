
import React from 'react';
import { PaperData, ProcessedPaper } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import PaperSummary from '@/components/PaperSummary';
import ProjectSuggestions from '@/components/ProjectSuggestions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
          <TabsList className="w-full grid grid-cols-2 mb-8">
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="implementation">Implementación</TabsTrigger>
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
