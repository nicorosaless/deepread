import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Book } from 'lucide-react';

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
    <Card className="w-full">
      <CardHeader className="bg-paper text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Book className="h-5 w-5" />
          <CardTitle>Paper Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        
        {(authors && authors.length > 0) && (
          <p className="text-sm text-gray-600 mb-2">
            By: {authors.join(', ')}
            {date && ` (${date})`}
          </p>
        )}
        
        <div className="my-4">
          <h4 className="font-medium text-gray-800 mb-2">Summary</h4>
          <p className="text-gray-700 whitespace-pre-line">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaperSummary;
