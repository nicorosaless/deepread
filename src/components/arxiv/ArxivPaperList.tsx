import React from 'react';
import { ArxivPaper } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, File, BrainCircuit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ArxivPaperListProps {
  papers: ArxivPaper[];
  totalResults: number;
  currentPage: number;
  maxResults: number;
  loading: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onDeepReadPaper: (paper: ArxivPaper) => void;
}

const ArxivPaperList: React.FC<ArxivPaperListProps> = ({
  papers,
  totalResults,
  currentPage,
  maxResults,
  loading,
  onNextPage,
  onPreviousPage,
  onDeepReadPaper,
}) => {
  if (papers.length === 0) {
    return null;
  }

  const startIndex = currentPage * maxResults + 1;
  const endIndex = Math.min((currentPage + 1) * maxResults, totalResults);

  return (
    <div className="mt-4">
      <p className="text-xs text-sidebar-foreground/70 mb-2">
        Showing {startIndex}-{endIndex} of {totalResults} results
      </p>
      
      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {papers.map((paper) => (
            <Card key={paper.id} className="bg-sidebar/50 border-sidebar-border">
              <CardContent className="p-3">
                <h4 className="text-xs font-medium line-clamp-2">{paper.title}</h4>
                
                <p className="text-xs text-sidebar-foreground/70 mt-1">
                  {paper.authors.slice(0, 3).join(', ')}
                  {paper.authors.length > 3 && ", et al."}
                </p>
                
                <p className="text-[10px] text-sidebar-foreground/50 mt-1">
                  {formatDistanceToNow(paper.updated, { addSuffix: true })}
                </p>
                
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <a 
                    href={paper.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1"
                  >
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-7 text-[10px]"
                      title={paper.htmlUrl}
                    >
                      <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">arXiv</span>
                    </Button>
                  </a>
                  
                  <a 
                    href={paper.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1"
                  >
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-7 text-[10px]"
                      title={paper.pdfUrl}
                    >
                      <File className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">PDF</span>
                    </Button>
                  </a>

                  <Button 
                    variant="default"
                    size="sm" 
                    className="w-full h-7 text-[10px]"
                    onClick={() => onDeepReadPaper(paper)}
                    title={`DeepRead: ${paper.title}`}
                  >
                    <BrainCircuit className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate">DeepRead it</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
      
      <Pagination className="mt-2">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={onPreviousPage}
              className={`h-7 text-xs ${currentPage === 0 ? 'pointer-events-none opacity-50' : ''}`}
              aria-disabled={currentPage === 0 || loading}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext 
              onClick={onNextPage}
              className={`h-7 text-xs ${(currentPage + 1) * maxResults >= totalResults ? 'pointer-events-none opacity-50' : ''}`}
              aria-disabled={(currentPage + 1) * maxResults >= totalResults || loading}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export default ArxivPaperList;
