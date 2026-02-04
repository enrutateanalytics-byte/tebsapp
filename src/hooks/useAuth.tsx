import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isSupervisor: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from('administrators')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    setIsAdmin(!!data);
  };

  const checkSupervisorStatus = async (userId: string) => {
    const { data } = await supabase
      .from('supervisors')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    
    setIsSupervisor(!!data);
  };

  const checkUserRoles = async (userId: string) => {
    // Check both roles in parallel
    await Promise.all([
      checkAdminStatus(userId),
      checkSupervisorStatus(userId)
    ]);
  };

  useEffect(() => {
    let isMounted = true;

    // Listener para cambios CONTINUOS de auth (NO controla loading)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      // Fire and forget - no await, no loading
      if (session?.user) {
        setTimeout(() => {
          checkUserRoles(session.user.id);
        }, 0);
      } else {
        setIsAdmin(false);
        setIsSupervisor(false);
      }
    });

    // Carga INICIAL (controla loading)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        // Verificar roles ANTES de quitar loading
        if (session?.user) {
          await checkUserRoles(session.user.id);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    });
    
    if (!error && data.user) {
      // Usar función SECURITY DEFINER para registrar primer admin
      await supabase.rpc('register_first_admin', {
        p_user_id: data.user.id,
        p_email: email
      });
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isSupervisor, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
