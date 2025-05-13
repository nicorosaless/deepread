import React from 'react';
import { PaperData, ProcessedPaper, ArxivPaper, CodeFile } from '@/lib/types'; // Added ArxivPaper, CodeFile
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import PaperSummary from '@/components/PaperSummary';
import CodeImplementation from '@/components/CodeImplementation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PaperAnalysisProps {
  paperData: PaperData | ArxivPaper | null;
  processedData: ProcessedPaper | null;
  scrollToTop: () => void;
}

const PaperAnalysis: React.FC<PaperAnalysisProps> = ({
  paperData,
  processedData,
  scrollToTop
}) => {
  if (!paperData || !processedData) return null;

  const isArxiv = (data: PaperData | ArxivPaper): data is ArxivPaper => {
    return 'pdfUrl' in data && Array.isArray((data as ArxivPaper).authors);
  };

  const getAuthors = (): string[] | undefined => {
    if (paperData && isArxiv(paperData)) {
      return paperData.authors;
    }
    return undefined;
  };

  const getDate = (): string | undefined => {
    if (paperData && isArxiv(paperData) && paperData.published) {
      const pubDate = paperData.published;
      if (pubDate instanceof Date) {
        return pubDate.toLocaleDateString();
      }
      // If it's a string, assume it's already formatted or directly usable.
      // If it's another type that needs conversion, that logic would go here.
      if (typeof pubDate === 'string') {
        // Optionally, parse and reformat if it's a specific string format
        // For now, returning as is.
        return pubDate;
      }
      // Fallback for other types or if more complex conversion is needed
      // This case should ideally not be hit if types are well-defined
      return String(pubDate); 
    }
    return undefined;
  };

  return (
    <div className="border-t py-6">
      <div className="container max-w-4xl mx-auto space-y-6">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="code">Code Implementation</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary">
            <section>
              {/* <h2 className="text-2xl font-semibold mb-6">Summary & Analysis</h2> */}
              <PaperSummary
                title={paperData.title || "Untitled Paper"}
                summary={processedData.summary}
                authors={getAuthors()}
                date={getDate()}
              />
            </section>
          </TabsContent>
          
          <TabsContent value="code">
            <section>
              <h2 className="text-2xl font-semibold mb-6">Code Implementation & Project Ideas</h2>
              {processedData.projectSuggestions && processedData.projectSuggestions.length > 0 ? (
                processedData.projectSuggestions.map((suggestion, sIdx) => (
                  <div key={sIdx} className="mb-8 p-4 border rounded-lg shadow-sm bg-card">
                    <h3 className="text-xl font-semibold mb-2 text-card-foreground">{suggestion.title}</h3>
                    <p className="text-muted-foreground mb-4 whitespace-pre-line">{suggestion.description}</p>
                    {suggestion.codeImplementation && suggestion.codeImplementation.length > 0 ? (
                      suggestion.codeImplementation.map((file: CodeFile, fIdx: number) => (
                        <CodeImplementation key={fIdx} codeFile={file} language={suggestion.language} />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No specific code snippets provided for this project idea.</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground mt-4">No code implementation suggestions or project ideas available for this paper.</p>
              )}
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
