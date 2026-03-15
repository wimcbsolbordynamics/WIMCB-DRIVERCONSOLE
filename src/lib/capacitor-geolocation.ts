'use client';

import { Capacitor } from '@capacitor/core';

/**
 * Dynamically loads and interacts with the Capacitor Geolocation plugins.
 * Uses "as any" and dynamic imports to prevent build-time failures during Next.js SSR/Static generation.
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
      // Use "as any" to bypass build-time type checking for native modules
      const mod = (await import('@capacitor-community/background-geolocation')) as any;
      const BackgroundGeolocation = mod.BackgroundGeolocation || mod.default?.BackgroundGeolocation;
      
      if (!BackgroundGeolocation) {
        throw new Error('BackgroundGeolocation plugin not found');
      }
      
      return await BackgroundGeolocation.addWatcher(options, callback);
    }
    return null;
  } catch (err) {
    console.warn('Background Geolocation plugin failed to load:', err);
    return null;
  }
}

export async function removeBackgroundWatcher(id: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (typeof window !== 'undefined') {
      const mod = (await import('@capacitor-community/background-geolocation')) as any;
      const BackgroundGeolocation = mod.BackgroundGeolocation || mod.default?.BackgroundGeolocation;
      
      if (BackgroundGeolocation) {
        await BackgroundGeolocation.removeWatcher({ id });
      }
    }
  } catch (err) {
    console.error('Failed to remove Background Geolocation watcher:', err);
  }
}

export async function requestLocationPermissions() {
  if (!Capacitor.isNativePlatform()) return null;
  
  try {
    // Dynamic import to bypass build-time type checking issues with Capacitor modules in NextJS
    const mod = (await import('@capacitor/geolocation')) as any;
    const Geolocation = mod.Geolocation || mod.default?.Geolocation;
    
    if (Geolocation) {
      // First check the current status
      const status = await Geolocation.checkPermissions();
      
      // If not granted, request them
      if (status.location !== 'granted') {
        return await Geolocation.requestPermissions();
      }
      return status;
    }
    return null;
  } catch (err) {
    console.error('Failed to request location permissions:', err);
    return null;
  }
}
