
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';

interface PaperSummaryProps {
  title: string;
  summary: string;
  authors?: string[];
  date?: string;
}

const PaperSummary: React.FC<PaperSummaryProps> = ({
  title,
  summary,
  authors,
  date
}) => {
  return (
    <Card className="w-full border border-warm-200 shadow-sm">
      <CardHeader className="bg-warm-100 border-b border-warm-200 rounded-t-lg">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-warm-700" />
          <CardTitle className="text-warm-800 text-xl">Paper Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6 bg-white">
        <h3 className="text-xl font-sans font-semibold mb-3 text-warm-900">{title}</h3>
        
        {(authors && authors.length > 0) && (
          <p className="text-sm text-warm-600 mb-4">
            By: {authors.join(', ')}
            {date && ` (${date})`}
          </p>
        )}
        
        <div className="my-4">
          <h4 className="font-medium text-warm-800 mb-3">Summary</h4>
          <p className="text-warm-700 leading-relaxed whitespace-pre-line">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaperSummary;
