// components/Header.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client'; // 👈 updated import
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const [user, setUser] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();

    // Optional: Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAuth = async () => {
    if (user) {
      await supabase.auth.signOut();
      router.refresh();
    } else {
      // Replace with modal later
      alert('Login modal would open here');
    }
  };

  const navItems = [
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Blog', href: '/blog' },
    { name: 'Editor', href: '/editor' },
    { name: 'Write', href: '/write' },
  ];

  return (
    <header className="site-header-bp sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container-bp mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl md:text-2xl font-bold text-gray-900 hover:text-indigo-600 transition-colors">
              Before Publishing
            </Link>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  pathname === item.href
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
            <button
              onClick={handleAuth}
              className={`ml-4 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                user
                  ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-100'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
              }`}
            >
              {user ? 'Logout' : 'Login'}
            </button>
          </nav>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-gray-700 hover:text-indigo-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <button
                onClick={() => {
                  handleAuth();
                  setIsMenuOpen(false);
                }}
                className={`mt-2 px-4 py-2.5 rounded-lg text-base font-semibold ${
                  user
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {user ? 'Logout' : 'Login'}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}