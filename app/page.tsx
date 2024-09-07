'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Loader2, AlertCircle, Download, Search } from 'lucide-react';

interface Meme {
  id: string;
  title: string;
  url: string;
  subreddit: string;
  sentiment: number;
}

interface Subreddit {
  name: string;
  subscribers: number;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [subreddits, setSubreddits] = useState<Subreddit[]>([]);
  const [selectedSubreddits, setSelectedSubreddits] = useState<string[]>([]);
  const [memes, setMemes] = useState<Meme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastMemeElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && after) {
        fetchMemes();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, after]);

  const fetchSubreddits = async () => {
    try {
      const response = await axios.post('/api/memes');
      setSubreddits(response.data);
    } catch (error) {
      console.error("Error fetching subreddits:", error);
      setError(error.response?.data?.error || "Failed to fetch subreddits. Please try again.");
    }
  };

  const fetchMemes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/memes', {
        params: { 
          query, 
          subreddits: selectedSubreddits.join(','),
          after 
        }
      });
      setMemes(prev => [...prev, ...response.data.memes]);
      setAfter(response.data.after);
    } catch (error) {
      console.error("Error fetching memes:", error);
      setError(error.response?.data?.error || "Failed to fetch memes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadMeme = async (meme: Meme) => {
    try {
      const response = await axios.get(meme.url, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${meme.title}.jpg`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading meme:", error);
      setError("Failed to download meme. Please try again.");
    }
  };

  useEffect(() => {
    fetchSubreddits();
  }, []);

  const handleSearch = () => {
    setMemes([]);
    setAfter(null);
    fetchMemes();
  };

  const toggleSubreddit = (subreddit: string) => {
    setSelectedSubreddits(prev => 
      prev.includes(subreddit) 
        ? prev.filter(s => s !== subreddit)
        : [...prev, subreddit]
    );
  };

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Reddit Meme Finder</h1>
      <div className="mb-6 flex flex-col items-center">
        <input
          className="border p-2 mb-2 w-full rounded"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your meme search query"
        />
        <div className="mb-4 w-full">
          <h2 className="text-xl font-semibold mb-2">Select Subreddits:</h2>
          <div className="flex flex-wrap gap-2">
            {subreddits.map(subreddit => (
              <button
                key={subreddit.name}
                className={`px-2 py-1 rounded ${
                  selectedSubreddits.includes(subreddit.name)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-black'
                }`}
                onClick={() => toggleSubreddit(subreddit.name)}
              >
                {subreddit.name}
              </button>
            ))}
          </div>
        </div>
        <button
          className="bg-blue-500 text-white p-2 rounded w-full sm:w-auto flex items-center justify-center"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          {loading ? 'Searching...' : 'Search Memes'}
        </button>
      </div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold mr-2"><AlertCircle className="inline mr-1" size={16} /></strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {memes.map((meme, index) => (
          <div 
            key={meme.id} 
            className="border rounded p-4 shadow-md transition-transform hover:scale-105"
            ref={index === memes.length - 1 ? lastMemeElementRef : null}
          >
            <img src={meme.url} alt={meme.title} className="w-full h-48 object-cover mb-2 rounded" />
            <p className="text-sm font-semibold mb-2 h-12 overflow-hidden">{meme.title}</p>
            <p className="text-xs text-gray-500 mb-2">{meme.subreddit}</p>
            <button
              className="bg-green-500 text-white p-2 rounded w-full flex items-center justify-center"
              onClick={() => downloadMeme(meme)}
            >
              <Download className="mr-2 h-4 w-4" /> Download
            </button>
          </div>
        ))}
      </div>
      {loading && <div className="text-center mt-4"><Loader2 className="inline animate-spin" size={24} /></div>}
    </main>
  );
}