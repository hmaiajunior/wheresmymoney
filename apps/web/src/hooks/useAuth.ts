'use client';

import { useState, useEffect } from 'react';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('wmm_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('wmm_user');
      }
    }
    setLoading(false);
  }, []);

  const login = (token: string, userData: AuthUser) => {
    localStorage.setItem('wmm_token', token);
    localStorage.setItem('wmm_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('wmm_token');
    localStorage.removeItem('wmm_user');
    setUser(null);
  };

  return { user, loading, login, logout };
}
