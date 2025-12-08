// app/editor/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { PageWithChrome } from '@/components/PageWithChrome';

export default function EditorPage() {
  const [inputText, setInputText] = useState('I kno whom I am not some joke who doent know the answer to the quiz what is hydrophobia yes');
  const [selectedLevel, setSelectedLevel] = useState('proofread');
  const [customInstruction, setCustomInstruction] = useState('');
  const [result, setResult] = useState('Result will appear here...');
  const [wordCount, setWordCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Update word count
  useEffect(() => {
    const words = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
    setWordCount(words);
  }, [inputText]);

  const handleEdit = async () => {
    setIsProcessing(true);
    
    // 🔐 In the future, this will call /api/edit securely
    // For now, mock it
    setTimeout(() => {
      let edited = inputText;
      if (selectedLevel === 'proofread') {
        edited = inputText
          .replace(/knо/gi, 'know')
          .replace(/doent/gi, 'doesn’t')
          .replace(/whom/g, 'who');
      } else if (selectedLevel === 'rewrite') {
        edited = 'I know who I am. I’m not some joke who doesn’t know the answer to the quiz: What is hydrophobia? Yes.';
      } else if (selectedLevel === 'formal') {
        edited = 'I am fully aware of my identity and capabilities. I am not an individual lacking knowledge regarding the answer to the quiz question concerning hydrophobia. Indeed, I possess the correct answer.';
      }
      setResult(edited);
      setIsProcessing(false);
    }, 800);
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    alert('Copied!');
  };

  return (
    <PageWithChrome>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Original Text */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold">Before Publishing — Editorial Board</h1>
              <span className="text-sm text-gray-500">{wordCount} words</span>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your text here..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-vertical min-h-[120px] font-sans"
            />
          </div>

          {/* Editing Level */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Editing Level</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {[
                { id: 'proofread', title: 'Proofread', desc: 'Spelling/grammar with tracked changes' },
                { id: 'rewrite', title: 'Rewrite', desc: 'Improve clarity & flow' },
                { id: 'formal', title: 'Formal', desc: 'Professional tone' }
              ].map((level) => (
                <div
                  key={level.id}
                  onClick={() => setSelectedLevel(level.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedLevel === level.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <h3 className="font-medium">{level.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{level.desc}</p>
                </div>
              ))}
            </div>

            <input
              type="text"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Enter custom instruction..."
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <button
              onClick={handleEdit}
              disabled={isProcessing}
              className={`w-full py-3 px-4 rounded-lg font-semibold ${
                isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isProcessing ? 'Applying Edit...' : '✨ Apply Edit'}
            </button>
          </div>

          {/* Result */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Edited Result</h2>
              <div className="flex gap-2">
                <button
                  onClick={copyResult}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  📋 Copy
                </button>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg min-h-[100px] whitespace-pre-wrap">
              {result}
            </div>
          </div>
        </div>
      </div>
    </PageWithChrome>
  );
}