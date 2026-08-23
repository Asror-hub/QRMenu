# QRMenu Admin Mobile

Mobile version of the QRMenu admin app built with React Native Expo and styled-components.

## Setup

1. Copy `.env` and ensure it has:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
   - `EXPO_PUBLIC_CUSTOMER_APP_URL` (customer app URL for QR codes)

2. Install dependencies (already done):
   ```bash
   npm install
   ```

3. Run the app:
   ```bash
   npm start        # Start Expo dev server
   npm run android  # Run on Android
   npm run ios      # Run on iOS (macOS only)
   npm run web      # Run in browser
   ```

## Features

- **Auth**: Login and Register with Supabase
- **Dashboard**: Analytics, stats, revenue charts
- **Orders**: View orders by status, accept/ready/finish, real-time updates
- **Categories**: Manage categories and menu items with images
- **Tables**: Create tables, generate QR codes, share
- **Settings**: Restaurant profile, menu defaults, order settings
- **Support**: Placeholder screen
- **Theme**: Light/dark mode with persistence

## Structure

- `app/` - Expo Router screens
- `src/` - Services, contexts, constants
- `app/(auth)/` - Login, Register
- `app/(app)/` - Main app with bottom tabs
