'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Define collections: each has fixed title, category, and default specs
const COLLECTIONS = [
  { id: 'vintage-watches', title: 'Vintage Timepieces', price: 12500, category: 'Luxury Watches', description: 'Rare vintage watches from iconic Swiss makers' },
  { id: 'designer-handbags', title: 'Designer Handbags', price: 8900, category: 'Fashion', description: 'Limited edition handbags from top fashion houses' },
  { id: 'rare-wine', title: 'Rare Wine Collection', price: 15000, category: 'Fine Wine', description: 'Curated selection of rare vintages from Bordeaux and Burgundy' },
  { id: 'classic-cars', title: 'Classic Automobiles', price: 250000, category: 'Automotive', description: 'Museum-quality classic cars from the golden era' },
  { id: 'fine-art', title: 'Contemporary Fine Art', price: 45000, category: 'Art', description: 'Original works from emerging and established artists' },
];

type CollectionData = {
  image_url: string | null;
  price: number;
  category: string;
  description: string;
};

export default function LuxuryCollectiblesPage() {
  const [collections, setCollections] = useState<{ [key: string]: CollectionData }>({});
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(true);

  // Initialize: fetch user + existing collection data + hero image
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id;
      setUserId(uid || null);

      if (uid) {
        // Fetch collections data
        const { data: collectionsData, error: collectionsError } = await supabase
          .from('blog_posts')
          .select('title, image_url, content')
          .eq('user_id', uid)
          .in('title', COLLECTIONS.map(c => c.title));

        if (collectionsError) {
          console.error('Failed to fetch collections:', collectionsError);
        } else {
          const initialState: { [key: string]: CollectionData } = {};
          COLLECTIONS.forEach((c) => {
            const stored = collectionsData.find((row: any) => row.title === c.title);
            if (stored) {
              let price = c.price;
              let category = c.category;
              let description = c.description;
              try {
                const content = JSON.parse(stored.content);
                price = content.price ?? price;
                category = content.category ?? category;
                description = content.description ?? description;
              } catch (e) {
                // fallback to defaults
              }
              initialState[c.id] = {
                image_url: stored.image_url || null,
                price,
                category,
                description,
              };
            } else {
              initialState[c.id] = {
                image_url: null,
                price: c.price,
                category: c.category,
                description: c.description,
              };
            }
          });
          setCollections(initialState);
        }

        // Fetch hero image
        const { data: heroData, error: heroError } = await supabase
          .from('blog_posts')
          .select('image_url')
          .eq('user_id', uid)
          .eq('title', 'hero_image')
          .single();

        if (!heroError || heroError.code === 'PGRST116') {
          if (heroData) {
            setHeroImageUrl(heroData.image_url);
          }
        } else {
          console.error('Failed to fetch hero image:', heroError);
        }
      }
    };

    init();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, collectionId: string) => {
    if (!adminMode) return;
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(collectionId);
    setStatus(null);

    try {
      const collection = COLLECTIONS.find(c => c.id === collectionId);
      if (!collection) throw new Error('Invalid collection');

      const filePath = `blog/${userId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      const content = JSON.stringify({
        price: collections[collectionId]?.price || collection.price,
        category: collections[collectionId]?.category || collection.category,
        description: collections[collectionId]?.description || collection.description,
        details: `Exclusive ${collection.title} collection.`
      });

      await supabase
        .from('blog_posts')
        .delete()
        .eq('user_id', userId)
        .eq('title', collection.title);

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: collection.title,
          content,
          image_url: imageUrl,
          published: false,
        });

      if (insertErr) throw insertErr;

      setCollections(prev => ({
        ...prev,
        [collectionId]: {
          ...prev[collectionId],
          image_url: imageUrl,
        },
      }));

      setStatus(`✅ ${collection.title} image updated!`);
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!adminMode) return;
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setHeroUploading(true);
    setStatus(null);

    try {
      const filePath = `blog/${userId}/hero_${Date.now()}_${file.name}`;
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
        .eq('title', 'hero_image');

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: 'hero_image',
          content: JSON.stringify({ 
            tagline: 'Curated Excellence', 
            description: 'Exceptional collectibles for the discerning connoisseur' 
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

  const formatPrice = (price: number): string => {
    if (price >= 1_000_000) {
      return `$${(price / 1_000_000).toFixed(1)}M`;
    } else if (price >= 1_000) {
      return `$${(price / 1_000).toFixed(0)}K`;
    }
    return `$${price.toLocaleString()}`;
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'luxury watches': return 'bg-amber-600';
      case 'fashion': return 'bg-pink-600';
      case 'fine wine': return 'bg-red-700';
      case 'automotive': return 'bg-blue-700';
      case 'art': return 'bg-purple-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* ===== HEADER ===== */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 z-10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-amber-400 tracking-wide">CurioVault</h1>
              <nav className="hidden md:flex space-x-6">
                <a href="#" className="text-slate-300 hover:text-amber-400 font-medium">Collections</a>
                <a href="#" className="text-slate-300 hover:text-amber-400 font-medium">Auctions</a>
                <a href="#" className="text-slate-300 hover:text-amber-400 font-medium">Experts</a>
                <a href="#" className="text-slate-300 hover:text-amber-400 font-medium">Authentication</a>
                <a href="#" className="text-slate-300 hover:text-amber-400 font-medium">Contact</a>
              </nav>
            </div>
            <button className="bg-amber-600 text-white px-4 py-2 rounded-full font-medium hover:bg-amber-700 transition">
              Submit Collection
            </button>
          </div>
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <div className="relative h-[60vh] min-h-[400px] max-h-[600px] w-full overflow-hidden">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt="Luxury collectibles background"
            className="w-full h-full object-cover brightness-90 contrast-110 transition-all duration-500 hover:brightness-100"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900">
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
        )}
        
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 md:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-lg">
              Curated Excellence
            </h1>
            <p className="text-xl md:text-2xl text-slate-200 mb-8 drop-shadow-md">
              Exceptional collectibles for the discerning connoisseur
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button className="bg-amber-600 text-white font-bold px-6 py-3 rounded-full hover:bg-amber-700 hover:shadow-lg transition transform hover:-translate-y-0.5">
                View Collections
              </button>
              <button className="bg-transparent border-2 border-amber-500 text-amber-400 font-bold px-6 py-3 rounded-full hover:bg-amber-500/10 hover:shadow-lg transition">
                Request Appraisal
              </button>
            </div>
          </div>
        </div>

        {userId && adminMode && (
          <div className="absolute top-6 right-6 z-20">
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleHeroUpload}
                disabled={heroUploading}
                className="hidden"
                id="hero-upload"
              />
              <label
                htmlFor="hero-upload"
                className={`cursor-pointer ${heroUploading ? 'opacity-70' : 'hover:opacity-90'}`}
                title={heroUploading ? "Uploading..." : "Change hero image"}
              >
                <div className="flex items-center bg-black/50 text-amber-400 px-4 py-2 rounded-full backdrop-blur-sm border border-amber-500/20 hover:border-amber-500/40 transition">
                  {heroUploading ? (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="font-medium">
                    {heroUploading ? 'Uploading...' : 'Change Hero Image'}
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        {userId && (
          <div className="absolute top-6 left-6 z-20">
            <button
              onClick={() => setAdminMode(!adminMode)}
              className={`w-6 h-6 rounded-full border border-slate-400 flex items-center justify-center transition-colors ${
                adminMode ? 'bg-green-500' : 'bg-slate-400'
              }`}
              title={adminMode ? 'Disable admin mode' : 'Enable admin mode'}
            >
              <div className="w-3 h-3 rounded-full bg-white opacity-80"></div>
            </button>
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* ===== COLLECTIONS GRID ===== */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 mt-6 space-y-10">
        <h2 className="text-2xl font-bold text-slate-100">Exclusive Collections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {COLLECTIONS.map((collection) => {
            const data = collections[collection.id];
            const bgColorClass = getCategoryColor(data?.category || collection.category);

            return (
              <div
                key={collection.id}
                className="rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm hover:shadow-3xl transition-all duration-300"
              >
                <div className="relative h-48">
                  {data?.image_url ? (
                    <img
                      src={data.image_url}
                      alt={collection.title}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-slate-700 to-slate-800 flex items-center justify-center text-slate-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <button className="absolute top-3 right-3 bg-slate-900/80 rounded-full p-2 hover:bg-slate-900 transition shadow-lg backdrop-blur-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.682l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>

                <div className="p-4">
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold text-white mb-2 ${bgColorClass}`}>
                    {data?.category || collection.category}
                  </div>
                  <h3 className="font-bold text-lg text-white">{collection.title}</h3>
                  <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                    {data?.description || collection.description}
                  </p>
                  <div className="mt-3 text-xl font-bold text-amber-400">
                    {formatPrice(data?.price || collection.price)}
                  </div>

                  {userId && adminMode && (
                    <div className="mt-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUpload(e, collection.id)}
                        disabled={uploading === collection.id}
                        className="w-full text-xs border border-slate-600 rounded px-2 py-1 file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-amber-500/10 file:text-amber-400 hover:file:bg-amber-500/20"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== WHY COLLECTORS CHOOSE US ===== */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16 bg-gradient-to-r from-slate-800/50 to-slate-900/50 rounded-2xl my-12 backdrop-blur-sm border border-slate-700">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Why Discerning Collectors Trust CurioVault
          </h2>
          <p className="text-lg text-slate-300">
            From rare timepieces to museum-quality automobiles, we authenticate, curate, and connect elite collectors with the world's most exceptional pieces—ensuring provenance, value, and legacy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "Expert Authentication",
              desc: "Rigorous verification process with industry-leading experts and advanced forensic analysis.",
              icon: "🔍"
            },
            {
              title: "Global Sourcing",
              desc: "Direct access to private collections, estate sales, and exclusive auctions worldwide.",
              icon: "🌍"
            },
            {
              title: "Discreet Acquisition",
              desc: "Confidential purchasing services with white-glove delivery and secure storage options.",
              icon: "🛡️"
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-slate-900/80 p-6 rounded-xl border border-slate-700 hover:border-amber-500/50 transition">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
              <p className="text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <button className="bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold px-8 py-4 rounded-full text-lg hover:shadow-2xl transition transform hover:-translate-y-1">
            Consult Our Expert Team →
          </button>
          <p className="text-slate-400 mt-4 text-sm">
            Authenticity guaranteed. Global expertise. Discreet service.
          </p>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-300 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold text-amber-400 mb-4">CurioVault</h3>
              <p className="text-sm text-slate-400">
                The premier destination for authenticated luxury collectibles and rare acquisitions.
              </p>
              <div className="flex space-x-4 mt-4">
                {['twitter', 'instagram', 'linkedin', 'facebook'].map((platform) => (
                  <a key={platform} href="#" className="text-slate-400 hover:text-amber-400 transition" aria-label={platform}>
                    <span className="sr-only">{platform}</span>
                    <div className="h-5 w-5 bg-slate-800 rounded-full flex items-center justify-center text-xs">
                      {platform[0].toUpperCase()}
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Collections</h4>
              <ul className="space-y-2 text-slate-400">
                {['Luxury Watches', 'Fine Art', 'Classic Cars', 'Rare Wine', 'Designer Fashion'].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-amber-400 transition">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Services</h4>
              <ul className="space-y-2 text-slate-400">
                {['Authentication', 'Appraisal', 'Private Sale', 'Storage Solutions', 'Insurance'].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-amber-400 transition">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <address className="not-italic text-sm space-y-2 text-slate-400">
                <p>888 Collector's Row</p>
                <p>New York, NY 10021</p>
                <p className="mt-2">curate@curiovault.com</p>
                <p>+1 (212) 555-8765</p>
              </address>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-10 pt-6 text-center text-slate-500 text-sm">
            © {new Date().getFullYear()} CurioVault. All authenticated collectibles guaranteed. | Curated excellence since 2023.
          </div>
        </div>
      </footer>

      {status && (
        <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-center z-50 ${
          status.startsWith('✅') ? 'bg-green-900/80 text-green-200' : 'bg-red-900/80 text-red-200'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}
