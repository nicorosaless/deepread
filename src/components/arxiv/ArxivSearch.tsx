
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
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Search } from 'lucide-react';
import { useArxivSearch } from '@/components/arxiv/useArxivSearch';
import ArxivPaperList from '@/components/arxiv/ArxivPaperList';

const ArxivSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'lastUpdatedDate' | 'submittedDate'>('lastUpdatedDate');
  const [sortOrder, setSortOrder] = useState<'ascending' | 'descending'>('descending');
  
  const { 
    papers, 
    loading, 
    error, 
    totalResults,
    currentPage,
    maxResults,
    searchPapers,
    goToNextPage,
    goToPreviousPage
  } = useArxivSearch();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchPapers({
      query: searchQuery,
      sortBy,
      sortOrder,
      maxResults: 10,
      start: 0
    });
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>arXiv AI Papers Search</SidebarGroupLabel>
        <SidebarGroupContent>
          <form onSubmit={handleSearch} className="space-y-3">
            <div>
              <Label htmlFor="search-query" className="sr-only">Search</Label>
              <div className="relative">
                <Input
                  id="search-query"
                  placeholder="Search AI papers..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-sidebar-foreground/50" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="sort-by" className="text-xs">Sort By</Label>
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as any)}
                >
                  <SelectTrigger id="sort-by" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="lastUpdatedDate">Last Updated</SelectItem>
                      <SelectItem value="submittedDate">Submitted Date</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="sort-order" className="text-xs">Order</Label>
                <Select
                  value={sortOrder}
                  onValueChange={(value) => setSortOrder(value as any)}
                >
                  <SelectTrigger id="sort-order" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="descending">Newest First</SelectItem>
                      <SelectItem value="ascending">Oldest First</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button type="submit" variant="outline" size="sm" className="w-full" disabled={loading}>
              {loading ? "Searching..." : "Search Papers"}
            </Button>
          </form>

          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          
          {papers.length > 0 && (
            <ArxivPaperList 
              papers={papers}
              totalResults={totalResults}
              currentPage={currentPage}
              maxResults={maxResults}
              loading={loading}
              onNextPage={goToNextPage}
              onPreviousPage={goToPreviousPage}
            />
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
};

export default ArxivSearch;
