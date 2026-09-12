# Supabase Setup Instructions

## Environment Variables

To use Supabase in your application, you need to set up the following environment variables:

### For Next.js (.env.local file)
Create a `.env.local` file in your project root with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://uzbupbtrmbmmmkztmrtl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-here>
```

### For Expo/React Native (.env file)
If you're also using Expo, add these to your `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://uzbupbtrmbmmmkztmrtl.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=<your-anon-key-here>
```

## Installation

The Supabase client has been added to your `package.json`. Run:

```bash
npm install
```

## Usage

Import and use the Supabase client in your components:

```typescript
import { supabase } from '@/lib/supabase'

// Example: Fetch data
const { data, error } = await supabase
  .from('your_table')
  .select('*')
```

## Important Notes

1. **Replace the placeholder key**: Make sure to replace `<prefer publishable key instead of anon key for mobile and desktop apps>` with your actual Supabase anon key.

2. **Security**: The anon key is safe to use in client-side code, but make sure your Row Level Security (RLS) policies are properly configured in Supabase.

3. **Environment files**: Make sure to add `.env.local` and `.env` to your `.gitignore` file to avoid committing sensitive keys.
