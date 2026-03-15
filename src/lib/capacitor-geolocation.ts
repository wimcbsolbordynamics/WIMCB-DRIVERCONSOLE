'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import type { GeolocationPlugin } from '@capacitor/geolocation';

/**
 * Manually register and cast the plugins to bypass Next.js build-time 
 * module resolution errors for native Capacitor plugins.
 */
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
const Geolocation = registerPlugin<GeolocationPlugin>('Geolocation');

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
    return await BackgroundGeolocation.addWatcher(options, callback);
  } catch (err) {
    console.error('Background Geolocation Error:', err);
    return null;
  }
}

export async function removeBackgroundWatcher(id: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await BackgroundGeolocation.removeWatcher({ id });
  } catch (err) {
    console.error('Failed to remove Background Geolocation watcher:', err);
  }
}

export async function requestLocationPermissions() {
  if (!Capacitor.isNativePlatform()) return null;
  
  try {
    // First check the current status
    const status = await Geolocation.checkPermissions();
    
    // If not granted, request them
    if (status.location !== 'granted') {
      return await Geolocation.requestPermissions();
    }
    return status;
  } catch (err) {
    console.error('Failed to request location permissions:', err);
    return null;
  }
}
