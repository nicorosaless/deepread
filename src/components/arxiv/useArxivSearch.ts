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
  const [lastSearchQuery, setLastSearchQuery] = useState<string>('');

  const { toast } = useToast();

  const searchPapers = async (params: ArxivSearchParams) => {
    try {
      setLoading(true);
      setError(null);
      
      // Almacenar la consulta actual
      setLastSearchQuery(params.query || '');
      
      // Realizar la búsqueda
      const results = await searchArxivPapers(params);
      
      setPapers(results.papers);
      setTotalResults(results.totalResults);
      setCurrentPage(params.start / params.maxResults);
      setMaxResults(params.maxResults);
      setCurrentParams(params);
      
      // Informar al usuario sobre los resultados
      if (results.papers.length === 0) {
        toast({
          title: "No se encontraron papers",
          description: params.query?.trim() 
            ? `No se encontraron resultados para "${params.query}"` 
            : "Intenta con términos de búsqueda específicos",
          variant: "default"
        });
      } else if (results.papers.length > 0) {
        toast({
          title: `${results.totalResults} resultados encontrados`,
          description: `Mostrando ${Math.min(params.maxResults, results.papers.length)} resultados`,
          variant: "default"
        });
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al buscar papers';
      setError(errorMessage);
      
      // Mensaje de error personalizado para el usuario
      toast({
        title: "Error en la búsqueda",
        description: errorMessage,
        variant: "destructive"
      });
      
      // Limpiar resultados anteriores en caso de error
      setPapers([]);
    } finally {
      setLoading(false);
    }
  };

  // Función para reintentar la búsqueda anterior
  const retrySearch = () => {
    if (currentParams) {
      searchPapers(currentParams);
    } else {
      // Si no hay una búsqueda anterior, realizar una búsqueda por defecto
      searchPapers({
        query: '',
        sortBy: 'lastUpdatedDate',
        sortOrder: 'descending',
        maxResults: 10,
        start: 0,
        categories: []
      });
    }
  };

  // Función para ir a la página siguiente
  const goToNextPage = () => {
    if (currentParams && (currentPage + 1) * maxResults < totalResults) {
      const nextPageParams = {
        ...currentParams,
        start: (currentPage + 1) * maxResults
      };
      searchPapers(nextPageParams);
      
      // Desplazar al principio después de cambiar de página
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Función para ir a la página anterior
  const goToPreviousPage = () => {
    if (currentParams && currentPage > 0) {
      const prevPageParams = {
        ...currentParams,
        start: (currentPage - 1) * maxResults
      };
      searchPapers(prevPageParams);
      
      // Desplazar al principio después de cambiar de página
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  return {
    papers,
    loading,
    error,
    totalResults,
    currentPage,
    maxResults,
    lastSearchQuery,
    searchPapers,
    retrySearch,
    goToNextPage,
    goToPreviousPage
  };
};
