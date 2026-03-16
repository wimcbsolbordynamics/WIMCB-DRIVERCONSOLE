
'use client';

import { registerPlugin, Capacitor } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import type { GeolocationPlugin, PermissionStatus } from '@capacitor/geolocation';

/**
 * Manually register the plugins to bypass Next.js build-time 
 * module resolution errors for native Capacitor plugins.
 */
// @ts-ignore
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
// @ts-ignore
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
    throw err;
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

export async function requestLocationPermissions(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) return { location: 'granted', coarseLocation: 'granted' };
  
  try {
    const status = await Geolocation.checkPermissions();
    
    // If not granted, request the standard permissions first
    if (status.location !== 'granted') {
      const requestStatus = await Geolocation.requestPermissions();
      return requestStatus;
    }
    
    return status;
  } catch (err) {
    console.error('Failed to request location permissions:', err);
    return { location: 'denied', coarseLocation: 'denied' };
  }
}
