'use client';

import { useState, useRef, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ModelSelector } from '../ui/ModelSelector';
import { ChunkProcessor } from './ChunkProcessor';
import { ResultsViewer } from './ResultsViewer';
import { EditorialLog } from './EditorialLog';
import { countWords } from '@/lib/utils';
import toast from 'react-hot-toast';

export function EditorContainer() {
  const [inputText, setInputText] = useState(`I kno whom I am not some joke who doent know the answer to the quiz what is hydrophobia yes`);
  const [wordCount, setWordCount] = useState(0);
  const [editLevel, setEditLevel] = useState<'proofread' | 'rewrite' | 'formal'>('proofread');
  const [customInstruction, setCustomInstruction] = useState('');
  const [useEditorialBoard, setUseEditorialBoard] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedText, setProcessedText] = useState('');
  const [editorialLog, setEditorialLog] = useState<string[]>([]);
  const [isLargeDocument, setIsLargeDocument] = useState(false);
  const processingController = useRef<AbortController | null>(null);

  useEffect(() => {
    setWordCount(countWords(inputText));
    setIsLargeDocument(wordCount > 500);
  }, [inputText]);

  const handleProcess = async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text to edit');
      return;
    }

    setIsProcessing(true);
    processingController.current = new AbortController();
    setEditorialLog([]);
    
    try {
      // In real implementation, this would call an API route
      // For demo, we'll simulate the response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      let processed = inputText
        .replace(/kno/g, 'know')
        .replace(/doent/g, "doesn't")
        .replace(/hydrophobia/g, 'hydrophobia (fear of water)');
      
      if (editLevel === 'formal') {
        processed = processed.replace(/I am not some joke/, 'I am a credible source');
      }
      
      if (customInstruction) {
        processed += `\n\n[Custom instruction applied: ${customInstruction}]`;
      }
      
      if (useEditorialBoard) {
        setEditorialLog([
          'Editorial Board member 1: Suggested adding definition for hydrophobia',
          'Editorial Board member 2: Approved formal tone adjustment',
          '✅ Approved by AI Editorial Board'
        ]);
        processed += '\n\n✅ Approved by AI Editorial Board';
      }
      
      setProcessedText(processed);
      toast.success('Document processed successfully!');
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Failed to process document. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    processingController.current?.abort();
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Original Text</h2>
          <span className="text-sm text-gray-500">{wordCount} words</span>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your text here..."
          className="w-full min-h-[150px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Editing Level</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { id: 'proofread', label: 'Proofread', description: 'Spelling/grammar with tracked changes' },
            { id: 'rewrite', label: 'Rewrite', description: 'Improve clarity & flow' },
            { id: 'formal', label: 'Formal', description: 'Professional tone' },
          ].map((level) => (
            <div
              key={level.id}
              onClick={() => setEditLevel(level.id as any)}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                editLevel === level.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <h3 className="font-medium mb-1">{level.label}</h3>
              <p className="text-sm text-gray-600">{level.description}</p>
            </div>
          ))}
        </div>

        <input
          type="text"
          value={customInstruction}
          onChange={(e) => setCustomInstruction(e.target.value)}
          placeholder="Enter custom instruction..."
          className="w-full p-3 mb-4 border border-gray-300 rounded-lg"
        />

        <ModelSelector />

        <label className="flex items-center space-x-2 mt-4 p-3 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            checked={useEditorialBoard}
            onChange={(e) => setUseEditorialBoard(e.target.checked)}
            className="h-4 w-4 text-blue-600 rounded"
          />
          <span className="text-sm">👥 Use AI Editorial Board (live peer review)</span>
        </label>

        <Button 
          onClick={handleProcess}
          disabled={isProcessing}
          className="w-full mt-6"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            '✨ Apply Edit'
          )}
        </Button>
      </Card>

      {isLargeDocument && isProcessing && (
        <ChunkProcessor onCancel={handleCancel} />
      )}

      {processedText && (
        <ResultsViewer 
          originalText={inputText} 
          processedText={processedText} 
        />
      )}

      {editorialLog.length > 0 && (
        <EditorialLog entries={editorialLog} />
      )}
    </div>
  );
}