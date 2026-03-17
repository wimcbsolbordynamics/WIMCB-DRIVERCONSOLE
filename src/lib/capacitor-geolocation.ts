'use client';

import { registerPlugin, Capacitor } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import type { GeolocationPlugin, PermissionStatus } from '@capacitor/geolocation';

// Using registerPlugin avoids dynamic import type errors during Next.js build
// This is the standard Capacitor pattern for referencing plugins.
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
  return await BackgroundGeolocation.addWatcher(options, callback);
}

export async function removeBackgroundWatcher(id: string) {
  if (!Capacitor.isNativePlatform()) return;
  await BackgroundGeolocation.removeWatcher({ id });
}

export async function requestLocationPermissions(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) return { location: 'granted', coarseLocation: 'granted' };
  
  try {
    const status = await Geolocation.checkPermissions();
    
    // On modern Android, background permission is requested via 'location'
    if (status.location !== 'granted') {
      return await Geolocation.requestPermissions();
    }
    
    return status;
  } catch (err) {
    console.error('Permission Request Error:', err);
    return { location: 'denied', coarseLocation: 'denied' };
  }
}
