'use client';

import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { diff } from 'diff';

export function ResultsViewer({ 
  originalText, 
  processedText 
}: { 
  originalText: string; 
  processedText: string;
}) {
  const [view, setView] = useState<'clean' | 'tracked'>('clean');
  const [changesSummary, setChangesSummary] = useState('');

  // Calculate changes summary
  useEffect(() => {
    if (originalText !== processedText) {
      const diffs = diff.diffWords(originalText, processedText);
      const additions = diffs.filter(d => d.added).length;
      const deletions = diffs.filter(d => d.removed).length;
      setChangesSummary(`${additions} additions, ${deletions} deletions`);
    } else {
      setChangesSummary('No changes made');
    }
  }, [originalText, processedText]);

  const renderCleanView = () => (
    <div className="p-4 whitespace-pre-wrap leading-relaxed">
      {processedText}
    </div>
  );

  const renderTrackedView = () => {
    const diffs = diff.diffWords(originalText, processedText);
    
    return (
      <div className="p-4">
        {diffs.map((part, index) => {
          if (part.added) {
            return (
              <span key={index} className="bg-green-100 text-green-800">
                {part.value}
              </span>
            );
          } else if (part.removed) {
            return (
              <span key={index} className="line-through bg-red-100 text-red-800">
                {part.value}
              </span>
            );
          } else {
            return <span key={index}>{part.value}</span>;
          }
        })}
      </div>
    );
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Edited Result</h2>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm">💾 Save Progress</Button>
          <Button variant="ghost" size="sm">📋 Copy</Button>
          <Button variant="ghost" size="sm">📥 .docx</Button>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-4 p-2 bg-gray-50 rounded">
        <div className="flex space-x-1">
          <Button
            onClick={() => setView('clean')}
            variant={view === 'clean' ? 'primary' : 'ghost'}
            size="sm"
          >
            Clean
          </Button>
          <Button
            onClick={() => setView('tracked')}
            variant={view === 'tracked' ? 'primary' : 'ghost'}
            size="sm"
          >
            Tracked
          </Button>
        </div>
        <div className="text-sm text-gray-600">{changesSummary}</div>
      </div>
      
      {view === 'clean' ? renderCleanView() : renderTrackedView()}
    </Card>
  );
}