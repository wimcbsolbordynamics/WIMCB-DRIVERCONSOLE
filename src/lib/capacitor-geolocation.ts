'use client';

import { Capacitor } from '@capacitor/core';

/**
 * Dynamically loads and interacts with the Capacitor Background Geolocation plugin.
 * This prevents build-time errors in environments where the plugin isn't installed
 * or during Next.js server-side rendering/static analysis.
 */

export async function addBackgroundWatcher(
  options: {
    backgroundMessage: string;
    backgroundTitle: string;
    requestPermissions: boolean;
    stale: boolean;
    distanceFilter: number;
  },
  callback: (location: any, error: any) => void
) {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');
    
    // Explicitly request permissions if requested
    if (options.requestPermissions) {
      // Background Geolocation plugin handles permission requests internally through addWatcher
      // but some versions might require a manual check for background-specific permissions on Android 11+
    }
    
    return await BackgroundGeolocation.addWatcher(options, callback);
  } catch (err) {
    console.error('Failed to load Background Geolocation plugin:', err);
    return null;
  }
}

export async function removeBackgroundWatcher(id: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');
    await BackgroundGeolocation.removeWatcher({ id });
  } catch (err) {
    console.error('Failed to remove Background Geolocation watcher:', err);
  }
}
