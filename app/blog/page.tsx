'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, getCurrentUserId } from '@/lib/supabase';

// Types
interface BlogPost {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  published: boolean;
  user_id: string;
  created_at: string;
}

const formatContent = (content: string): string => {
  if (!content) return '';
  return content
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .filter(p => p.trim())
    .map(p => `<p>${p.replace(/\n/g, ' ')}</p>`)
    .join('');
};

const escapeText = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export default function BlogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = searchParams.get('post');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishedPosts, setPublishedPosts] = useState<BlogPost[]>([]);
  const [draftPosts, setDraftPosts] = useState<BlogPost[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [singlePost, setSinglePost] = useState<BlogPost | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ type: 'info' | 'success' | 'error'; msg: string } | null>(null);
  const [aiGenerated, setAiGenerated] = useState<{ title: string; content: string } | null>(null);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const userId = await getCurrentUserId();
      setCurrentUser(userId);
    };
    fetchUser();
  }, []);

  // Fetch posts
  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch published posts
        const {  data: pubData, error: pubError } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('published', true)
          .order('created_at', { ascending: false });

        if (pubError) throw pubError;
        setPublishedPosts(pubData || []);

        // Fetch drafts if logged in
        if (currentUser) {
          const {  data: draftData, error: draftError } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('user_id', currentUser)
            .eq('published', false)
            .order('created_at', { ascending: false });

          if (draftError) throw draftError;
          setDraftPosts(draftData || []);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to load blog posts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, [currentUser]);

  // Load single post
  useEffect(() => {
    if (!postId) {
      setSinglePost(null);
      return;
    }

    const loadPost = async () => {
      const {  data: postData, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error || !postData) {
        setError('Post not found');
        router.push('/blog');
        return;
      }

      setSinglePost(postData);
    };

    loadPost();
  }, [postId, router]);

  // Upload image
  const uploadImage = async (file: File): Promise<string> => {
    if (!currentUser) throw new Error('Not authenticated');

    const fileName = `${currentUser}_${Date.now()}_${file.name}`;
    const filePath = `blog/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('blog-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Delete post
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post permanently?')) return;

    try {
      // Fetch image URL first
      const {  data: postData, error: fetchError } = await supabase
        .from('blog_posts')
        .select('image_url')
        .eq('id', id)
        .eq('user_id', currentUser)
        .single();

      if (fetchError || !postData) {
        alert('Post not found or access denied');
        return;
      }

      // Delete from DB
      const { error: deleteError } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Clean up image
      if (postData.image_url) {
        const filename = postData.image_url.split('/').pop();
        if (filename) {
          await supabase.storage.from('blog-images').remove([`blog/${filename}`]);
        }
      }

      router.refresh();
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  // AI Generation
  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      setAiStatus({ type: 'error', msg: 'Please enter a topic or prompt.' });
      return;
    }

    setIsGenerating(true);
    setAiStatus({ type: 'info', msg: 'Generating your blog post...' });

    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: aiPrompt,
          model: 'x-ai/grok-4.1-fast:free',
          editLevel: 'generate',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const { generatedPost } = await res.json();
      if (!generatedPost?.title || !generatedPost?.content) {
        throw new Error('Invalid AI response format');
      }

      const clean = {
        title: generatedPost.title.trim(),
        content: generatedPost.content.trim(),
      };

      setAiGenerated(clean);
      setAiStatus({ type: 'success', msg: '✅ Generation successful! Review below.' });
    } catch (err) {
      setAiStatus({ type: 'error', msg: `❌ ${(err as Error).message}` });
    } finally {
      setIsGenerating(false);
    }
  };

  // --- RENDERING ---

  if (singlePost) {
    const formattedDate = new Date(singlePost.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <button
          onClick={() => router.push('/blog')}
          className="inline-block mb-6 text-blue-600 font-medium hover:underline"
        >
          ← Back to Blog
        </button>
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 border border-gray-200">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            {escapeText(singlePost.title)}
          </h1>
          <div className="text-gray-500 text-sm mb-6">{formattedDate}</div>
          {singlePost.image_url && (
            <img
              src={singlePost.image_url}
              alt=""
              className="w-full h-64 sm:h-80 object-cover rounded-xl mb-6"
            />
          )}
          <div
            className="text-gray-800 leading-relaxed text-sm sm:text-base"
            dangerouslySetInnerHTML={{ __html: formatContent(singlePost.content) }}
          />
          {currentUser === singlePost.user_id && (
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => alert('Edit form would open here')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => handleDelete(singlePost.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium"
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading blog...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Drafts */}
        {currentUser && (
          <div className="mb-10 p-5 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-900">Your Drafts</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setIsAiModalOpen(true)}
                  className="flex-1 sm:flex-none px-3 py-2 bg-purple-600 text-white text-sm rounded-lg font-medium flex items-center justify-center gap-1.5"
                >
                  ✨ Generate with AI
                </button>
                <button
                  onClick={() => alert('Full post form not implemented')}
                  className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium"
                >
                  + New Post
                </button>
              </div>
            </div>

            {draftPosts.length === 0 ? (
              <p className="text-center py-4 text-gray-500">✏️ No drafts yet.</p>
            ) : (
              <div className="space-y-2">
                {draftPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex justify-between items-center p-3 bg-white rounded-lg border"
                  >
                    <span
                      className="font-medium text-blue-600 cursor-pointer hover:underline flex-1"
                      onClick={() => router.push(`/blog?post=${post.id}`)}
                    >
                      {escapeText(post.title)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/blog?post=${post.id}`)}
                        className="text-xs w-8 h-8 flex items-center justify-center bg-gray-200 rounded"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="text-xs w-8 h-8 flex items-center justify-center bg-red-200 rounded"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Published Posts */}
        {publishedPosts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">📚 No published posts yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {publishedPosts.map((post) => {
              const formattedDate = new Date(post.created_at).toLocaleDateString();
              const firstPara =
                post.content.split(/\n{2,}/)[0]?.trim() ||
                post.content.substring(0, 120) + '...';

              return (
                <div
                  key={post.id}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-full h-40 sm:h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 sm:h-48 bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
                      No Image
                    </div>
                  )}
                  <div className="p-4 sm:p-5">
                    <div className="text-xs text-gray-500 mb-1">{formattedDate}</div>
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                      {escapeText(post.title)}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                      {escapeText(firstPara)}
                    </p>
                    <Link
                      href={`/blog?post=${post.id}`}
                      className="text-blue-600 text-sm font-medium hover:underline"
                    >
                      Read more →
                    </Link>
                    {currentUser === post.user_id && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => router.push(`/blog?post=${post.id}`)}
                          className="text-xs px-2 py-1 bg-gray-200 rounded"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="text-xs px-2 py-1 bg-red-200 rounded"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 relative">
            <button
              onClick={() => setIsAiModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-3">✨ Generate Blog Post with AI</h2>
            <p className="text-gray-600 text-sm mb-4">
              Be specific for better results (e.g., "Beginner's guide to sourdough bread")
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="What would you like to write about?"
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 h-24 resize-none"
            />
            <button
              onClick={generateWithAI}
              disabled={isGenerating}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium mb-4 disabled:opacity-70"
            >
              {isGenerating ? '✨ Generating...' : '🚀 Generate Blog Post'}
            </button>

            {aiStatus && (
              <div
                className={`p-3 rounded-lg mb-4 text-sm ${
                  aiStatus.type === 'error'
                    ? 'bg-red-100 text-red-800'
                    : aiStatus.type === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {aiStatus.msg}
              </div>
            )}

            {aiGenerated && (
              <div className="mt-4">
                <div className="bg-gray-50 p-4 rounded-lg mb-4 max-h-60 overflow-y-auto">
                  <h3 className="font-bold text-gray-900 mb-2">{aiGenerated.title}</h3>
                  <div className="text-gray-700 whitespace-pre-line text-sm">
                    {aiGenerated.content}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setAiGenerated(null);
                      setAiStatus(null);
                      generateWithAI();
                    }}
                    className="flex-1 py-2 border border-gray-300 rounded-lg font-medium text-sm"
                  >
                    ↺ Regenerate
                  </button>
                  <button
                    onClick={() => {
                      setIsAiModalOpen(false);
                      alert('In full app, this would open the editor with the AI content.');
                      console.log('Use this post:', aiGenerated);
                    }}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium text-sm"
                  >
                    ✅ Use This Post
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}