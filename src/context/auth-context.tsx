
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useUser, useFirestore, useAuth as useFirebaseAuth } from '@/firebase';

interface DriverData {
  busId: string; // The Actual Firestore Document ID
  busNumber: string; // The human-readable number (e.g., "101")
  verified: boolean;
  masterBroadcastEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  driverData: DriverData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const db = useFirestore();
  const auth = useFirebaseAuth();
  
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;

    if (!user?.email) {
      setDriverData(null);
      setLoading(false);
      return;
    }

    // 1. Listen to branding settings to find the driver's assigned bus number
    const unsubscribeBranding = onSnapshot(doc(db, 'settings', 'branding'), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const verifiedDrivers = data.verifiedDrivers || [];
        const masterEnabled = data.masterBroadcastEnabled ?? false;
        
        const userEmail = user.email!.toLowerCase();
        const driverInfo = verifiedDrivers.find((d: any) => 
          d.email.toLowerCase() === userEmail
        );
        
        if (driverInfo) {
          // 2. Resolve the "Actual Firestore ID" for this bus number
          const busesRef = collection(db, 'buses');
          const q = query(busesRef, where('bus_number', '==', driverInfo.busNumber), limit(1));
          const busQuerySnapshot = await getDocs(q);
          
          let busId = driverInfo.busNumber; // Fallback to number if doc not found
          if (!busQuerySnapshot.empty) {
            busId = busQuerySnapshot.docs[0].id;
          }

          setDriverData({
            busId: busId,
            busNumber: driverInfo.busNumber,
            verified: true,
            masterBroadcastEnabled: masterEnabled
          });
        } else {
          setDriverData(null);
        }
      } else {
        setDriverData(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching branding settings:", error);
      setLoading(false);
    });

    return () => unsubscribeBranding();
  }, [user, userLoading, db]);

  const logout = async () => {
    await signOut(auth);
  };

  const value = useMemo(() => ({
    user,
    driverData,
    loading: userLoading || loading,
    logout
  }), [user, driverData, userLoading, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
