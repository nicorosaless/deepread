import { ArxivPaper, ArxivSearchParams } from './types';
import { v4 as uuidv4 } from 'uuid';

// ArXiv API base URL
const ARXIV_API_URL = 'https://export.arxiv.org/api/query';

/**
 * Procesador simple para extraer información del XML sin dependencias complejas
 */
const extractFromXml = (xml: string, tag: string): string[] => {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'gs');
  const matches = [...xml.matchAll(regex)];
  return matches.map(match => match[1].trim());
};

const extractWithNamespace = (xml: string, namespace: string, tag: string): string[] => {
  const regex = new RegExp(`<${namespace}:${tag}[^>]*>(.*?)<\/${namespace}:${tag}>`, 'gs');
  const matches = [...xml.matchAll(regex)];
  return matches.map(match => match[1].trim());
};

const extractAttribute = (xml: string, tag: string, attribute: string): string[] => {
  const regex = new RegExp(`<${tag}[^>]*${attribute}=\"([^\"]*)\"[^>]*>`, 'gs');
  const matches = [...xml.matchAll(regex)];
  return matches.map(match => match[1]);
};

// Define default AI category codes as an array
const defaultAiCategoryCodes = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.NE', 'stat.ML'];

/**
 * Parsea la respuesta XML de ArXiv
 */
const parseArxivResponse = (xmlText: string): ArxivPaper[] => {
  try {
    // Extraer cada entrada (paper)
    const entries: string[] = [];
    let entryMatch;
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    
    while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
      entries.push(entryMatch[0]);
    }
    
    if (entries.length === 0) {
      console.warn('No se encontraron entradas en la respuesta de ArXiv');
      return [];
    }
    
    return entries.map(entryXml => {
      try {
        // Extraer ID
        const ids = extractFromXml(entryXml, 'id');
        const id = ids.length > 0 ? ids[0] : '';
        const arxivIdMatch = id.match(/([^\/]+)(v[0-9]+)?$/);
        const arxivId = arxivIdMatch ? arxivIdMatch[1] : id;
        
        // Extraer título y limpiar formato
        const titles = extractFromXml(entryXml, 'title');
        const title = titles.length > 0 
          ? titles[0].replace(/\s+/g, ' ').trim() 
          : 'Sin título';
        
        // Extraer resumen
        const summaries = extractFromXml(entryXml, 'summary');
        const summary = summaries.length > 0 
          ? summaries[0].replace(/\s+/g, ' ').trim() 
          : 'Sin resumen disponible';
        
        // Extraer autores
        let authors: string[] = [];
        const authorNames = extractFromXml(entryXml, 'name');
        if (authorNames.length > 0) {
          authors = authorNames;
        } else {
          // ArXiv a veces usa <n> en lugar de <name>
          const authorNs = extractFromXml(entryXml, 'n');
          if (authorNs.length > 0) {
            authors = authorNs;
          }
        }
        
        // Extraer fechas
        const publishedDates = extractFromXml(entryXml, 'published');
        const updatedDates = extractFromXml(entryXml, 'updated');
        
        let published = new Date();
        let updated = new Date();
        
        try {
          if (publishedDates.length > 0) published = new Date(publishedDates[0]);
          if (updatedDates.length > 0) updated = new Date(updatedDates[0]);
        } catch (e) {
          console.warn('Error al procesar fechas:', e);
        }
        
        // Extraer categorías
        const categories = extractAttribute(entryXml, 'category', 'term');
        
        // Extraer links
        const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
        const htmlUrl = `https://arxiv.org/abs/${arxivId}`;
        
        // Extraer journal reference y DOI
        const journalRefs = extractWithNamespace(entryXml, 'arxiv', 'journal_ref');
        const dois = extractWithNamespace(entryXml, 'arxiv', 'doi');
        
        const journalReference = journalRefs.length > 0 ? journalRefs[0] : undefined;
        const doi = dois.length > 0 ? dois[0] : undefined;
        
        return {
          id: uuidv4(),
          title,
          authors,
          summary,
          published,
          updated,
          categories,
          doi,
          journalReference,
          pdfUrl,
          htmlUrl
        };
      } catch (error) {
        console.error('Error al analizar entrada de arXiv:', error);
        return null;
      }
    }).filter(Boolean) as ArxivPaper[];
    
  } catch (error) {
    console.error('Error al analizar la respuesta XML de arXiv:', error);
    return [];
  }
};

/**
 * Función principal para buscar papers en arXiv
 */
