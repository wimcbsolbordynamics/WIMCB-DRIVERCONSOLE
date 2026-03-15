
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useUser, useFirestore, useAuth as useFirebaseAuth } from '@/firebase';

interface DriverData {
  busNumber: string;
  verified: boolean;
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

    const verifyDriver = async () => {
      if (user?.email) {
        try {
          const brandingDoc = await getDoc(doc(db, 'settings', 'branding'));
          if (brandingDoc.exists()) {
            const data = brandingDoc.data();
            const verifiedDrivers = data.verifiedDrivers || [];
            const driverInfo = verifiedDrivers.find((d: any) => d.email === user.email);
            
            if (driverInfo) {
              setDriverData({
                busNumber: driverInfo.busNumber,
                verified: true
              });
            } else {
              setDriverData(null);
            }
          }
        } catch (error) {
          setDriverData(null);
        }
      } else {
        setDriverData(null);
      }
      setLoading(false);
    };

    verifyDriver();
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
