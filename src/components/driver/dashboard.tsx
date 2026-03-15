
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useFirestore } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
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
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function DriverDashboard() {
  const { user, driverData, logout } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [telemetry, setTelemetry] = useState({
    lat: 0,
    lng: 0,
    speed: 0,
    accuracy: 0,
    status: 'OFFLINE'
  });
  const [allowCrowdsourcing, setAllowCrowdsourcing] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  const watchId = useRef<number | null>(null);

  // Sync "Exclusive Command" (allow_crowdsourcing) status from Firestore
  useEffect(() => {
    if (driverData?.busNumber) {
      const busRef = doc(db, 'buses', driverData.busNumber);
      const unsubscribe = onSnapshot(busRef, (snapshot) => {
        if (snapshot.exists()) {
          setAllowCrowdsourcing(snapshot.data().allow_crowdsourcing ?? true);
        }
      }, (err) => {
        const permissionError = new FirestorePermissionError({
          path: busRef.path,
          operation: 'get'
        });
        errorEmitter.emit('permission-error', permissionError);
      });
      return () => unsubscribe();
    }
  }, [driverData, db]);

  const cleanupSignal = useCallback(async () => {
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

  const updateAuthority = async (val: boolean) => {
    if (!driverData) return;
    setSyncing(true);
    const busRef = doc(db, 'buses', driverData.busNumber);
    
    // Using setDoc with merge ensures the bus document is created if it doesn't exist.
    // This allows the Exclusive Command to act as the primary configuration source.
    setDoc(busRef, {
      allow_crowdsourcing: val,
      bus_number: driverData.busNumber
    }, { merge: true }).then(() => {
      toast({ 
        title: val ? "Crowdsourcing Restored" : "Exclusive Command Active",
        description: val ? "Student data is now accepted." : "Fleet is now locked to official signals."
      });
    }).catch(async () => {
      const permissionError = new FirestorePermissionError({
        path: busRef.path,
        operation: 'write',
        requestResourceData: { allow_crowdsourcing: val }
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({ title: "Failed to update authority", variant: "destructive" });
    }).finally(() => {
      setSyncing(false);
    });
  };

  const startBroadcast = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast({ title: "GPS Not Supported", variant: "destructive" });
      return;
    }

    setIsBroadcasting(true);
    setTelemetry(prev => ({ ...prev, status: 'LIVE' }));

    watchId.current = window.navigator.geolocation.watchPosition(
      (pos) => {
        const speedKmh = pos.coords.speed ? (pos.coords.speed * 3.6).toFixed(1) : "0.0";
        
        const currentTelemetry = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: parseFloat(speedKmh),
          accuracy: pos.coords.accuracy,
          status: 'LIVE'
        };
        
        setTelemetry(currentTelemetry);

        if (user && driverData) {
          const signalRef = doc(db, 'buses', driverData.busNumber, 'signals', user.uid);
          const signalData = {
            uid: user.uid,
            email: user.email,
            bus_id: driverData.busNumber,
            bus_number: driverData.busNumber,
            location: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            },
            speed: parseFloat(speedKmh),
            accuracy: pos.coords.accuracy,
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
      },
      (err) => {
        toast({ title: "GPS Error", description: err.message, variant: "destructive" });
        stopBroadcast();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [user, driverData, db, toast]);

  const stopBroadcast = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setIsBroadcasting(false);
    setTelemetry(prev => ({ ...prev, status: 'OFFLINE' }));
    cleanupSignal();
  }, [cleanupSignal]);

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  const handleLogout = async () => {
    stopBroadcast();
    await logout();
  };

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between pt-2 px-2">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${isBroadcasting ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`} />
          <span className="text-xs font-code font-bold uppercase tracking-widest opacity-80">
            Signal: {isBroadcasting ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-white">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {!driverData?.masterBroadcastEnabled && (
        <Card className="bg-amber-500/10 border-amber-500/50">
          <CardContent className="p-3 flex items-center gap-3 text-amber-500">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-xs font-semibold leading-tight">
              Global Master Broadcast is currently DISABLED. Your signal may be ignored by student trackers.
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
                <p className="text-xs text-muted-foreground">Override student crowd data</p>
              </div>
            </div>
            <Switch 
              checked={!allowCrowdsourcing} 
              onCheckedChange={(checked) => updateAuthority(!checked)}
              disabled={syncing}
            />
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
              <span className="text-xs font-code font-bold uppercase">Current Coordinates</span>
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
            ? 'bg-destructive hover:bg-destructive/90 text-white status-glow-offline border-2 border-white/10' 
            : 'bg-primary hover:bg-primary/90 text-white status-glow-live border-2 border-primary-foreground/10'
          }`}
          onClick={isBroadcasting ? stopBroadcast : startBroadcast}
        >
          {isBroadcasting ? (
            <div className="flex flex-col items-center">
              <SignalIcon className="h-8 w-8 mb-1 animate-pulse" />
              <span>Terminate Signal</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Radio className="h-8 w-8 mb-1" />
              <span>Initiate Broadcast</span>
            </div>
          )}
        </Button>
      </div>
      
      <div className="text-center pb-2 opacity-30 select-none pointer-events-none">
        <p className="text-[10px] font-code uppercase tracking-[0.2em] font-bold">WIMCB Official Driver Terminal v2.2</p>
      </div>
    </div>
  );
}
