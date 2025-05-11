import React from 'react';
import ArxivSearch from '@/components/arxiv/ArxivSearch';
import Header from '@/components/Header'; // Assuming you have a Header component

const ArxivSearchPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header /> {/* Optional: Add a consistent header */}
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold mb-6">Search ArXiv Papers</h1>
          <ArxivSearch />
        </div>
      </main>
      {/* Optional: Add a consistent footer */}
    </div>
  );
};

export default ArxivSearchPage;
