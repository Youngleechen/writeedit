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
      link: '/editor/',
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
      link: '/images',
      comingSoon: false,
    },
    {
      id: 'book-formatting',
      title: 'Book Formatting',
      emoji: '📐',
      description:
        'Automatically format your manuscript for print, eBook, or web — clean, professional, and ready to publish.',
      link: '/book-formatting',
      comingSoon: true,
    },
  ];

  return (
    <PageWithChrome>
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(to bottom, #f9fafb, #ffffff)',
          padding: '3rem 1rem',
        }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p
              style={{
                color: '#4b5563',
                maxWidth: '42rem',
                margin: '0 auto',
                fontSize: '1.125rem',
                lineHeight: '1.75rem',
              }}
            >
              Improve your work with these writing and editing tools — before it goes live.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))',
              gap: '2rem',
            }}
          >
            {tools.map((tool) => {
              const isHovered = hoveredCard === tool.id;
              const baseBg = isHovered ? '#fdf2f8' : '#ffffff';
              const borderStyle = tool.comingSoon
                ? { opacity: 0.9 }
                : {};

              return (
                <div
                  key={tool.id}
                  onMouseEnter={() => setHoveredCard(tool.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => {
                    if (!tool.comingSoon) {
                      window.location.href = tool.link;
                    }
                  }}
                  style={{
                    position: 'relative',
                    padding: '1.75rem',
                    borderRadius: '1rem',
                    border: '2px solid #3b82f6',
                    transition: 'all 0.3s ease-out',
                    cursor: tool.comingSoon ? 'default' : 'pointer',
                    backgroundColor: baseBg,
                    boxShadow: isHovered
                      ? '0 10px 25px -5px rgba(59, 130, 246, 0.1), 0 8px 10px -6px rgba(59, 130, 246, 0.1)'
                      : 'none',
                    ...borderStyle,
                  }}
                >
                  {/* Coming Soon Badge */}
                  {tool.comingSoon && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        zIndex: 10,
                      }}
                    >
                      <span
                        style={{
                          background: 'linear-gradient(to right, #f59e0b, #ea580c)',
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        }}
                      >
                        Coming Soon
                      </span>
                    </div>
                  )}

                  {/* Icon + Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.875rem', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }}>
                      {tool.emoji}
                    </span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>{tool.title}</h2>
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      color: '#374151',
                      lineHeight: '1.625',
                      fontSize: '0.875rem',
                      paddingRight: '0.5rem',
                    }}
                  >
                    {tool.description}
                  </p>

                  {/* Animated arrow (only for active tools) */}
                  {!tool.comingSoon && (
                    <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#2563eb',
                          opacity: isHovered ? 1 : 0,
                          transition: 'opacity 0.2s',
                        }}
                      >
                        Go to {tool.title}
                        <svg
                          style={{
                            marginLeft: '0.5rem',
                            width: '1rem',
                            height: '1rem',
                            transition: 'transform 0.2s',
                            transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                          }}
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
              );
            })}
          </div>
        </div>
      </div>
    </PageWithChrome>
  );
}
