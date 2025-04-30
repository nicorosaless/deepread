
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/toaster';
import { ArrowUp } from 'lucide-react';
import FileUploader from '@/components/FileUploader';
import LoadingState from '@/components/LoadingState';
import PaperSummary from '@/components/PaperSummary';
import ProjectSuggestions from '@/components/ProjectSuggestions';
import { extractTextFromPDF, processPaperWithLLM } from '@/lib/pdfExtractor';
import { PaperData, ProcessedPaper } from '@/lib/types';

const Index = () => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paperData, setPaperData] = useState<PaperData | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedPaper | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');

  const handleFileSelected = async (file: File) => {
    try {
      setIsProcessing(true);
      setProcessingStage('Extracting text from PDF...');
      setPaperData(null);
      setProcessedData(null);

      // Extract text from PDF
      const extractedPaperData = await extractTextFromPDF(file);
      setPaperData(extractedPaperData);
      
      // Process with LLM
      setProcessingStage('Analyzing with AI...');
      const processedPaper = await processPaperWithLLM(extractedPaperData) as ProcessedPaper;
      setProcessedData(processedPaper);
      
      setIsProcessing(false);
    } catch (error) {
      console.error('Error processing file:', error);
      setIsProcessing(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-paper text-white py-6 shadow-md">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Paper to Practice Path</h1>
              <p className="text-paper-light mt-1">
                Transform arXiv papers into practical implementations
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* File uploader section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Upload Paper</h2>
            <FileUploader 
              onFileSelected={handleFileSelected} 
              isProcessing={isProcessing} 
            />
          </section>

          {/* Processing state */}
          {isProcessing && (
            <section>
              <Separator className="my-8" />
              <LoadingState message={processingStage} />
            </section>
          )}

          {/* Results section */}
          {processedData && !isProcessing && (
            <>
              <Separator className="my-8" />
              
              <section>
                <h2 className="text-2xl font-semibold mb-6 text-gray-800">Summary & Analysis</h2>
                <PaperSummary
                  title={paperData?.title || "Untitled Paper"}
                  summary={processedData.summary}
                  keyPoints={processedData.keyPoints}
                  authors={paperData?.authors}
                  date={paperData?.date}
                />
              </section>

              <Separator className="my-8" />
              
              <section>
                <h2 className="text-2xl font-semibold mb-6 text-gray-800">
                  Suggested Implementation Projects
                </h2>
                <ProjectSuggestions projects={processedData.projectSuggestions} />
              </section>
              
              <div className="fixed bottom-6 right-6">
                <Button
                  onClick={scrollToTop}
                  size="icon"
                  className="rounded-full bg-paper hover:bg-paper-dark shadow-lg"
                >
                  <ArrowUp className="h-5 w-5" />
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="bg-gray-100 border-t py-8">
        <div className="container">
          <div className="text-center">
            <p className="text-gray-600">
              Paper to Practice Path | Building bridges between academic research and practical implementation
            </p>
          </div>
        </div>
      </footer>
      
      <Toaster />
    </div>
  );
};

export default Index;
