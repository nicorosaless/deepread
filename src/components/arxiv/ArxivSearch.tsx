import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent, 
  SelectGroup,
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Search, RefreshCw, AlertCircle } from 'lucide-react';
import { useArxivSearch } from '@/components/arxiv/useArxivSearch';
import ArxivPaperList from '@/components/arxiv/ArxivPaperList';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getArxivAICategories, getTimeframeOptions } from '@/lib/arxivApi';
import { ArxivPaper } from '@/lib/types'; // Import ArxivPaper type
import { useChatSessions } from '@/components/chat/useChatSessions'; // Import useChatSessions
import LoadingState from '@/components/LoadingState'; // Import LoadingState

interface ArxivSearchProps {
  onPaperSelectedForDeepRead?: (paper: ArxivPaper) => void; // Nueva prop opcional
}

const ArxivSearch: React.FC<ArxivSearchProps> = ({ onPaperSelectedForDeepRead }) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Mantener estas variables con valores predeterminados
  const sortBy = 'lastUpdatedDate';
  const sortOrder = 'descending';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('all');
  
  // Obtener las categorías y opciones de timeframe
  const categories = getArxivAICategories();
  const timeframeOptions = getTimeframeOptions();
  
  const { 
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
  } = useArxivSearch();

  // Obtener handleAddMessage y otras funciones necesarias de useChatSessions
  // Esto asume que ArxivSearch se renderiza en un contexto donde useChatSessions está disponible
  // o que pasamos las funciones necesarias como props si no es así.
  // Por simplicidad, lo llamaremos aquí, pero podría necesitar refactorización
  // dependiendo de dónde se use ArxivSearch y cómo se maneje el estado del chat.
  const { handleNewChatWithArxivPaper } = useChatSessions(); 

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Crear array de categorías seleccionadas - solo incluir categorías reales, no 'all'
    const categoriesArray = selectedCategory !== 'all' ? [selectedCategory] : [];
    
    // Preparar el timeframe - asegurémonos que sea un valor válido
    const timeframe = ['all', 'last_week', 'last_month', 'last_year'].includes(selectedTimeframe) 
      ? selectedTimeframe as 'all' | 'last_week' | 'last_month' | 'last_year'
      : 'all';
    
    searchPapers({
      query: searchQuery,
      sortBy,
      sortOrder,
      maxResults: 10,
      start: 0,
      categories: categoriesArray,
      timeframe: timeframe
    });
  };

  const handleRetry = () => {
    retrySearch();
  };

  const handleDeepReadClick = (paper: ArxivPaper) => {
    if (onPaperSelectedForDeepRead) {
      onPaperSelectedForDeepRead(paper);
    } else {
      // Lógica por defecto si no se proporciona la prop (ej. si ArxivSearch se usa en otro lugar)
      // Esto podría implicar llamar a una función de useChatSessions directamente
      console.log("DeepRead it clicked for paper:", paper.title);
      // Aquí llamarías a la función para crear un nuevo chat y procesar el paper
      // Ejemplo: handleNewChatWithArxivPaper(paper);
      if (handleNewChatWithArxivPaper) {
        handleNewChatWithArxivPaper(paper);
      }
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="space-y-4 p-4 border rounded-lg shadow-sm bg-card">
        <div>
          <Label htmlFor="search-query" className="text-base font-medium">Search ArXiv</Label>
          <div className="relative mt-1">
            <Input
              id="search-query"
              placeholder="Search AI papers (e.g., transformers, diffusion models)..."
              className="pl-10 pr-4 py-2 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        
        {/* Filtros adicionales - Solo Categoría y Período */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="category" className="text-sm font-medium">Category</Label>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger id="category" className="h-10 text-sm mt-1">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="timeframe" className="text-sm font-medium">Timeframe</Label>
            <Select
              value={selectedTimeframe}
              onValueChange={setSelectedTimeframe}
            >
              <SelectTrigger id="timeframe" className="h-10 text-sm mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {timeframeOptions.map(option => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Button type="submit" size="lg" className="w-full text-base flex items-center gap-2 justify-center" disabled={loading}>
          {loading ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              <span>Search Papers</span>
            </>
          )}
        </Button>
      </form>

      {loading && (
        <div className="py-12">
          <LoadingState message="Searching ArXiv..." />
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error en la búsqueda</AlertTitle>
          <AlertDescription className="mb-2">There was an error. Please try again.</AlertDescription>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 flex items-center" 
            onClick={handleRetry}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar búsqueda
          </Button>
        </Alert>
      )}
      
      {papers.length > 0 && !error && !loading && (
        <ArxivPaperList 
          papers={papers}
          totalResults={totalResults}
          currentPage={currentPage}
          maxResults={maxResults}
          loading={loading}
          onNextPage={goToNextPage}
          onPreviousPage={goToPreviousPage}
          onDeepReadPaper={handleDeepReadClick} // Pasar la nueva función de manejo
        />
      )}

      {papers.length === 0 && !error && lastSearchQuery && !loading && (
        <div className="text-center p-8 border rounded-lg bg-card mt-4">
          <p className="text-muted-foreground">No results found for "<span className="font-medium">{lastSearchQuery}</span>"</p>
          <p className="text-sm text-muted-foreground mt-2">Try different search terms</p>
        </div>
      )}

      {!papers.length && !error && !lastSearchQuery && !loading && (
        <div className="text-center p-8 border rounded-lg bg-muted/30 mt-4">
          <p className="font-medium">Enter a search term to find scientific papers</p>
          <p className="text-sm text-muted-foreground mt-2">Search for topics like "transformers", "deep learning", etc.</p>
        </div>
      )}
    </div>
  );
};

export default ArxivSearch;
