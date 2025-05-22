import React from 'react';
import { PaperData, ProcessedPaper } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowUp, FileText, Code, MessageSquare } from 'lucide-react';
import PaperSummary from '@/components/PaperSummary';
import ProjectSuggestions from '@/components/ProjectSuggestions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  
  if (!paperData || !processedData) return null;

  return (
    <div className="border-t py-6">
      <div className="container max-w-4xl mx-auto">
        <section>
          <h2 className="text-2xl font-semibold mb-6">{t('paper_summary')}</h2>
          <PaperSummary
            title={paperData.title || "Untitled Paper"}
            summary={processedData.summary}
            authors={paperData.authors}
            date={paperData.date}
          />
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
