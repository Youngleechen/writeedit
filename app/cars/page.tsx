// app/art-gallery/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Curated art collection with emotional descriptors and upload prompts
const ARTWORKS = [
  { 
    id: 'midnight-garden', 
    title: 'Midnight Garden', 
    artist: 'Elena Vostok',
    emotionalTags: ['serenity', 'mystery', 'rebirth'],
    dimensions: '120x90cm',
    medium: 'Digital oil on canvas',
    prompt: 'Upload a serene night garden with glowing flowers under moonlight, deep blues and purples with subtle luminescent details'
  },
  { 
    id: 'neon-dreams', 
    title: 'Neon Dreams', 
    artist: 'Kaito Nakamura',
    emotionalTags: ['energy', 'nostalgia', 'urban'],
    dimensions: 'Digital exclusive',
    medium: 'Generative AI + hand-finished',
    prompt: 'Upload vibrant neon cityscape at night with rain-slicked streets reflecting colorful signs, cyberpunk aesthetic with warm/cool contrast'
  },
  { 
    id: 'ocean-memory', 
    title: 'Ocean Memory', 
    artist: 'Sophia Rivers',
    emotionalTags: ['melancholy', 'depth', 'tranquility'],
    dimensions: '150x100cm',
    medium: 'Mixed media collage',
    prompt: 'Upload abstract ocean waves with layered textures, deep blues and teals with hints of gold light breaking through surface'
  },
  { 
    id: 'desert-whispers', 
    title: 'Desert Whispers', 
    artist: 'Mateo Solis',
    emotionalTags: ['solitude', 'resilience', 'time'],
    dimensions: '90x180cm triptych',
    medium: 'Sand-infused acrylic',
    prompt: 'Upload desert landscape at golden hour with dramatic shadows, textured sand dunes and distant mountains under vast sky'
  },
  { 
    id: 'quantum-bloom', 
    title: 'Quantum Bloom', 
    artist: 'Aisha Chen',
    emotionalTags: ['wonder', 'transformation', 'light'],
    dimensions: 'Interactive digital',
    medium: 'Projection mapping',
    prompt: 'Upload glowing fractal patterns with light particles forming flower shapes, dark background with vibrant magenta and cyan energy flows'
  },
];

type ArtworkData = {
  image_url: string | null;
  artist: string;
  emotionalTags: string[];
  dimensions: string;
  medium: string;
  story: string;
};

