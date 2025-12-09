// app/echoes/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Fixed sections — each is a named "entry"
const ENTRIES = [
  { id: 'glacier-iceland', title: 'Vatnajökull Ice Cave', location: 'Iceland' },
  { id: 'coral-australia', title: 'Great Barrier Reef', location: 'Australia' },
  { id: 'forest-borneo', title: 'Heart of Borneo', location: 'Malaysia' },
  { id: 'savanna-kenya', title: 'Maasai Mara Ecosystem', location: 'Kenya' },
];

type EntryData = {
  image_url: string | null;
  caption: string;
  description: string;
};

export default function EchoesOfEarthPage() {
  const [entries, setEntries] = useState<{ [key: string]: EntryData }>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // Fetch user + entry data on mount
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id;
      setUserId(uid || null);

      if (uid) {
        const { data: entriesData, error } = await supabase
          .from('blog_posts')
          .select('title, image_url, content')
          .eq('user_id', uid)
          .in('title', ENTRIES.map(e => e.title));

        if (!error) {
          const initialState: { [key: string]: EntryData } = {};
          ENTRIES.forEach((entry) => {
            const stored = entriesData.find((row: any) => row.title === entry.title);
            if (stored) {
              let caption = `${entry.title}, ${entry.location}`;
              let description = "A fragile landscape at the edge of change.";
              try {
                const content = JSON.parse(stored.content);
                caption = content.caption || caption;
                description = content.description || description;
              } catch (e) {}
              initialState[entry.id] = {
                image_url: stored.image_url || null,
                caption,
                description,
              };
            } else {
              initialState[entry.id] = {
                image_url: null,
                caption: `${entry.title}, ${entry.location}`,
                description: "A fragile landscape at the edge of change.",
              };
            }
          });
          setEntries(initialState);
        }
      }
    };
    init();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, entryId: string) => {
    if (!adminMode || !userId) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(entryId);
    setStatus(null);

    try {
      const entry = ENTRIES.find(e => e.id === entryId);
      if (!entry) throw new Error('Invalid entry');

      const filePath = `blog/${userId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      const content = JSON.stringify({
        caption: entries[entryId]?.caption || `${entry.title}, ${entry.location}`,
        description: entries[entryId]?.description || "A fragile landscape at the edge of change.",
      });

      await supabase
        .from('blog_posts')
        .delete()
        .eq('user_id', userId)
        .eq('title', entry.title);

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: entry.title,
          content,
          image_url: imageUrl,
          published: false,
        });

      if (insertErr) throw insertErr;

      setEntries(prev => ({
        ...prev,
        [entryId]: {
          ...prev[entryId],
          image_url: imageUrl,
        },
      }));

      setStatus(`✅ Updated: ${entry.title}`);
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Upload failed: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  // Minimalist, vertical, scroll-based layout — no hero, no grid
  return (
    <div className="font-serif bg-black text-white min-h-screen">
      {/* Ambient Header — subtle branding only */}
      <header className="fixed top-0 w-full p-6 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="text-sm tracking-widest opacity-70">ECH OES · OF · EARTH</div>
          {userId && (
            <button
              onClick={() => setAdminMode(!adminMode)}
              className={`w-5 h-5 rounded-full border ${
                adminMode ? 'bg-green-400 border-green-400' : 'bg-gray-600 border-gray-600'
              }`}
              title={adminMode ? 'Disable edit mode' : 'Enable edit mode'}
            />
          )}
        </div>
      </header>

      {/* Main scroll narrative */}
      <main className="pt-24 pb-32">
        {ENTRIES.map((entry) => {
          const data = entries[entry.id];
          return (
            <section
              key={entry.id}
              className="mb-48 relative"
            >
              {/* Full-bleed image — no padding, pure immersion */}
              <div className="h-screen w-full relative">
                {data?.image_url ? (
                  <img
                    src={data.image_url}
                    alt={entry.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                    <span className="text-gray-700 text-lg">No image uploaded</span>
                  </div>
                )}

                {/* Dark overlay for text contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />

                {/* Caption at bottom */}
                <div className="absolute bottom-8 left-0 w-full px-6 md:px-12 max-w-4xl mx-auto">
                  <div className="text-white/90 text-sm md:text-base tracking-wide">
                    {data?.caption || `${entry.title}, ${entry.location}`}
                  </div>
                </div>

                {/* Admin upload (floating, minimal) */}
                {userId && adminMode && (
                  <div className="absolute top-6 right-6">
                    <label className="block text-xs text-white/60 hover:text-white cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUpload(e, entry.id)}
                        disabled={uploading === entry.id}
                        className="hidden"
                      />
                      {uploading === entry.id ? '⋯' : '✎'}
                    </label>
                  </div>
                )}
              </div>

              {/* Narrative block below image */}
              <div className="px-6 md:px-12 max-w-3xl mx-auto mt-16">
                <p className="text-lg md:text-xl leading-relaxed text-gray-200 italic">
                  {data?.description || "This place is changing faster than we can document it."}
                </p>
                <div className="w-16 h-px bg-white/20 mt-8"></div>
              </div>
            </section>
          );
        })}

        {/* Closing reflection */}
        <div className="px-6 md:px-12 max-w-2xl mx-auto mt-24 text-center text-gray-400 text-sm">
          <p>
            These echoes are not just images—they are time capsules. What we see today may not exist for our children.
          </p>
          <p className="mt-6 opacity-50">— Archive curated with care</p>
        </div>
      </main>

      {/* Status Toast */}
      {status && (
        <div className={`fixed bottom-6 right-6 px-4 py-2 rounded text-sm z-50 ${
          status.startsWith('✅') ? 'bg-emerald-900/80 text-emerald-200' : 'bg-rose-900/80 text-rose-200'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}