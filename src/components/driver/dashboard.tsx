'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useFirestore } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Radio, 
  MapPin, 
  Navigation, 
  LogOut, 
  Signal as SignalIcon, 
  Users, 
  ShieldCheck,
  Zap,
  Bus as BusIcon,
  Wifi,
  WifiOff,
  CloudLightning,
  Satellite
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Capacitor } from '@capacitor/core';
import { addBackgroundWatcher, removeBackgroundWatcher, requestLocationPermissions } from '@/lib/capacitor-geolocation';

export function DriverDashboard() {
  const { user, driverData, logout } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [busDataLoading, setBusDataLoading] = useState(true);
  const [telemetry, setTelemetry] = useState({
    lat: 0,
    lng: 0,
    speed: 0,
    accuracy: 0,
    status: 'OFFLINE'
  });
  const [allowCrowdsourcing, setAllowCrowdsourcing] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  const watchId = useRef<string | null>(null);
  const prevPosRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);

  // Source of Truth Sync: Listen to Firestore signal doc to determine broadcast status
  useEffect(() => {
    if (user && driverData?.busNumber) {
      const signalRef = doc(db, 'buses', driverData.busNumber, 'signals', user.uid);
      const unsubscribe = onSnapshot(signalRef, (snapshot) => {
        const active = snapshot.exists();
        setIsBroadcasting(active);
        if (active) {
          setTelemetry(prev => ({ ...prev, status: 'LIVE' }));
        } else {
          setTelemetry(prev => ({ ...prev, status: 'OFFLINE' }));
        }
      });
      return () => unsubscribe();
    }
  }, [user, driverData, db]);

  // Sync Network Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  // Sync Bus Settings (Authority)
  useEffect(() => {
    if (driverData?.busNumber) {
      const busRef = doc(db, 'buses', driverData.busNumber);
      const unsubscribe = onSnapshot(busRef, (snapshot) => {
        if (snapshot.exists()) {
          setAllowCrowdsourcing(snapshot.data().allow_crowdsourcing ?? true);
        } else {
          setDoc(busRef, { 
            bus_number: driverData.busNumber, 
            allow_crowdsourcing: true 
          }, { merge: true });
        }
        setBusDataLoading(false);
      }, (err) => {
        setBusDataLoading(false);
      });
      return () => unsubscribe();
    }
  }, [driverData, db]);

  const calculateSpeed = useCallback((lat: number, lng: number, timestamp: number, reportedSpeed: number | null) => {
    let speedKmh = 0;

    // 1. Direct Reading
    if (reportedSpeed !== null && reportedSpeed > 0.2) {
      speedKmh = parseFloat((reportedSpeed * 3.6).toFixed(1));
    } else if (prevPosRef.current) {
      // 2. Fallback: Haversine distance
      const prev = prevPosRef.current;
      const timeDiffSec = (timestamp - prev.timestamp) / 1000;

      if (timeDiffSec >= 1) {
        const R = 6371e3;
        const dLat = (lat - prev.lat) * Math.PI / 180;
        const dLon = (lng - prev.lng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(prev.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        const speedMps = distance / timeDiffSec;
        speedKmh = parseFloat((speedMps * 3.6).toFixed(1));

        // Smoothing (Force to 0 if under 1.5km/h to avoid jitter)
        if (speedKmh < 1.5) speedKmh = 0;
        if (speedKmh > 130) speedKmh = 0; 
      } else {
        speedKmh = telemetry.speed;
      }
    }

    prevPosRef.current = { lat, lng, timestamp };
    return speedKmh;
  }, [telemetry.speed]);

  const updateFirebaseTelemetry = useCallback((lat: number, lng: number, speed: number, accuracy: number) => {
    if (user && driverData) {
      const signalRef = doc(db, 'buses', driverData.busNumber, 'signals', user.uid);
      const signalData = {
        uid: user.uid,
        email: user.email?.toLowerCase(),
        bus_id: driverData.busNumber,
        bus_number: driverData.busNumber,
        location: {
          latitude: lat,
          longitude: lng
        },
        speed: speed,
        accuracy: accuracy,
        timestamp: serverTimestamp()
      };

      setDoc(signalRef, signalData, { merge: true }).catch(async () => {
        const permissionError = new FirestorePermissionError({
          path: signalRef.path,
          operation: 'write',
          requestResourceData: signalData
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    }
  }, [user, driverData, db]);

  const stopBroadcast = useCallback(async () => {
    if (watchId.current !== null) {
      if (Capacitor.isNativePlatform()) {
        await removeBackgroundWatcher(watchId.current);
      } else {
        navigator.geolocation.clearWatch(parseInt(watchId.current));
      }
      watchId.current = null;
    }
    prevPosRef.current = null;
    
    // Source of Truth: Delete the signal document
    if (user && driverData) {
      const signalRef = doc(db, 'buses', driverData.busNumber, 'signals', user.uid);
      deleteDoc(signalRef).catch(async () => {
        const permissionError = new FirestorePermissionError({
          path: signalRef.path,
          operation: 'delete'
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    }
  }, [user, driverData, db]);

  const startBroadcast = useCallback(async () => {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      const status = await requestLocationPermissions();
      if (status.location !== 'granted') {
        toast({
          title: "Location Permission Required",
          description: "WIMCB requires 'Allow all the time' location access to sync fleet data in the background.",
          variant: "destructive"
        });
        return;
      }
    }

    // Source of Truth: Initialize signal document to signal start
    if (user && driverData) {
      const signalRef = doc(db, 'buses', driverData.busNumber, 'signals', user.uid);
      const initialData = {
        uid: user.uid,
        email: user.email?.toLowerCase(),
        bus_id: driverData.busNumber,
        bus_number: driverData.busNumber,
        location: { latitude: telemetry.lat, longitude: telemetry.lng },
        speed: telemetry.speed,
        accuracy: telemetry.accuracy,
        timestamp: serverTimestamp()
      };
      setDoc(signalRef, initialData, { merge: true });
    }

    if (isNative) {
      try {
        const id = await addBackgroundWatcher(
          {
            backgroundMessage: "Fleet Sync is broadcasting precision telemetry.",
            backgroundTitle: "WIMCB Command Active",
            requestPermissions: true,
            stale: false,
            distanceFilter: 1
          },
          (location, error) => {
            if (error) return;
            if (location) {
              const speedKmh = calculateSpeed(
                location.latitude, 
                location.longitude, 
                location.time || Date.now(), 
                location.speed
              );
              
              setTelemetry({
                lat: location.latitude,
                lng: location.longitude,
                speed: speedKmh,
                accuracy: location.accuracy || 0,
                status: 'LIVE'
              });
              updateFirebaseTelemetry(location.latitude, location.longitude, speedKmh, location.accuracy || 0);
            }
          }
        );
        watchId.current = id;
      } catch (err) {
        stopBroadcast();
      }
    } else {
      const id = window.navigator.geolocation.watchPosition(
        (pos) => {
          const speedKmh = calculateSpeed(
            pos.coords.latitude, 
            pos.coords.longitude, 
            pos.timestamp, 
            pos.coords.speed
          );

          setTelemetry({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: speedKmh,
            accuracy: pos.coords.accuracy,
            status: 'LIVE'
          });
          updateFirebaseTelemetry(pos.coords.latitude, pos.coords.longitude, speedKmh, pos.coords.accuracy);
        },
        () => stopBroadcast(),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
      watchId.current = id.toString();
    }
  }, [calculateSpeed, updateFirebaseTelemetry, stopBroadcast, toast, user, driverData, db, telemetry]);

  const updateAuthority = async (val: boolean) => {
    if (!driverData) return;
    setSyncing(true);
    const busRef = doc(db, 'buses', driverData.busNumber);
    
    updateDoc(busRef, {
      allow_crowdsourcing: val,
      updated_at: serverTimestamp()
    }).then(() => {
      toast({ 
        title: val ? "Crowdsourcing Restored" : "Exclusive Command Active",
        description: val ? "Student data is now accepted." : "Fleet is now locked to official signals."
      });
    }).finally(() => setSyncing(false));
  };

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between pt-2 px-2">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${isBroadcasting ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <div className="flex flex-col">
            <span className="text-[10px] font-code font-bold uppercase tracking-widest opacity-80">
              System: {isBroadcasting ? 'ACTIVE' : 'IDLE'}
            </span>
            <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-tighter ${isOnline ? 'text-green-400' : 'text-destructive'}`}>
              {isOnline ? <Wifi className="h-2 w-2" /> : <WifiOff className="h-2 w-2" />}
              {isOnline ? 'Network: Online' : 'Network: Offline'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isBroadcasting && (
            <div className={`flex items-center gap-1 text-[10px] font-bold mr-2 ${isOnline ? 'text-primary' : 'text-destructive'}`}>
              <CloudLightning className="h-3 w-3" />
              <span>{isOnline ? 'CLOUD SYNC' : 'SYNC FAILED'}</span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => logout()} className="text-muted-foreground hover:text-white">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {!isOnline && (
        <Card className="bg-destructive/10 border-destructive/50 animate-pulse">
          <CardContent className="p-3 flex items-center gap-3 text-destructive">
            <WifiOff className="h-5 w-5 shrink-0" />
            <p className="text-xs font-bold leading-tight uppercase tracking-tight">
              INTERNET LOST. Move to high-signal area.
            </p>
          </CardContent>
        </Card>
      )}

      {telemetry.accuracy > 50 && isBroadcasting && (
        <Card className="bg-amber-500/10 border-amber-500/50">
          <CardContent className="p-3 flex items-center gap-3 text-amber-500">
            <Satellite className="h-5 w-5 shrink-0 animate-bounce" />
            <p className="text-xs font-semibold leading-tight">
              LOW GPS PRECISION (±{telemetry.accuracy.toFixed(0)}m).
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="command-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-white">BUS {driverData?.busNumber}</h2>
              <p className="text-sm text-muted-foreground font-code">{user?.email}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
              <BusIcon className="h-7 w-7" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <Card className="command-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${allowCrowdsourcing ? 'bg-muted' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                {allowCrowdsourcing ? <Users className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white">Exclusive Command</p>
                <p className="text-xs text-muted-foreground">Force official signal priority</p>
              </div>
            </div>
            {busDataLoading ? (
              <Skeleton className="h-6 w-11 rounded-full" />
            ) : (
              <Switch 
                checked={!allowCrowdsourcing} 
                onCheckedChange={(checked) => updateAuthority(!checked)}
                disabled={syncing}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="command-card">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
              <Navigation className="h-5 w-5 text-primary opacity-70" />
              <div className="text-center">
                <p className="text-2xl font-code font-bold text-white">{telemetry.speed}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">KM/H</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="command-card">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
              <Zap className="h-5 w-5 text-amber-500 opacity-70" />
              <div className="text-center">
                <p className="text-2xl font-code font-bold text-white">±{telemetry.accuracy.toFixed(0)}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">ACCURACY (M)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="command-card">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-xs font-code font-bold uppercase">Satellite Fix</span>
            </div>
            <div className="bg-background/50 rounded-lg p-3 font-code text-sm text-primary flex justify-between">
              <span>LAT: {telemetry.lat.toFixed(6)}</span>
              <span className="opacity-30">|</span>
              <span>LNG: {telemetry.lng.toFixed(6)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1" />

      <div className="pb-6">
        <Button 
          className={`w-full h-24 text-2xl font-black rounded-2xl transition-all duration-300 transform active:scale-95 shadow-2xl uppercase tracking-tighter ${
            isBroadcasting 
            ? 'bg-destructive hover:bg-destructive/90 text-white' 
            : 'bg-primary hover:bg-primary/90 text-white'
          }`}
          onClick={isBroadcasting ? stopBroadcast : startBroadcast}
        >
          {isBroadcasting ? (
            <div className="flex flex-col items-center">
              <SignalIcon className="h-8 w-8 mb-1 animate-pulse" />
              <span>Cease Transmission</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Radio className="h-8 w-8 mb-1" />
              <span>Start Transit</span>
            </div>
          )}
        </Button>
      </div>
      
      <div className="text-center pb-2 opacity-30">
        <p className="text-[10px] font-code uppercase tracking-[0.2em] font-bold">Fleet Terminal v2.9 Firestore Optimized</p>
      </div>
    </div>
  );
}