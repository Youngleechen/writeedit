// app/properties/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function RealEstatePage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch user and properties on mount
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id;
      setUserId(uid || null);
      setIsAdmin(uid ? true : false); // In real app: check role via claims

      if (uid) {
        // Fetch all property listings (blog posts with real-estate-like titles)
        const { data, error } = await supabase
          .from('blog_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error) {
          // Filter only "property-like" entries (you can add a tag later)
          const estates = (data || []).filter(post =>
            post.title.toLowerCase().includes('estate') ||
            post.title.toLowerCase().includes('villa') ||
            post.title.toLowerCase().includes('luxury') ||
            post.title.toLowerCase().includes('property')
          );
          setProperties(estates);
        }
      } else {
        // Fetch public listings only
        const { data, error } = await supabase
          .from('blog_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error) {
          setProperties(data || []);
        }
      }

      setLoading(false);
    };

    init();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '-')}`;
      const filePath = `blog/${userId}/${fileName}`;
      
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      // Insert new property listing
      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: `Luxury Villa ${Math.floor(100 + Math.random() * 900)}`,
          content: 'Breathtaking ocean views, infinity pool, smart home, private chef kitchen, and 24/7 concierge. Your dream estate awaits.',
          image_url: imageUrl,
          published: true,
        });

      if (insertErr) throw insertErr;

      // Refresh list
      const { data: freshData } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });
      setProperties(freshData || []);
    } catch (err: any) {
      alert(`❌ Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-emerald-900 flex items-center justify-center">
        <div className="text-white text-xl">Discovering Estates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-emerald-50">
      {/* Hero Banner */}
      <div className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden">
        {properties[0]?.image_url ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${properties[0].image_url})` }}>
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h1 className="text-3xl md:text-5xl font-bold drop-shadow-lg">{properties[0].title}</h1>
              <p className="mt-2 text-lg drop-shadow">{properties[0].content.substring(0, 100)}...</p>
              <button className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full transition shadow-lg">
                Explore This Estate
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-700 to-teal-800 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold">Luxury Estates Await</h1>
              <p className="mt-2 text-xl">Where dreams find their address.</p>
            </div>
          </div>
        )}
      </div>

      {/* Admin Upload (Floating Button) */}
      {isAdmin && (
        <div className="fixed bottom-6 right-6 z-50">
          <label className="block bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-xl cursor-pointer transition transform hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Property Grid */}
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-center mb-12 text-slate-800">Featured Estates</h2>
        
        {properties.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No properties listed yet. {isAdmin && 'Add your first luxury estate!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map((property, idx) => (
              <div
                key={property.id}
                className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition duration-300 transform hover:-translate-y-1"
              >
                {property.image_url ? (
                  <div className="h-64 bg-cover bg-center" style={{ backgroundImage: `url(${property.image_url})` }} />
                ) : (
                  <div className="h-64 bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center justify-center">
                    <span className="text-white text-lg font-bold">No Image</span>
                  </div>
                )}
                <div className="p-5">
                  <h3 className="text-xl font-bold text-slate-800">{property.title}</h3>
                  <p className="mt-2 text-slate-600 line-clamp-3">{property.content}</p>
                  <button className="mt-4 w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-lg transition">
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Global Styles */}
      <style jsx global>{`
        body {
          margin: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}