"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

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
  const [user, setUser] = useState<User | null>(null);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser && currentUser.email) {
        try {
          const brandingDoc = await getDoc(doc(db, 'settings', 'branding'));
          if (brandingDoc.exists()) {
            const data = brandingDoc.data();
            const verifiedDrivers = data.verifiedDrivers || [];
            const driverInfo = verifiedDrivers.find((d: any) => d.email === currentUser.email);
            
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
          console.error("Error verifying driver:", error);
          setDriverData(null);
        }
      } else {
        setDriverData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, driverData, loading, logout }}>
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