'use client';

import { Capacitor } from '@capacitor/core';

/**
 * Dynamically loads and interacts with the Capacitor Background Geolocation plugin.
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
    if (typeof window !== 'undefined') {
      // Use any to bypass strict type checking for the dynamic import which can be finicky during build
      const mod = (await import('@capacitor-community/background-geolocation')) as any;
      const BackgroundGeolocation = mod.BackgroundGeolocation || mod.default;
      
      if (!BackgroundGeolocation) {
        throw new Error('BackgroundGeolocation plugin not found in module');
      }
      
      return await BackgroundGeolocation.addWatcher(options, callback);
    }
    return null;
  } catch (err) {
    console.warn('Background Geolocation plugin failed to load or initialize:', err);
    return null;
  }
}

export async function removeBackgroundWatcher(id: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (typeof window !== 'undefined') {
      const mod = (await import('@capacitor-community/background-geolocation')) as any;
      const BackgroundGeolocation = mod.BackgroundGeolocation || mod.default;
      
      if (BackgroundGeolocation) {
        await BackgroundGeolocation.removeWatcher({ id });
      }
    }
  } catch (err) {
    console.error('Failed to remove Background Geolocation watcher:', err);
  }
}
