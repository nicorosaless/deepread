
import React from 'react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface LoadingStateProps {
  message?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Processing paper...' }) => {
  return (
    <Card className="w-full p-6 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-16 h-16 relative">
          <div className="w-full h-full border-4 border-gray-200 rounded-full"></div>
          <div className="w-full h-full border-4 border-t-paper border-r-transparent border-b-transparent border-l-transparent rounded-full absolute top-0 left-0 animate-spin"></div>
        </div>
        <div className="flex flex-col items-center">
          <h3 className="text-xl font-medium">{message}</h3>
          <p className="text-gray-500 text-sm mt-1">This may take a moment</p>
        </div>
        
        <div className="w-full max-w-md space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Extracting text</span>
            <span className="text-sm text-paper">Complete</span>
          </div>
          <Separator className="bg-paper" />
          
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Analyzing content</span>
            <span className="text-sm text-paper animate-pulse-subtle">In progress</span>
          </div>
          <Separator className="bg-gray-200" />
          
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Generating suggestions</span>
            <span className="text-sm text-gray-400">Pending</span>
          </div>
          <Separator className="bg-gray-200" />
        </div>
      </div>
    </Card>
  );
};

export default LoadingState;
