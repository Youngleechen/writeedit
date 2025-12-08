// app/editor/page.tsx — The Magical Landing Page

'use client';

import { useState } from 'react';
import { PageWithChrome } from '@/components/PageWithChrome';

export default function EditorLanding() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const tools = [
    {
      id: 'portfolio',
      title: 'Portfolio',
      emoji: '🖼️',
      description: 'Showcase your published work, novels, and creative projects.',
      link: '/portfolio',
    },
    {
      id: 'blog',
      title: 'Blog',
      emoji: '✍️',
      description: 'Draft, edit, and publish articles or journal entries.',
      link: '/blog',
    },
    {
      id: 'editor',
      title: 'AI Editor',
      emoji: '✨',
      description: 'Paste text and refine it with AI — proofread, rewrite, or formalize.',
      link: '/editor/ai', // We'll create this as a real editor later
    },
    {
      id: 'write',
      title: 'Write Studio',
      emoji: '📖',
      description: 'Your main writing space — with history, versions, and AI sparks.',
      link: '/write',
    },
    {
      id: 'image-analysis',
      title: 'Image Analysis',
      emoji: '👁️',
      description: 'Upload images to extract text, analyze content, or generate ideas.',
      link: '/image-analysis',
    },
  ];

  return (
    <PageWithChrome>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-800">Before Publishing</h1>
            <div className="flex gap-4 text-sm text-gray-600">
              {tools.map((tool) => (
                <a
                  key={tool.id}
                  href={tool.link}
                  className="hover:text-blue-600 transition-colors"
                >
                  {tool.title}
                </a>
              ))}
            </div>
          </div>

          {/* Tool Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <div
                key={tool.id}
                onMouseEnter={() => setHoveredCard(tool.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`group relative p-6 rounded-xl border transition-all duration-300 cursor-pointer ${
                  hoveredCard === tool.id
                    ? 'border-blue-500 bg-blue-50 shadow-lg transform -translate-y-1'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => window.location.href = tool.link}
              >
                {/* Emoji + Title */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{tool.emoji}</span>
                  <h2 className="text-xl font-semibold text-gray-800">{tool.title}</h2>
                </div>

                {/* Description */}
                <p className="text-gray-600 leading-relaxed">{tool.description}</p>

                {/* Arrow indicator */}
                <div className="mt-4 flex justify-end">
                  <span className={`text-sm font-medium transition-opacity ${
                    hoveredCard === tool.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    → Go to {tool.title}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Note */}
          <div className="mt-12 text-center text-gray-500 text-sm">
            Use these tools to polish, publish, and perfect your work — before it goes live.
          </div>
        </div>
      </div>
    </PageWithChrome>
  );
}