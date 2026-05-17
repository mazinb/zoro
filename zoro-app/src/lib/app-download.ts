/** Public App Store / Play Store URLs — set in Vercel or .env.local */
export const IOS_APP_URL =
  (process.env.NEXT_PUBLIC_IOS_APP_URL || '').trim();

export const ANDROID_APP_URL =
  (process.env.NEXT_PUBLIC_ANDROID_APP_URL || '').trim();

export const APP_DEMO_VIDEO_URL =
  (process.env.NEXT_PUBLIC_APP_DEMO_VIDEO || '/videos/demo.mp4').trim();

export const hasIosDownload = IOS_APP_URL.length > 0;
export const hasAndroidDownload = ANDROID_APP_URL.length > 0;
