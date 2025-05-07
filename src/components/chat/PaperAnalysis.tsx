
import React from 'react';
import { PaperData, ProcessedPaper } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import PaperSummary from '@/components/PaperSummary';
import ProjectSuggestions from '@/components/ProjectSuggestions';

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
      <div className="container max-w-4xl mx-auto space-y-10">
        <section>
          <h2 className="text-2xl font-semibold mb-6">Summary & Analysis</h2>
          <PaperSummary
            title={paperData.title || "Untitled Paper"}
            summary={processedData.summary}
            keyPoints={processedData.keyPoints}
            authors={paperData.authors}
            date={paperData.date}
          />
        </section>

        <Separator className="my-8" />
        
        <section>
          <h2 className="text-2xl font-semibold mb-6">
            Suggested Implementation Projects
          </h2>
          <ProjectSuggestions projects={processedData.projectSuggestions} />
        </section>
        
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
