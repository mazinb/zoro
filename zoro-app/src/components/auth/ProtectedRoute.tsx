'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'planner' | 'admin';
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  redirectTo = '/login'
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo);
    } else if (!loading && user && requiredRole) {
      const userRole = user.role || 'user';
      const roleHierarchy: Record<string, number> = {
        user: 1,
        planner: 2,
        admin: 3,
      };
      
      if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
        router.push('/checkin'); // Redirect to checkin if insufficient permissions
      }
    }
  }, [user, loading, requiredRole, redirectTo, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  if (requiredRole) {
    const userRole = user.role || 'user';
    const roleHierarchy: Record<string, number> = {
      user: 1,
      planner: 2,
      admin: 3,
    };
    
    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      return null; // Will redirect
    }
  }

  return <>{children}</>;
};

