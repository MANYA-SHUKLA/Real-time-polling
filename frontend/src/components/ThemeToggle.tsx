"use client";
import { useEffect, useState } from 'react';

// Simple theme toggle using data-theme attribute on <html>
// Persists preference in localStorage and respects system on first load.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('rtp-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.add('theme-transition');
    const timeout = setTimeout(() => root.classList.remove('theme-transition'), 700);
    localStorage.setItem('rtp-theme', theme);
    return () => clearTimeout(timeout);
  }, [theme]);

  // Sync if system preference changes and user has not explicitly chosen (i.e., no localStorage yet)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const stored = localStorage.getItem('rtp-theme');
      if (!stored) {
        setTheme(media.matches ? 'dark' : 'light');
      }
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  return (
    <button
      aria-label="Toggle color theme"
      onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
      className="btn btn-secondary theme-toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '.5rem',
        fontSize: '.85rem',
        padding: '.55rem .9rem'
      }}
    >
      <span style={{fontWeight:600}}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      <span aria-hidden="true" style={{fontSize:'1rem', lineHeight:1}}>
        {theme === 'dark' ? '🌞' : '🌙'}
      </span>
    </button>
  );
}
