# Player Photos Setup Guide

## Database Migration

1. Run the SQL migration to add the `photo_url` field to the players table:
   ```sql
   -- Run this in your Supabase SQL Editor
   ALTER TABLE players 
   ADD COLUMN IF NOT EXISTS photo_url TEXT;
   ```

## Supabase Storage Setup

1. **Create Storage Bucket:**
   - Go to your Supabase Dashboard
   - Navigate to **Storage** in the left sidebar
   - Click **New bucket**
   - Name: `player-photos`
   - Set as **Public bucket** (so photos can be accessed via URL)
   - Click **Create bucket**

2. **Set Bucket Policies (Optional but Recommended):**
   - Go to **Storage** → **Policies** → `player-photos`
   - Add a policy to allow authenticated users to upload:
     ```sql
     -- Allow authenticated users to upload
     CREATE POLICY "Allow authenticated uploads"
     ON storage.objects FOR INSERT
     TO authenticated
     WITH CHECK (bucket_id = 'player-photos');
     
     -- Allow public read access
     CREATE POLICY "Allow public read"
     ON storage.objects FOR SELECT
     TO public
     USING (bucket_id = 'player-photos');
     ```

## Features

- **Camera Capture**: On mobile devices, users can take photos directly using their phone camera
- **File Upload**: Users can also upload photos from their device gallery
- **Photo Preview**: Shows a preview of the selected photo before saving
- **Photo Display**: Player photos are displayed in the team view with fallback to initials
- **File Validation**: 
  - Only image files are accepted
  - Maximum file size: 5MB

## Usage

1. When adding a player to a team, click **Add Player**
2. In the form, you'll see a **Player Photo** section
3. Click the file input to either:
   - Take a photo with your phone camera (on mobile)
   - Select a photo from your device gallery
4. The photo will upload automatically and show a preview
5. Click the × button on the preview to remove the photo
6. Complete the rest of the form and save

The photo will be displayed next to the player's name in the team view.

