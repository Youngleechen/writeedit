'use client';

import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export function EditorialLog({ entries }: { entries: string[] }) {
  const [showLog, setShowLog] = useState(true);
  
  const copyLog = () => {
    navigator.clipboard.writeText(entries.join('\n'));
  };

  const clearLog = () => {
    // In real app, this would be handled by parent component
    console.log('Clearing log...');
  };

  if (entries.length === 0) return null;

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">🔍 Editorial Board Log</h2>
        <div className="flex space-x-2">
          <Button onClick={copyLog} variant="ghost" size="sm">
            📋 Copy Log
          </Button>
          <Button onClick={clearLog} variant="ghost" size="sm">
            Clear
          </Button>
        </div>
      </div>
      <div className="bg-gray-50 p-4 rounded font-mono text-sm overflow-auto max-h-60">
        {entries.map((entry, index) => (
          <div key={index} className="mb-1">
            {entry}
          </div>
        ))}
      </div>
    </Card>
  );
}