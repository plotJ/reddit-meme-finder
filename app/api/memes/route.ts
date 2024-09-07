import { NextResponse } from 'next/server';
import Snoowrap from 'snoowrap';
import OpenAI from 'openai';

const r = new Snoowrap({
  userAgent: 'MemeFinderApp/1.0.0',
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const popularMemeSubreddits = [
    // General meme subreddits
    'funny', 'memes', 'dankmemes', 'wholesomememes', 'PrequelMemes',
    'Animemes', 'TikTokCringe', 'MemeEconomy', 'ProgrammerHumor', 'HistoryMemes',
    'AdviceAnimals', 'me_irl', 'ComedyCemetery', 'terriblefacebookmemes','aigeneratedmemes',
    
    // Cryptocurrency and blockchain subreddits
    'CryptoCurrency', 'Bitcoin', 'dogecoin', 'ethtrader', 'CryptoMoonShots',
    'ethereum', 'CryptoMarkets', 'btc', 'BitcoinBeginners', 'binance',
    'CryptoTechnology', 'cardano', 'SatoshiStreetBets', 'NFT', 'SHIBArmy',
    'CryptoCurrencies', 'litecoin', 'Ripple', 'cryptocurrencymemes', 'Monero',
    'crypto', 'Crypto_Currency_News', 'CryptocurrencyICO', 'opensea',
    'NFTsMarketplace', 'solana', 'AxieInfinity', 'Web3Memes', 'cryptomemes'
  ];

  async function getSubredditSubscribers(subreddit: string) {
    try {
      const info = await r.getSubreddit(subreddit).fetch();
      return info.subscribers;
    } catch (error) {
      console.error(`Error fetching subscribers for ${subreddit}:`, error);
      return 0;
    }
  }
  
  async function analyzeSentiment(text: string, query: string) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that analyzes the relevance of text to a given query. Respond with a number between 0 and 1, where 0 is completely unrelated and 1 is highly related."
          },
          {
            role: "user",
            content: `Analyze the relevance of the following text to the query "${query}": "${text}"`
          }
        ],
        max_tokens: 10,
        temperature: 0.5,
      });
      
      const relevanceScore = parseFloat(response.choices[0].message.content);
      return isNaN(relevanceScore) ? 0 : relevanceScore;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return 0;
    }
  }
  
  export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const subreddits = searchParams.get('subreddits')?.split(',') || popularMemeSubreddits;
    const after = searchParams.get('after') || '';
    const limit = 25;
  
    try {
      let allPosts = [];
      for (const subreddit of subreddits) {
        try {
          const posts = await r.getSubreddit(subreddit).getNew({ limit: 100, after });
          allPosts = allPosts.concat(posts);
        } catch (error) {
          console.error(`Error fetching posts from ${subreddit}:`, error);
        }
      }
  
      const memePromises = allPosts
        .filter(post => post.url.endsWith('.jpg') || post.url.endsWith('.png') || post.url.endsWith('.gif'))
        .map(async post => {
          const sentiment = await analyzeSentiment(post.title + ' ' + post.selftext, query);
          return {
            id: post.id,
            title: post.title,
            url: post.url,
            subreddit: post.subreddit_name_prefixed,
            sentiment,
          };
        });
  
      const memes = await Promise.all(memePromises);
      const relevantMemes = memes
        .filter(meme => meme.sentiment > 0.5)
        .sort((a, b) => b.sentiment - a.sentiment)
        .slice(0, limit);
  
      const nextAfter = allPosts[allPosts.length - 1]?.name || null;
  
      return NextResponse.json({
        memes: relevantMemes,
        after: nextAfter,
      });
    } catch (error) {
      console.error('Error fetching memes:', error);
      return NextResponse.json({ error: 'Failed to fetch memes' }, { status: 500 });
    }
  }
  
  export async function POST(request: Request) {
    try {
      const subreddits = await Promise.all(
        popularMemeSubreddits.map(async (subreddit) => {
          const subscribers = await getSubredditSubscribers(subreddit);
          return { name: subreddit, subscribers };
        })
      );
  
      const popularSubreddits = subreddits
        .filter(subreddit => subreddit.subscribers >= 10000)
        .sort((a, b) => b.subscribers - a.subscribers);
  
      return NextResponse.json(popularSubreddits);
    } catch (error) {
      console.error('Error fetching subreddit info:', error);
      return NextResponse.json({ error: 'Failed to fetch subreddit info' }, { status: 500 });
    }
  }