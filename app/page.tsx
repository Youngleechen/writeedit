// app/editor/page.tsx — The Magical Landing Page (Refreshed ✨)

'use client';

import { useState } from 'react';
import { PageWithChrome } from '@/components/PageWithChrome';

export default function EditorLanding() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const tools = [
    {
      id: 'editor',
      title: 'AI Editor',
      emoji: '✨',
      description: 'Polish your book with AI — proofread, rewrite, or formalize.',
      link: '/editor/ai',
      comingSoon: false,
    },
    {
      id: 'write',
      title: 'Write Studio',
      emoji: '📖',
      description: 'Your main writing space — with history, versions, and AI sparks.',
      link: '/write',
      comingSoon: false,
    },
    {
      id: 'portfolio',
      title: 'Portfolio',
      emoji: '🖼️',
      description: 'Showcase your published work, novels, and creative projects.',
      link: '/portfolio',
      comingSoon: false,
    },
    {
      id: 'blog',
      title: 'Blog',
      emoji: '✍️',
      description: 'Draft, edit, and publish articles or journal entries.',
      link: '/blog',
      comingSoon: false,
    },
    {
      id: 'image-analysis',
      title: 'Image Analysis',
      emoji: '👁️',
      description: 'Upload images to extract text, analyze content, or generate ideas.',
      link: '/image-analysis',
      comingSoon: true,
    },
  ];

  return (
    <PageWithChrome>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Before Publishing
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
              Polish your work with these writing and editing tools — before it goes live.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {tools.map((tool) => (
              <div
                key={tool.id}
                onMouseEnter={() => setHoveredCard(tool.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`
                  group relative p-7 rounded-2xl border-2 border-blue-500
                  transition-all duration-300 ease-out cursor-pointer
                  bg-white
                  ${tool.comingSoon ? 'opacity-90' : ''}
                  ${
                    hoveredCard === tool.id
                      ? 'bg-pink-50 shadow-lg shadow-blue-100'
                      : 'hover:bg-pink-25 hover:shadow-md'
                  }
                `}
                onClick={() => {
                  if (!tool.comingSoon) {
                    window.location.href = tool.link;
                  }
                }}
                style={{ backgroundColor: hoveredCard === tool.id ? '#fdf2f8' : '#ffffff' }}
              >
                {/* Coming Soon Badge */}
                {tool.comingSoon && (
                  <div className="absolute top-4 right-4 z-10">
                    <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                      Coming Soon
                    </span>
                  </div>
                )}

                {/* Icon + Title */}
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-3xl drop-shadow-sm">{tool.emoji}</span>
                  <h2 className="text-xl font-bold text-gray-900">{tool.title}</h2>
                </div>

                {/* Description */}
                <p className="text-gray-700 leading-relaxed text-sm pr-2">
                  {tool.description}
                </p>

                {/* Animated arrow (only for active tools) */}
                {!tool.comingSoon && (
                  <div className="mt-5 flex justify-end">
                    <span className="flex items-center text-sm font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      Go to {tool.title}
                      <svg
                        className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        ></path>
                      </svg>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageWithChrome>
  );
}