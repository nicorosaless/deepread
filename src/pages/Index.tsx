
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowUp, MessageSquare } from 'lucide-react';
import Header from '@/components/Header';
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
      const processedPaper = await processPaperWithLLM(extractedPaperData);
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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Hero section with chat link */}
          <section className="text-center py-12">
            <h1 className="text-4xl font-bold mb-4 text-foreground">Welcome to DeepRead</h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Transforming complex research papers into accessible knowledge and actionable projects
            </p>
            <div className="flex justify-center gap-4">
              <FileUploader 
                onFileSelected={handleFileSelected} 
                isProcessing={isProcessing}
                showTokenButton={true}
              />
            </div>
            <div className="mt-8">
              <Link to="/chat">
                <Button variant="outline" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Open Chat Interface
                </Button>
              </Link>
            </div>
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
                <h2 className="text-2xl font-semibold mb-6">Summary & Analysis</h2>
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
            </>
          )}
        </div>
      </main>

      <footer className="bg-secondary border-t py-8">
        <div className="container">
          <div className="text-center">
            <p className="text-muted-foreground">
              DeepRead | Building bridges between academic research and practical implementation
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
