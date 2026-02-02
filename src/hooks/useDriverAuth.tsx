import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Driver {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string | null;
  unit_id: string | null;
  is_active: boolean;
}

interface DriverAuthContextType {
  user: User | null;
  session: Session | null;
  driver: Driver | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const DriverAuthContext = createContext<DriverAuthContextType | undefined>(undefined);

export const DriverAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDriverData = async (userId: string) => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching driver data:', error);
      setDriver(null);
      return;
    }
    
    setDriver(data);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        setTimeout(() => {
          fetchDriverData(session.user.id);
        }, 0);
      } else {
        setDriver(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        setTimeout(() => {
          fetchDriverData(session.user.id);
        }, 0);
      } else {
        setDriver(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setDriver(null);
  };

  return (
    <DriverAuthContext.Provider value={{ user, session, driver, loading, signIn, signOut }}>
      {children}
    </DriverAuthContext.Provider>
  );
};

export const useDriverAuth = () => {
  const context = useContext(DriverAuthContext);
  if (context === undefined) {
    throw new Error('useDriverAuth must be used within a DriverAuthProvider');
  }
  return context;
};
