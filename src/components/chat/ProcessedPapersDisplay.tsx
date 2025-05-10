import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ChatMessage } from '@/lib/types'; // Ensure ChatMessage type is imported

const ProcessedPapersDisplay: React.FC = () => {
  const { processedPaperMessages } = useAuth();

  if (!processedPaperMessages || processedPaperMessages.length === 0) {
    return null; // Don't render anything if there are no messages
  }

  // Helper to determine content type for display
  const getContentTypeDisplay = (message: ChatMessage): string => {
    if (message.content_type === 'summary') return 'Summary';
    if (message.content_type === 'code_suggestion') return 'Code Suggestion';
    return 'Processed Analysis';
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Past Paper Analyses</CardTitle>
        <CardDescription>Review summaries and code suggestions from your previously processed papers.</CardDescription>
      </CardHeader>
      <CardContent>
        {processedPaperMessages.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {processedPaperMessages.map((message, index) => (
              <AccordionItem value={`item-${index}`} key={message.id || index}>
                <AccordionTrigger>
                  {message.paperData?.title ? `${getContentTypeDisplay(message)} for "${message.paperData.title}"` : getContentTypeDisplay(message)}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="prose dark:prose-invert max-w-none">
                    <p><strong>Date:</strong> {new Date(message.timestamp).toLocaleString()}</p>
                    {message.paperData?.authors && (
                      <p><strong>Authors:</strong> {Array.isArray(message.paperData.authors) ? message.paperData.authors.join(', ') : message.paperData.authors}</p>
                    )}
                    {message.paperData?.abstract && message.content_type === 'summary' && (
                       <>
                         <p><strong>Abstract:</strong></p>
                         <p>{message.paperData.abstract}</p>
                       </>
                    )}
                    <p><strong>{getContentTypeDisplay(message)}:</strong></p>
                    {message.content_type === 'code_suggestion' ? (
                        <pre><code>{typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2)}</code></pre>
                    ) : (
                        <p>{message.content}</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p>No processed paper analyses found.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ProcessedPapersDisplay;