export default function ArtGalleryPage() {
  const [artworks, setArtworks] = useState<{ [key: string]: ArtworkData }>({});
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(true);
  const [activeArtwork, setActiveArtwork] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const galleryRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const controls = useAnimation();

  // Track cursor position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (galleryRef.current) {
        const rect = galleryRef.current.getBoundingClientRect();
        setCursorPosition({
          x: ((e.clientX - rect.left) / rect.width) * 100,
          y: ((e.clientY - rect.top) / rect.height) * 100
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Initialize data
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id;
      setUserId(uid || null);

      if (uid) {
        // Fetch artworks
        const { data: artworksData, error: artworksError } = await supabase
          .from('blog_posts')
          .select('title, image_url, content')
          .eq('user_id', uid)
          .in('title', ARTWORKS.map(a => a.title));

        if (artworksError) {
          console.error('Failed to fetch artworks:', artworksError);
        } else {
          const initialState: { [key: string]: ArtworkData } = {};
          ARTWORKS.forEach((art) => {
            const stored = artworksData.find((row: any) => row.title === art.title);
            if (stored) {
              let artist = art.artist;
              let emotionalTags = art.emotionalTags;
              let dimensions = art.dimensions;
              let medium = art.medium;
              let story = `Experience ${art.title} by ${art.artist}`;
              
              try {
                const content = JSON.parse(stored.content);
                artist = content.artist || artist;
                emotionalTags = content.emotionalTags || emotionalTags;
                dimensions = content.dimensions || dimensions;
                medium = content.medium || medium;
                story = content.story || story;
              } catch (e) {
                // fallback to defaults
              }
              
              initialState[art.id] = {
                image_url: stored.image_url || null,
                artist,
                emotionalTags,
                dimensions,
                medium,
                story
              };
            } else {
              initialState[art.id] = {
                image_url: null,
                artist: art.artist,
                emotionalTags: art.emotionalTags,
                dimensions: art.dimensions,
                medium: art.medium,
                story: `Experience ${art.title} by ${art.artist}`
              };
            }
          });
          setArtworks(initialState);
        }

        // Fetch hero image
        const { data: heroData, error: heroError } = await supabase
          .from('blog_posts')
          .select('image_url')
          .eq('user_id', uid)
          .eq('title', 'gallery_ambiance')
          .single();

        if (!heroError || heroError.code === 'PGRST116') {
          if (heroData) {
            setHeroImageUrl(heroData.image_url);
          }
        } else {
          console.error('Failed to fetch gallery ambiance:', heroError);
        }
      }
    };

    init();
  }, []);

  // Cleanup hover timeout
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Upload handlers
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, artworkId: string) => {
    if (!adminMode) return;
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(artworkId);
    setStatus(null);

    try {
      const artwork = ARTWORKS.find(a => a.id === artworkId);
      if (!artwork) throw new Error('Invalid artwork');

      const filePath = `gallery/${userId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      // Save structured artwork data
      const content = JSON.stringify({
        artist: artworks[artworkId]?.artist || artwork.artist,
        emotionalTags: artworks[artworkId]?.emotionalTags || artwork.emotionalTags,
        dimensions: artworks[artworkId]?.dimensions || artwork.dimensions,
        medium: artworks[artworkId]?.medium || artwork.medium,
        story: artworks[artworkId]?.story || `Experience ${artwork.title} by ${artwork.artist}`
      });

      await supabase
        .from('blog_posts')
        .delete()
        .eq('user_id', userId)
        .eq('title', artwork.title);

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: artwork.title,
          content,
          image_url: imageUrl,
          published: false,
        });

      if (insertErr) throw insertErr;

      setArtworks(prev => ({
        ...prev,
        [artworkId]: {
          ...prev[artworkId],
          image_url: imageUrl,
        },
      }));

      setStatus(`✨ ${artwork.title} added to collection!`);
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleAmbianceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!adminMode) return;
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setHeroUploading(true);
    setStatus(null);

    try {
      const filePath = `gallery/${userId}/ambiance_${Date.now()}_${file.name}`;
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
        .eq('title', 'gallery_ambiance');

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: 'gallery_ambiance',
          content: JSON.stringify({ 
            description: 'Gallery ambiance setting the mood for art discovery' 
          }),
          image_url: imageUrl,
          published: false,
        });

      if (insertErr) throw insertErr;

      setHeroImageUrl(imageUrl);
      setStatus('✨ Gallery ambiance updated!');
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setHeroUploading(false);
    }
  };

  // Cursor follower effect
  const CursorFollower = () => (
    <motion.div 
      className="fixed w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm pointer-events-none z-50 border border-white/20"
      style={{ 
        left: `${cursorPosition.x}%`, 
        top: `${cursorPosition.y}%`,
        transform: 'translate(-50%, -50%)'
      }}
      animate={{ 
        scale: activeArtwork ? 1.8 : 1,
        opacity: activeArtwork ? 0.9 : 0.3,
        backgroundColor: activeArtwork ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'
      }}
      transition={{ type: "spring", damping: 15, stiffness: 150 }}
    />
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <CursorFollower />
      
      {/* Immersive Header */}
      <header className="fixed top-0 left-0 right-0 z-40 py-4 px-6 backdrop-blur-sm bg-black/30">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-yellow-400 bg-clip-text text-transparent"
          >
            Élan Gallery
          </motion.div>
          
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => setActiveArtwork(null)}
              className="text-sm font-medium hover:text-purple-400 transition-colors"
            >
              Collection
            </button>
            <button className="text-sm font-medium hover:text-purple-400 transition-colors">
              Artists
            </button>
            
            {userId && (
              <button
                onClick={() => setAdminMode(!adminMode)}
                className={`w-5 h-5 rounded-full border transition-all duration-300 ${
                  adminMode ? 'bg-purple-500 border-purple-500 scale-110' : 'bg-gray-700 border-gray-600'
                }`}
                title={adminMode ? 'Disable curator mode' : 'Enable curator mode'}
              />
            )}
          </div>
        </div>
      </header>

      {/* Dynamic Hero */}
      <div 
        ref={galleryRef}
        className="h-screen relative overflow-hidden"
        style={{
          background: heroImageUrl 
            ? `radial-gradient(circle at ${cursorPosition.x}% ${cursorPosition.y}%, rgba(30, 20, 50, 0.7), transparent 40%), url(${heroImageUrl})`
            : 'radial-gradient(circle at center, #1e1333, #0a0a1a)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
        
        <div className="relative h-full flex flex-col justify-center items-center px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-3xl"
          >
            <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-6 bg-gradient-to-r from-white via-purple-200 to-yellow-100 bg-clip-text text-transparent">
              Where Emotions Become Art
            </h1>
            <p className="text-xl md:text-2xl text-purple-100/80 max-w-2xl mx-auto mb-10">
              Step into spaces where each piece tells a story waiting to resonate with your soul
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-medium text-lg hover:shadow-lg hover:shadow-purple-500/30 transition-all"
            >
              Begin Your Journey
            </motion.button>
          </motion.div>
        </div>

        {/* Curator controls */}
        {userId && adminMode && (
          <div className="absolute bottom-8 right-8 z-30">
            <label 
              htmlFor="ambiance-upload" 
              className="group cursor-pointer relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-full blur-xl group-hover:opacity-100 opacity-0 transition-opacity" />
              <div className="relative bg-black/50 border border-purple-500/30 backdrop-blur-sm rounded-full px-5 py-3 flex items-center space-x-2 hover:border-purple-500/60 transition-all">
                {heroUploading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full"
                  />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                <span className="text-purple-300 font-medium">
                  {heroUploading ? 'Setting ambiance...' : 'Change Gallery Mood'}
                </span>
              </div>
              <input
                type="file"
                id="ambiance-upload"
                accept="image/*"
                onChange={handleAmbianceUpload}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Interactive Art Collection - CLICK TO EXPAND */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-purple-900/5 to-black pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-light text-center mb-16 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent"
          >
            Currently Resonating
          </motion.h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ARTWORKS.map((artwork) => {
              const data = artworks[artwork.id];
              const isActive = activeArtwork === artwork.id;
              
              return (
                <motion.div
                  key={artwork.id}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  onClick={() => setActiveArtwork(isActive ? null : artwork.id)}
                  className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    isActive ? 'md:col-span-2 lg:col-span-3 z-20' : ''
                  }`}
                  style={{
                    height: isActive ? '80vh' : '60vh',
                    minHeight: isActive ? '600px' : '400px'
                  }}
                >
                  <div 
                    className="absolute inset-0 bg-center bg-cover transition-all duration-700"
                    style={{ 
                      backgroundImage: data?.image_url ? `url(${data.image_url})` : 'linear-gradient(135deg, #1a1a3a 0%, #3a1a3a 100%)',
                      filter: isActive ? 'brightness(1.1)' : 'brightness(0.8)',
                      backgroundSize: isActive ? 'cover' : '110%'
                    }}
                  >
                    {/* Admin upload button - always visible in admin mode */}
                    {userId && adminMode && (
                      <div className="absolute top-4 right-4 z-10">
                        <label 
                          htmlFor={`upload-${artwork.id}`}
                          className="block w-10 h-10 rounded-full bg-black/70 border border-purple-500/30 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-purple-900/30 transition-colors"
                          onClick={(e) => e.stopPropagation()} // Prevent card click when clicking upload
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <input
                            type="file"
                            id={`upload-${artwork.id}`}
                            accept="image/*"
                            onChange={(e) => {
                              handleUpload(e, artwork.id);
                              // Close expanded view after upload
                              if (isActive) setActiveArtwork(null);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                    
                    {/* Admin-only upload prompt */}
                    {userId && adminMode && !data?.image_url && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-4 text-center text-purple-200 text-sm border-t border-purple-500/30">
                        <p className="font-medium">Upload suggestion:</p>
                        <p className="mt-1">{artwork.prompt}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Artwork details panel */}
                  <motion.div 
                    className="absolute bottom-0 left-0 right-0 backdrop-blur-xl bg-black/40 border-t border-purple-500/20 p-6 transition-all duration-500"
                    initial={{ y: '100%' }}
                    animate={{ y: isActive ? 0 : '100%' }}
                    transition={{ type: "spring", damping: 25 }}
                  >
                    <div className="max-w-3xl mx-auto">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {artwork.emotionalTags.map((tag, index) => (
                          <span 
                            key={index}
                            className="px-3 py-1 bg-purple-900/50 border border-purple-500/30 rounded-full text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      <h3 className="text-3xl md:text-4xl font-light mb-2">{artwork.title}</h3>
                      <p className="text-xl text-purple-200 mb-4">by {data?.artist || artwork.artist}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        <div>
                          <p className="text-sm text-purple-300 mb-1">Medium</p>
                          <p className="font-medium">{data?.medium || artwork.medium}</p>
                        </div>
                        <div>
                          <p className="text-sm text-purple-300 mb-1">Dimensions</p>
                          <p className="font-medium">{data?.dimensions || artwork.dimensions}</p>
                        </div>
                        <div>
                          <p className="text-sm text-purple-300 mb-1">Experience</p>
                          <p className="font-medium">{isActive ? 'Immersive view' : 'Click to explore'}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Artist Stories Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-purple-900/20 to-black relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-light text-center mb-16 bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent"
          >
            The Hands Behind the Vision
          </motion.h2>
          
          <div className="relative pl-8 border-l border-purple-500/30">
            {[
              {
                name: "Elena Vostok",
                specialty: "Emotional landscapes",
                story: "Former neuroscientist who translates brainwave patterns into visual symphonies. Her Midnight Garden series emerged during her recovery from burnout.",
                image: "/artist1.jpg"
              },
              {
                name: "Kaito Nakamura",
                specialty: "Digital nostalgia",
                story: "Tokyo-based artist who grew up in 90s arcades. His Neon Dreams collection merges retro gaming aesthetics with futuristic cityscapes.",
                image: "/artist2.jpg"
              },
              {
                name: "Aisha Chen",
                specialty: "Interactive light",
                story: "MIT Media Lab graduate exploring how light transforms physical spaces. Her Quantum Bloom installation responds to viewers' heartbeats.",
                image: "/artist3.jpg"
              }
            ].map((artist, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="mb-16 pb-16 relative group"
              >
                <div className="absolute -left-8 top-0 w-16 h-16 rounded-full border-4 border-purple-500 overflow-hidden bg-gray-800">
                  <div className="w-full h-full bg-gradient-to-br from-purple-700 to-pink-600 flex items-center justify-center text-2xl font-bold">
                    {artist.name.charAt(0)}
                  </div>
                </div>
                
                <div className="ml-12 bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-light">{artist.name}</h3>
                    <span className="text-purple-400 text-sm font-medium">{artist.specialty}</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{artist.story}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Immersive Footer */}
      <footer className="relative pt-16 pb-8 bg-gradient-to-t from-black to-purple-900/20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_70%)]" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <h3 className="text-2xl font-light mb-4 bg-gradient-to-r from-purple-300 to-yellow-300 bg-clip-text text-transparent">
                Élan Gallery
              </h3>
              <p className="text-gray-400 max-w-xs leading-relaxed">
                We don't just display art—we create emotional experiences. Founded in 2023 by curators tired of sterile gallery spaces.
              </p>
              <div className="flex space-x-4 mt-6">
                {['instagram', 'vimeo', 'spotify'].map((platform) => (
                  <a key={platform} href="#" className="w-10 h-10 rounded-full bg-purple-900/30 flex items-center justify-center hover:bg-purple-800/50 transition-colors">
                    <span className="text-white/70 font-medium uppercase text-xs">{platform[0]}</span>
                  </a>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-medium text-purple-300 mb-6">Experience</h4>
              <ul className="space-y-3">
                {[
                  'Immersive exhibitions',
                  'Artist studio visits',
                  'Emotional resonance workshops',
                  'Private viewings at dawn',
                  'Sensory art experiences'
                ].map((item) => (
                  <li key={item} className="group">
                    <a href="#" className="flex items-center text-gray-300 group-hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-medium text-purple-300 mb-6">Visit</h4>
              <address className="not-italic text-gray-400 space-y-2">
                <p className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 mt-1 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  The Lumina Building<br />
                  789 Emotional Spectrum Way<br />
                  Portland, OR 97204
                </p>
                <p className="flex items-center mt-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  +1 (503) 741-8920
                </p>
                <p className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  resonance@elangallery.art
                </p>
              </address>
            </div>
          </div>
          
          <div className="pt-8 border-t border-purple-500/20 text-center text-gray-500 text-sm">
            <p>Created for souls who feel deeply • Est. 2023</p>
            <p className="mt-2">Every visit includes complimentary emotional resonance tea • All artworks come with a story journal</p>
          </div>
        </div>
      </footer>

      {/* Status Toast */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full backdrop-blur-sm font-medium z-50 border ${
              status.startsWith('✨') 
                ? 'bg-purple-900/70 border-purple-500/50 text-purple-200' 
                : 'bg-red-900/70 border-red-500/50 text-red-200'
            }`}
          >
            {status}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}