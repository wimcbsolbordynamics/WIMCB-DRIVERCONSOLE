'use client';

import { Capacitor } from '@capacitor/core';

/**
 * Dynamically loads and interacts with the Capacitor Background Geolocation plugin.
 * This implementation prevents build-time module resolution errors by using runtime imports.
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
    // We use a double-layered check to ensure the plugin doesn't crash the web build
    if (typeof window !== 'undefined') {
      const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');
      return await BackgroundGeolocation.addWatcher(options, callback);
    }
    return null;
  } catch (err) {
    console.warn('Background Geolocation plugin failed to load. Ensure it is installed in your native project.');
    return null;
  }
}

export async function removeBackgroundWatcher(id: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (typeof window !== 'undefined') {
      const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');
      await BackgroundGeolocation.removeWatcher({ id });
    }
  } catch (err) {
    console.error('Failed to remove Background Geolocation watcher:', err);
  }
}
