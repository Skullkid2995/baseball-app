# 🚀 Baseball App Migration Guide

## Overview
This guide will help you migrate your Baseball App from the free account to your paid Supabase account while preserving all functionality and data.

## 📦 What's Included in This Project

### **Core Application Files:**
- `app/page.tsx` - Main application with tabbed interface
- `lib/supabase.ts` - Supabase client configuration
- `lib/env.ts` - Environment variable management
- `components/` - All React components (TeamsList, PlayersList, etc.)

### **Database Files:**
- `database/schema.sql` - Complete database schema
- `database/sample_data.sql` - Sample data for testing
- `database/views.sql` - Database views (if any)

### **Configuration Files:**
- `package.json` - All dependencies and scripts
- `next.config.ts` - Next.js configuration
- `tailwind.config.js` - Styling configuration
- `tsconfig.json` - TypeScript configuration

## 🔄 Migration Steps

### Step 1: Set Up New Supabase Project

1. **Log into your paid Supabase account**
2. **Create a new project:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Click "New Project"
   - Choose your organization (paid account)
   - Name it "baseball-app" or similar
   - Select a region close to your users
   - Set a strong database password

### Step 2: Migrate Database Schema

1. **Open the new project's SQL Editor**
2. **Run the schema:**
   - Copy contents from `database/schema.sql`
   - Paste into SQL Editor
   - Click "Run" to create all tables

3. **Add sample data:**
   - Copy contents from `database/sample_data.sql`
   - Paste into SQL Editor
   - Click "Run" to insert sample data

### Step 3: Update Environment Variables

1. **Get your new Supabase credentials:**
   - Go to Settings → API
   - Copy your Project URL
   - Copy your anon/public key

2. **Update `.env.local` file:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_new_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_new_anon_key
   ```

3. **Update `lib/env.ts` (optional fallback):**
   - Replace the hardcoded URLs with your new ones

### Step 4: Test the Migration

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Test all features:**
   - Database Overview tab
   - Teams tab
   - Players tab
   - Connection tests

## 🔧 Advanced Migration (If You Have Existing Data)

### Export Data from Old Project

1. **Export teams:**
   ```sql
   SELECT * FROM teams;
   ```

2. **Export players:**
   ```sql
   SELECT * FROM players;
   ```

3. **Export games:**
   ```sql
   SELECT * FROM games;
   ```

4. **Export player_stats:**
   ```sql
   SELECT * FROM player_stats;
   ```

### Import Data to New Project

1. **Create INSERT statements** for each table
2. **Run them in the new project's SQL Editor**
3. **Verify data integrity** by checking relationships

## 🚀 Deployment Options

### Option 1: Vercel (Recommended)
1. **Push to GitHub**
2. **Connect to Vercel**
3. **Add environment variables in Vercel dashboard**
4. **Deploy**

### Option 2: Netlify
1. **Build the project:** `npm run build`
2. **Deploy the `out` folder**
3. **Add environment variables**

### Option 3: Self-hosted
1. **Build:** `npm run build`
2. **Start:** `npm start`
3. **Configure reverse proxy (nginx/Apache)**

## 🔐 Security Considerations

1. **Row Level Security (RLS):**
   - Enable RLS on all tables
   - Create appropriate policies
   - Test with different user roles

2. **API Keys:**
   - Never commit `.env.local` to version control
   - Use different keys for development/production
   - Rotate keys regularly

3. **Database Access:**
   - Use connection pooling
   - Set up proper user roles
   - Monitor usage and costs

## 📊 Monitoring & Analytics

### Supabase Dashboard
- Monitor database performance
- Check API usage
- View real-time logs
- Set up alerts

### Application Monitoring
- Add error tracking (Sentry)
- Performance monitoring
- User analytics

## 🎯 Next Steps After Migration

1. **Set up CI/CD pipeline**
2. **Add automated testing**
3. **Implement user authentication**
4. **Add more features:**
   - Game schedules
   - Statistics dashboard
   - Player profiles
   - Team management

## 🆘 Troubleshooting

### Common Issues:

1. **Connection errors:**
   - Check environment variables
   - Verify Supabase project is active
   - Check network connectivity

2. **Database errors:**
   - Verify schema was created correctly
   - Check RLS policies
   - Review error logs

3. **Build errors:**
   - Clear `.next` folder
   - Reinstall dependencies
   - Check TypeScript errors

### Getting Help:
- Check Supabase documentation
- Review Next.js guides
- Check project README files

## ✅ Migration Checklist

- [ ] New Supabase project created
- [ ] Database schema migrated
- [ ] Sample data imported
- [ ] Environment variables updated
- [ ] Local development working
- [ ] All tabs functioning
- [ ] Data relationships intact
- [ ] Ready for deployment

## 🎉 You're Ready!

Your Baseball App is now successfully migrated to your paid Supabase account with all the same functionality and a solid foundation for future development!
