import React from 'react';
import { Card } from '@/components/ui/card';
import Loader from '@/components/ui/Loader'; // Import the new Loader

interface LoadingStateProps {
  message?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Processing...' }) => {
  return (
    <Card className="w-full p-6 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader /> 
        <div className="flex flex-col items-center">
          <h3 className="text-xl font-medium">{message}</h3>
          <p className="text-gray-500 text-sm mt-1">Please wait a moment.</p>
        </div>
      </div>
    </Card>
  );
};

export default LoadingState;
