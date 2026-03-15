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
      const mod = await import('@capacitor-community/background-geolocation');
      // Bypassing strict named export check for build-time safety
      const BackgroundGeolocation = (mod as any).BackgroundGeolocation || (mod as any).default?.BackgroundGeolocation;
      
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
      const mod = await import('@capacitor-community/background-geolocation');
      const BackgroundGeolocation = (mod as any).BackgroundGeolocation || (mod as any).default?.BackgroundGeolocation;
      
      if (BackgroundGeolocation) {
        await BackgroundGeolocation.removeWatcher({ id });
      }
    }
  } catch (err) {
    console.error('Failed to remove Background Geolocation watcher:', err);
  }
}

export async function requestLocationPermissions() {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const status = await Geolocation.requestPermissions();
    return status;
  } catch (err) {
    console.error('Failed to request location permissions:', err);
  }
}
