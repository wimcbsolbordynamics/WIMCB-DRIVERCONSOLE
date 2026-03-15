
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useUser, useFirestore, useAuth as useFirebaseAuth } from '@/firebase';

interface DriverData {
  busNumber: string;
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

    // Use a listener for settings so we get real-time updates for masterBroadcastEnabled
    const unsubscribe = onSnapshot(doc(db, 'settings', 'branding'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const verifiedDrivers = data.verifiedDrivers || [];
        const masterEnabled = data.masterBroadcastEnabled ?? false;
        
        const userEmail = user.email!.toLowerCase();
        const driverInfo = verifiedDrivers.find((d: any) => 
          d.email.toLowerCase() === userEmail
        );
        
        if (driverInfo) {
          setDriverData({
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

    return () => unsubscribe();
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
