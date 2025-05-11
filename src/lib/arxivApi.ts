
import { ArxivPaper, ArxivSearchParams } from './types';
import { v4 as uuidv4 } from 'uuid';

// ArXiv API base URL
const ARXIV_API_URL = 'https://export.arxiv.org/api/query';

/**
 * Parse the XML response from the arXiv API
 */
const parseArxivResponse = (xmlText: string): ArxivPaper[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  const entries = Array.from(xmlDoc.getElementsByTagName('entry'));
  
  return entries.map(entry => {
    // Extract authors
    const authorNodes = entry.getElementsByTagName('author');
    const authors = Array.from(authorNodes).map(
      author => author.getElementsByTagName('name')[0]?.textContent || 'Unknown'
    );
    
    // Extract main paper details
    const id = entry.getElementsByTagName('id')[0]?.textContent || '';
    const arxivId = id.split('/').pop()?.split('v')[0] || id; // Extract just the arXiv ID
    
    const title = entry.getElementsByTagName('title')[0]?.textContent?.trim() || 'Untitled';
    const summary = entry.getElementsByTagName('summary')[0]?.textContent?.trim() || '';
    const published = new Date(entry.getElementsByTagName('published')[0]?.textContent || '');
    const updated = new Date(entry.getElementsByTagName('updated')[0]?.textContent || '');
    
    // Extract categories
    const categoryNodes = Array.from(entry.getElementsByTagName('category'));
    const categories = categoryNodes.map(
      category => category.getAttribute('term') || ''
    );
    
    // Extract links
    const linkNodes = Array.from(entry.getElementsByTagName('link'));
    const pdfLink = linkNodes.find(link => link.getAttribute('title') === 'pdf');
    const htmlLink = linkNodes.find(link => link.getAttribute('rel') === 'alternate');
    
    const pdfUrl = pdfLink?.getAttribute('href') || `https://arxiv.org/pdf/${arxivId}.pdf`;
    const htmlUrl = htmlLink?.getAttribute('href') || `https://arxiv.org/abs/${arxivId}`;
    
    // Journal reference and DOI if available
    const journalRef = entry.getElementsByTagNameNS('http://arxiv.org/schemas/atom', 'journal_ref')[0]?.textContent || undefined;
    const doiElement = entry.getElementsByTagNameNS('http://arxiv.org/schemas/atom', 'doi')[0];
    const doi = doiElement ? doiElement.textContent || undefined : undefined;
    
    return {
      id: uuidv4(),
      title,
      authors,
      summary,
      published,
      updated,
      categories,
      doi,
      journalReference: journalRef,
      pdfUrl,
      htmlUrl
    };
  });
};

/**
 * Fetch papers from the arXiv API based on search parameters
 */
export const searchArxivPapers = async (params: ArxivSearchParams): Promise<{
  papers: ArxivPaper[];
  totalResults: number;
}> => {
  try {
    // Prepare query parameters
    const aiCategory = 'cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.CV+OR+cat:cs.NE';
    let searchQuery = params.query ? `all:${params.query}+AND+${aiCategory}` : aiCategory;
    
    if (params.categories && params.categories.length > 0) {
      const categoryQuery = params.categories.map(cat => `cat:${cat}`).join('+OR+');
      searchQuery = `(${searchQuery})+AND+(${categoryQuery})`;
    }
    
    // Map sort parameters to arXiv API parameters
    const sortMap = {
      relevance: 'relevance',
      lastUpdatedDate: 'lastUpdatedDate',
      submittedDate: 'submittedDate'
    };
    
    const orderMap = {
      ascending: 'ascending',
      descending: 'descending'
    };
    
    // Construct the full URL
    const queryParams = new URLSearchParams({
      search_query: searchQuery,
      sortBy: sortMap[params.sortBy],
      sortOrder: orderMap[params.sortOrder],
      max_results: params.maxResults.toString(),
      start: params.start.toString()
    });
    
    const url = `${ARXIV_API_URL}?${queryParams.toString()}`;
    
    // Make the API request
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`ArXiv API error: ${response.status}`);
    }
    
    const xmlText = await response.text();
    
    // Extract total results count
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const totalResultsElement = xmlDoc.getElementsByTagName('opensearch:totalResults')[0];
    const totalResults = totalResultsElement ? 
      parseInt(totalResultsElement.textContent || '0', 10) : 0;
    
    // Parse the XML response to get the papers
    const papers = parseArxivResponse(xmlText);
    
    return {
      papers,
      totalResults
    };
  } catch (error) {
    console.error('Error fetching arXiv papers:', error);
    return {
      papers: [],
      totalResults: 0
    };
  }
};

// Helper function to get the main AI categories in arXiv
export const getArxivAICategories = (): { id: string, name: string }[] => [
  { id: 'cs.AI', name: 'Artificial Intelligence' },
  { id: 'cs.LG', name: 'Machine Learning' },
  { id: 'cs.CL', name: 'Computation and Language (NLP)' },
  { id: 'cs.CV', name: 'Computer Vision' },
  { id: 'cs.NE', name: 'Neural and Evolutionary Computing' },
  { id: 'cs.RO', name: 'Robotics' },
  { id: 'stat.ML', name: 'Statistics - Machine Learning' }
];
