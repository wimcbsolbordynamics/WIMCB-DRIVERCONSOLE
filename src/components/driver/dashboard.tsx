
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useFirestore } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Radio, 
  MapPin, 
  Navigation, 
  LogOut, 
  Signal, 
  Users, 
  ShieldCheck,
  Zap,
  Bus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    if (driverData?.busNumber) {
      const fetchBusSettings = async () => {
        const busRef = doc(db, 'buses', driverData.busNumber);
        const busDoc = await getDoc(busRef);
        if (busDoc.exists()) {
          setAllowCrowdsourcing(busDoc.data().allow_crowdsourcing ?? true);
        }
      };
      fetchBusSettings();
    }
  }, [driverData, db]);

  const cleanupSignal = useCallback(async () => {
    if (user && driverData) {
      try {
        await deleteDoc(doc(db, 'buses', driverData.busNumber, 'signals', user.uid));
      } catch (e) {
        // Silently fail cleanup
      }
    }
  }, [user, driverData, db]);

  const updateAuthority = async (val: boolean) => {
    if (!driverData) return;
    setSyncing(true);
    try {
      await updateDoc(doc(db, 'buses', driverData.busNumber), {
        allow_crowdsourcing: val
      });
      setAllowCrowdsourcing(val);
      toast({ title: val ? "Crowdsourcing Enabled" : "Full Authority Mode Active" });
    } catch (e) {
      toast({ title: "Failed to update authority", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const startBroadcast = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast({ title: "GPS Not Supported", variant: "destructive" });
      return;
    }

    setIsBroadcasting(true);
    setTelemetry(prev => ({ ...prev, status: 'LIVE' }));

    watchId.current = window.navigator.geolocation.watchPosition(
      async (pos) => {
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
          setDoc(doc(db, 'buses', driverData.busNumber, 'signals', user.uid), {
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
          });
        }
      },
      (err) => {
        toast({ title: "GPS Error", description: err.message, variant: "destructive" });
        stopBroadcast();
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
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
      cleanupSignal();
    };
  }, [cleanupSignal]);

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

      <Card className="command-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-white">BUS {driverData?.busNumber}</h2>
              <p className="text-sm text-muted-foreground font-code">{user?.email}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
              <Bus className="h-7 w-7" />
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
              <Signal className="h-8 w-8 mb-1 animate-pulse" />
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
        <p className="text-[10px] font-code uppercase tracking-[0.2em] font-bold">WIMCB Official Driver Terminal v2.1</p>
      </div>
    </div>
  );
}
