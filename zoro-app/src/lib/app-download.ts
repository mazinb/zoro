/** Public App Store / Play Store URLs — set in Vercel or .env.local */
export const IOS_APP_URL =
  (process.env.NEXT_PUBLIC_IOS_APP_URL || '').trim();

export const ANDROID_APP_URL =
  (process.env.NEXT_PUBLIC_ANDROID_APP_URL || '').trim();

export const TESTFLIGHT_URL = 'https://testflight.apple.com/join/87U5ckxQ';

export const REDDIT_URL = 'https://www.reddit.com/r/getzoro/';

export const APP_DEMO_VIDEO_URL =
  (process.env.NEXT_PUBLIC_APP_DEMO_VIDEO || '/videos/demo.mp4').trim();

export const hasIosDownload = IOS_APP_URL.length > 0;
export const hasAndroidDownload = ANDROID_APP_URL.length > 0;
