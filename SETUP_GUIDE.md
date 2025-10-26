# Baseball App Setup Guide

## 🚀 Quick Start

Your Baseball App is now running at **http://localhost:3000** (or 3001/3002)!

## 📊 Database Setup

### 1. Create Tables in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `database/schema.sql`
4. Click **Run** to create all tables

### 2. Add Sample Data

1. In the SQL Editor, copy and paste the contents of `database/sample_data.sql`
2. Click **Run** to insert sample teams, players, and games

## 🏗️ Database Schema

Your app includes these tables:

- **teams** - Baseball teams with league/division info
- **players** - Player information with team relationships
- **games** - Game schedules and results
- **player_stats** - Individual player statistics per game

## 🎯 Features

### Current Features:
- ✅ **Database Overview** - View all available tables
- ✅ **Teams Tab** - Browse teams with league/division info
- ✅ **Players Tab** - View players with team relationships
- ✅ **Real-time Data** - Connected to your Supabase database

### Next Features to Build:
- 🏟️ **Games Tab** - Game schedules and results
- 📊 **Statistics** - Player and team performance metrics
- 📈 **Analytics** - Charts and graphs for data visualization
- 👥 **User Management** - Authentication and user roles
- 📱 **Mobile Responsive** - Optimized for mobile devices

## 🔧 Development

### File Structure:
```
baseball-app/
├── app/
│   └── page.tsx          # Main application page
├── components/
│   ├── TeamsList.tsx     # Teams display component
│   └── PlayersList.tsx    # Players display component
├── lib/
│   ├── supabase.ts       # Supabase client configuration
│   └── env.ts            # Environment variables
├── database/
│   ├── schema.sql        # Database schema
│   └── sample_data.sql   # Sample data
└── .env.local           # Environment variables
```

### Adding New Features:

1. **Create new components** in the `components/` folder
2. **Add new tabs** to the main page navigation
3. **Create new database tables** as needed
4. **Update the Supabase client** for new queries

## 🚀 Deployment

### Deploy to Vercel:
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🎉 You're Ready!

Your Baseball App is now fully functional with:
- ✅ Database connection
- ✅ Sample data
- ✅ Team and player views
- ✅ Responsive design
- ✅ Real-time updates

Start building your baseball features! ⚾
