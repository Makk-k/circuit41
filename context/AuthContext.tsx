import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user:    User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user:    null,
  loading: true,
  signOut: async () => {},
});

// Checks whether a restored session belongs to a deleted account.
// Called once on mount before setting state, so the app never renders
// an authenticated screen for a banned user.
async function enforceNotDeleted(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('account_status')
    .eq('id', userId)
    .maybeSingle();

  return data?.account_status === 'deleted';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const isDeleted = await enforceNotDeleted(session.user.id);
        if (isDeleted) {
          // Sign out silently — onAuthStateChange fires next and sets
          // session/user to null, which redirects the app to Welcome.
          await supabase.auth.signOut();
          Alert.alert('Account deleted', 'This account has been deleted.');
          return;
        }
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
