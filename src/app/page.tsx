"use client";

import dynamic from 'next/dynamic';
import { useAuth } from '@/context/auth-context';
import { DriverLogin } from '@/components/driver/login';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Dynamically import Dashboard to avoid Capacitor module resolution issues during SSR
const DriverDashboard = dynamic(
  () => import('@/components/driver/dashboard').then((mod) => mod.DriverDashboard),
  { 
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-code text-sm font-bold tracking-widest text-primary uppercase">Loading Command...</p>
        </div>
      </div>
    )
  }
);

export default function Home() {
  const { user, driverData, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_20px_rgba(37,99,235,0.4)]" />
          <p className="font-code text-sm font-bold tracking-widest text-primary uppercase animate-pulse">Initializing Terminal</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <DriverLogin />;
  }

  if (user && !driverData) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/50 bg-card/80 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldAlert className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground">
              User <span className="font-code text-white">{user.email}</span> is not found in the verified drivers directory. Please contact dispatch to register your account.
            </p>
            <Button variant="outline" className="w-full" onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Switch Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DriverDashboard />;
}