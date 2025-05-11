
import { useState } from 'react';
import { searchArxivPapers } from '@/lib/arxivApi';
import { ArxivPaper, ArxivSearchParams } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';

export const useArxivSearch = () => {
  const [papers, setPapers] = useState<ArxivPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [maxResults, setMaxResults] = useState(10);
  const [currentParams, setCurrentParams] = useState<ArxivSearchParams | null>(null);

  const { toast } = useToast();

  const searchPapers = async (params: ArxivSearchParams) => {
    try {
      setLoading(true);
      setError(null);
      
      const results = await searchArxivPapers(params);
      
      setPapers(results.papers);
      setTotalResults(results.totalResults);
      setCurrentPage(params.start / params.maxResults);
      setMaxResults(params.maxResults);
      setCurrentParams(params);
      
      if (results.papers.length === 0) {
        toast({
          title: "No papers found",
          description: "Try different search terms or filters",
          variant: "default"
        });
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search papers';
      setError(errorMessage);
      toast({
        title: "Search failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const goToNextPage = () => {
    if (currentParams && (currentPage + 1) * maxResults < totalResults) {
      const nextPageParams = {
        ...currentParams,
        start: (currentPage + 1) * maxResults
      };
      searchPapers(nextPageParams);
    }
  };

  const goToPreviousPage = () => {
    if (currentParams && currentPage > 0) {
      const prevPageParams = {
        ...currentParams,
        start: (currentPage - 1) * maxResults
      };
      searchPapers(prevPageParams);
    }
  };

  return {
    papers,
    loading,
    error,
    totalResults,
    currentPage,
    maxResults,
    searchPapers,
    goToNextPage,
    goToPreviousPage
  };
};