export const searchArxivPapers = async (params: ArxivSearchParams): Promise<{
  papers: ArxivPaper[];
  totalResults: number;
}> => {
  try {
    // 1. Construir la parte de la categoría de la consulta
    let categoryQueryPart = '';
    if (params.categories && params.categories.length > 0) {
      categoryQueryPart = params.categories.map(cat => `cat:${cat}`).join(' OR ');
    } else {
      // Usar el conjunto de categorías de IA predeterminado
      categoryQueryPart = defaultAiCategoryCodes.map(cat => `cat:${cat}`).join(' OR ');
    }

    // 2. Preparar la consulta de texto (si existe)
    const textQueryPart = params.query && params.query.trim()
      ? params.query.trim().replace(/[:\"]/g, ' ').replace(/\s+/g, ' ').trim()
      : null;

    let finalSearchQuery = '';

    // 3. Combinar consulta de texto y categorías
    if (textQueryPart) {
      if (categoryQueryPart) {
        // Si hay consulta de texto Y categorías, combinarlas con AND
        // Envolver la consulta de texto y la de categorías en paréntesis para asegurar la precedencia
        finalSearchQuery = `(${textQueryPart}) AND (${categoryQueryPart})`;
      } else {
        // Solo consulta de texto (poco probable si hay categorías por defecto, pero por si acaso)
        finalSearchQuery = textQueryPart;
      }
    } else if (categoryQueryPart) {
      // Solo consulta de categorías (sin consulta de texto)
      finalSearchQuery = categoryQueryPart;
    } else {
      // Ni consulta de texto ni categorías (no debería ocurrir con categorías por defecto)
      // Podríamos poner un valor por defecto como 'all:electron' o dejarlo vacío si la API lo maneja
      console.warn('ArXiv search initiated with no text query and no categories.');
      finalSearchQuery = 'all:computer science'; // Un fallback genérico si todo lo demás está vacío
    }
    
    // 4. Añadir filtro de timeframe si se ha especificado
    if (params.timeframe && params.timeframe !== 'all') {
      const todayForEndDate = new Date(); // Fecha actual para el final del rango
      const startDate = new Date();     // Fecha de inicio, se modificará según el timeframe

      switch (params.timeframe) {
        case 'last_week':
          startDate.setDate(todayForEndDate.getDate() - 7);
          break;
        case 'last_month':
          startDate.setMonth(todayForEndDate.getMonth() - 1);
          break;
        case 'last_year':
          startDate.setFullYear(todayForEndDate.getFullYear() - 1);
          break;
      }

      const formattedStartDate = formatDate(startDate); // formatDate produce YYYYMMDD
      const formattedEndDate = formatDate(todayForEndDate); // Fecha actual formateada

      // Construir el filtro de fecha como un rango cerrado
      const dateFilter = `submittedDate:[${formattedStartDate} TO ${formattedEndDate}]`;
      
      if (finalSearchQuery) {
        // Envolver la consulta existente y el filtro de fecha en paréntesis
        finalSearchQuery = `(${finalSearchQuery}) AND (${dateFilter})`;
      } else {
        // Si no había otra consulta (poco probable), el filtro de fecha es la consulta
        finalSearchQuery = dateFilter;
      }
    }
    
    // Asegurarse de que finalSearchQuery no esté vacío antes de hacer la llamada
    if (!finalSearchQuery) {
      console.error('ArXiv search query is empty. Aborting search.');
      return { papers: [], totalResults: 0 };
    }

    // Mapear parámetros de ordenación
    const sortMap: Record<string, string> = {
      relevance: 'relevance',
      lastUpdatedDate: 'lastUpdatedDate',
      submittedDate: 'submittedDate'
    };
    
    const orderMap: Record<string, string> = {
      ascending: 'ascending',
      descending: 'descending'
    };
    
    // Construir URL manualmente con codificación correcta
    let url = `${ARXIV_API_URL}?search_query=${encodeURIComponent(finalSearchQuery)}`;
    url += `&sortBy=${encodeURIComponent(sortMap[params.sortBy] || 'lastUpdatedDate')}`; // Mantener fallback
    url += `&sortOrder=${encodeURIComponent(orderMap[params.sortOrder] || 'descending')}`; // Mantener fallback
    url += `&max_results=${encodeURIComponent(params.maxResults.toString())}`;
    url += `&start=${encodeURIComponent(params.start.toString())}`;
    
    console.log('URL de solicitud a ArXiv:', url);
    
    // Usar fetch nativo en lugar de axios para evitar problemas con User-Agent
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/xml'
        // No incluimos User-Agent porque el navegador lo rechaza
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Error en el API de ArXiv: ${response.status} ${response.statusText}`);
    }
    
    const xmlText = await response.text();
    
    if (!xmlText || xmlText.trim() === '') {
      throw new Error('Respuesta vacía del API de ArXiv');
    }
    
    console.log("Primeros 200 caracteres de XML:", xmlText.substring(0, 200));
    
    // Extraer el total de resultados
    const totalResultsMatch = xmlText.match(/<opensearch:totalResults[^>]*>([0-9]+)<\/opensearch:totalResults>/);
    const totalResults = totalResultsMatch ? parseInt(totalResultsMatch[1], 10) : 0;
    
    // Parsear la respuesta XML para obtener los papers
    const papers = parseArxivResponse(xmlText);
    
    console.log(`Encontrados ${papers.length} papers de ${totalResults} resultados totales`);
    
    return {
      papers,
      totalResults: totalResults || papers.length
    };
    
  } catch (error) {
    console.error('Error al buscar papers de arXiv:', error);
    throw error;
  }
};

// Función para formatear la fecha para la API de arXiv (YYYYMMDD)
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Helper function to get the main AI categories in arXiv
export const getArxivAICategories = (): { id: string, name: string }[] => [
  { id: 'cs.AI', name: 'Inteligencia Artificial' },
  { id: 'cs.LG', name: 'Aprendizaje Automático' },
  { id: 'cs.CL', name: 'Procesamiento del Lenguaje Natural' },
  { id: 'cs.CV', name: 'Visión por Computador' },
  { id: 'cs.NE', name: 'Computación Neuronal y Evolutiva' },
  { id: 'cs.RO', name: 'Robótica' },
  { id: 'stat.ML', name: 'Estadística - Aprendizaje Automático' }
];

// Opciones para el filtro de timeframe
export const getTimeframeOptions = (): { id: string, name: string }[] => [
  { id: 'all', name: 'Cualquier fecha' },
  { id: 'last_week', name: 'Última semana' },
  { id: 'last_month', name: 'Último mes' },
  { id: 'last_year', name: 'Último año' },
];
