// app/serenity/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Predefined retreats (like property listings, but for wellness)
const RETREATS = [
  { id: 'bali-healing', title: 'Sacred Bali Healing', duration: 7, location: 'Ubud, Bali', focus: 'Yoga & Detox', price: 3200 },
  { id: 'swiss-alpine', title: 'Alpine Mindfulness', duration: 5, location: 'Zermatt, Switzerland', focus: 'Silence & Nature', price: 4500 },
  { id: 'desert-soul', title: 'Sahara Soul Journey', duration: 6, location: 'Merzouga, Morocco', focus: 'Meditation & Stars', price: 2800 },
  { id: 'japanese-zen', title: 'Kyoto Zen Immersion', duration: 8, location: 'Kyoto, Japan', focus: 'Zen & Tea Ceremony', price: 3900 },
  { id: 'costa-forest', title: 'Costa Rica Forest Bathing', duration: 6, location: 'Monteverde, Costa Rica', focus: 'Reconnection & Eco', price: 2600 },
];

type RetreatData = {
  image_url: string | null;
  price: number;
  duration: number;
  location: string;
  focus: string;
};

export default function SerenityRetreatsPage() {
  const [retreats, setRetreats] = useState<{ [key: string]: RetreatData }>({});
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(true); // Default ON for logged-in

  // Initialize: fetch user + retreat data + hero
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id;
      setUserId(uid || null);

      if (uid) {
        // Fetch retreats
        const { data: retreatsData, error: retreatsError } = await supabase
          .from('blog_posts')
          .select('title, image_url, content')
          .eq('user_id', uid)
          .in('title', RETREATS.map(r => r.title));

        if (!retreatsError) {
          const initialState: { [key: string]: RetreatData } = {};
          RETREATS.forEach((r) => {
            const stored = retreatsData.find((row: any) => row.title === r.title);
            if (stored) {
              let price = r.price;
              let duration = r.duration;
              let location = r.location;
              let focus = r.focus;
              try {
                const content = JSON.parse(stored.content);
                price = content.price ?? price;
                duration = content.duration ?? duration;
                location = content.location ?? location;
                focus = content.focus ?? focus;
              } catch {}
              initialState[r.id] = { image_url: stored.image_url || null, price, duration, location, focus };
            } else {
              initialState[r.id] = { image_url: null, price: r.price, duration: r.duration, location: r.location, focus: r.focus };
            }
          });
          setRetreats(initialState);
        }

        // Fetch hero
        const { data: heroData, error: heroError } = await supabase
          .from('blog_posts')
          .select('image_url')
          .eq('user_id', uid)
          .eq('title', 'hero_image_serenity')
          .single();

        if (!heroError || heroError.code === 'PGRST116') {
          if (heroData) setHeroImageUrl(heroData.image_url);
        }
      }
    };
    init();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, retreatId: string) => {
    if (!adminMode || !userId) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(retreatId);
    setStatus(null);

    try {
      const retreat = RETREATS.find(r => r.id === retreatId);
      if (!retreat) throw new Error('Invalid retreat');

      const filePath = `blog/${userId}/serenity_${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      const content = JSON.stringify({
        price: retreats[retreatId]?.price || retreat.price,
        duration: retreats[retreatId]?.duration || retreat.duration,
        location: retreats[retreatId]?.location || retreat.location,
        focus: retreats[retreatId]?.focus || retreat.focus,
        description: `Transformative ${retreat.focus} retreat in ${retreat.location}.`
      });

      await supabase
        .from('blog_posts')
        .delete()
        .eq('user_id', userId)
        .eq('title', retreat.title);

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: retreat.title,
          content,
          image_url: imageUrl,
          published: false,
        });
      if (insertErr) throw insertErr;

      setRetreats(prev => ({
        ...prev,
        [retreatId]: { ...prev[retreatId], image_url: imageUrl },
      }));
      setStatus(`✅ ${retreat.title} image updated!`);
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!adminMode || !userId) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setHeroUploading(true);
    setStatus(null);

    try {
      const filePath = `blog/${userId}/hero_serenity_${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      await supabase
        .from('blog_posts')
        .delete()
        .eq('user_id', userId)
        .eq('title', 'hero_image_serenity');

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: 'hero_image_serenity',
          content: JSON.stringify({ 
            tagline: 'Return to Stillness', 
            description: 'Curated wellness journeys for the soul' 
          }),
          image_url: imageUrl,
          published: false,
        });
      if (insertErr) throw insertErr;

      setHeroImageUrl(imageUrl);
      setStatus('✅ Hero image updated!');
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setHeroUploading(false);
    }
  };

  const formatPrice = (price: number): string => `$${price.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-emerald-50">
      {/* ===== HEADER ===== */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b z-10 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-bold text-emerald-700">Serenity</h1>
              <nav className="hidden md:flex space-x-5">
                {['Journeys', 'Guides', 'Teachers', 'Journal'].map((item) => (
                  <a key={item} href="#" className="text-gray-700 hover:text-emerald-600 font-medium text-sm">{item}</a>
                ))}
              </nav>
            </div>
            <button className="bg-emerald-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-emerald-700 transition">
              Book a Call
            </button>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <div className="relative h-[60vh] min-h-[400px] max-h-[600px] w-full overflow-hidden">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt="Wellness retreat"
            className="w-full h-full object-cover brightness-90"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500" />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-light text-white mb-3 tracking-wide">
              Return to Stillness
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-8 font-light">
              Curated wellness journeys for the soul
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button className="bg-white text-emerald-800 font-medium px-6 py-2.5 rounded-full hover:bg-emerald-50 transition">
                Explore Retreats
              </button>
              <button className="bg-transparent border border-white text-white font-medium px-6 py-2.5 rounded-full hover:bg-white/10 transition">
                Speak With a Guide
              </button>
            </div>
          </div>
        </div>

        {/* Hero Upload - Admin */}
        {userId && adminMode && (
          <div className="absolute top-5 right-5 z-20">
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleHeroUpload}
                disabled={heroUploading}
                className="hidden"
                id="hero-serenity-upload"
              />
              <label
                htmlFor="hero-serenity-upload"
                className={`cursor-pointer ${heroUploading ? 'opacity-60' : 'hover:opacity-90'}`}
              >
                <div className="flex items-center bg-black/40 text-white px-3 py-1.5 rounded-full backdrop-blur-sm text-xs">
                  {heroUploading ? (
                    <svg className="animate-spin h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {heroUploading ? 'Uploading...' : 'Change Hero'}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Admin Toggle */}
        {userId && (
          <div className="absolute top-5 left-5 z-20">
            <button
              onClick={() => setAdminMode(!adminMode)}
              className={`w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center ${
                adminMode ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
              title={adminMode ? 'Disable admin' : 'Enable admin'}
            >
              <div className="w-2 h-2 rounded-full bg-white opacity-90"></div>
            </button>
          </div>
        )}

        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* ===== RETREATS GRID ===== */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 mt-8 space-y-8">
        <h2 className="text-2xl font-semibold text-gray-800 text-center">Curated Wellness Journeys</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {RETREATS.map((retreat) => {
            const data = retreats[retreat.id];
            return (
              <div
                key={retreat.id}
                className="rounded-2xl overflow-hidden shadow-sm border border-emerald-100 bg-white/80 backdrop-blur-sm hover:shadow-md transition-all duration-300"
              >
                <div className="relative h-44">
                  {data?.image_url ? (
                    <img
                      src={data.image_url}
                      alt={retreat.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-emerald-100 to-teal-100 flex items-center justify-center">
                      <span className="text-emerald-400 text-sm">No image</span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 mb-2">
                    {data?.focus || retreat.focus}
                  </div>
                  <h3 className="font-semibold text-gray-900">{retreat.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{data?.location || retreat.location}</p>
                  
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-lg font-medium text-emerald-700">
                      {formatPrice(data?.price || retreat.price)}
                    </span>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {data?.duration || retreat.duration} days
                    </span>
                  </div>

                  {userId && adminMode && (
                    <div className="mt-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUpload(e, retreat.id)}
                        disabled={uploading === retreat.id}
                        className="w-full text-xs text-gray-600 file:mr-3 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== WHY CHOOSE US ===== */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl font-light text-gray-900 mb-3">A Different Kind of Journey</h2>
          <p className="text-gray-600">
            We don’t just book retreats—we co-create transformative experiences with master guides, sacred spaces, and intentional design.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'Ethically Hosted', desc: 'Partnering only with locally owned, eco-conscious sanctuaries.' },
            { title: 'Personalized Itineraries', desc: 'Your journey adapts to your energy, goals, and pace.' },
            { title: 'Post-Retreat Integration', desc: 'Ongoing support to embody your insights in daily life.' }
          ].map((item, i) => (
            <div key={i} className="text-center p-5">
              <div className="text-emerald-600 font-medium mb-2">{item.title}</div>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="bg-gray-900 text-gray-300 py-10">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h3 className="text-emerald-400 font-medium mb-3">Serenity Journeys</h3>
          <p className="text-sm max-w-md mx-auto mb-6">
            Intentional travel for the modern seeker. Reconnect. Reflect. Return renewed.
          </p>
          <p className="text-xs opacity-70">© {new Date().getFullYear()} Serenity. Crafted with stillness.</p>
        </div>
      </footer>

      {/* Status Toast */}
      {status && (
        <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full shadow-lg text-center z-50 text-sm ${
          status.startsWith('✅') ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}