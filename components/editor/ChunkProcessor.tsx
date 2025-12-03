'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export function ChunkProcessor({ onCancel }: { onCancel: () => void }) {
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(1);
  const [totalChunks, setTotalChunks] = useState(5);
  const [chunkStatus, setChunkStatus] = useState<'processing' | 'done' | 'error'>('processing');

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 1;
      });
    }, 50);

    return () => clearInterval(timer);
  }, []);

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">📝 Processing Large Document</h2>
        <div className="flex space-x-2">
          <span className="text-sm">Chunk {currentChunk} of {totalChunks}</span>
          <Button onClick={onCancel} variant="secondary" size="sm">
            Cancel
          </Button>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium mb-2">Document Chunks</h3>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i}
                className={`p-2 rounded border cursor-pointer transition-colors ${
                  i === currentChunk 
                    ? 'border-blue-500 bg-blue-50' 
                    : i < currentChunk 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Chunk {i} {i === currentChunk ? '(Processing)' : i < currentChunk ? '(Done)' : ''}
              </div>
            ))}
          </div>
        </div>
        
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium mb-2">Current Chunk ({currentChunk})</h3>
          <div className="bg-gray-50 p-3 rounded min-h-[100px]">
            {chunkStatus === 'processing' && (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 rounded mb-2 w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            )}
            {chunkStatus === 'done' && (
              <div className="text-sm">
                Processed successfully. This chunk contains text about AI editing tools and their applications in professional writing.
              </div>
            )}
          </div>
          
          <div className="mt-4 p-2 bg-gray-100 rounded">
            <div className="text-xs text-gray-600">Processing time: 2.3s</div>
          </div>
        </div>
      </div>
    </Card>
  );
}