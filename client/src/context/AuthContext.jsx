/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchUserRole(uid) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single();
        
      if (data) {
        // Map database teacher to ui Instructor
        return data.role === 'teacher' ? 'Instructor' : (data.role === 'admin' ? 'Admin' : 'Student');
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
    return 'Student'; // default role
  }

  async function upsertUserRole(user, preferredRole) {
    const fallbackRole = preferredRole || 'Student';
    const dbRole = fallbackRole === 'Instructor' ? 'teacher' : 'student';
    
    const payload = {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      role: dbRole,
    };
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('role')
      .single();
    if (error) {
      console.error('Error upserting user role:', error);
      return fallbackRole;
    }
    return data?.role === 'teacher' ? 'Instructor' : 'Student';
  }

  async function resolveUserRole(user, preferredRole = null) {
    if (!user) return null;
    if (preferredRole) {
      return upsertUserRole(user, preferredRole);
    }
    return fetchUserRole(user.id);
  }

  async function signup(email, password, role = 'Student', name = '') {
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    
    if (user) {
      const dbRole = role === 'Instructor' ? 'teacher' : 'student';
      // Create user document in Supabase public.profiles
      await supabase.from('profiles').upsert([{
        id: user.id,
        full_name: name || email.split('@')[0],
        role: dbRole
      }], { onConflict: 'id' });
    }
    
    return { user };
  }

  async function login(email, password, preferredRole = null) {
    if (preferredRole) {
      localStorage.setItem('neuroclass-preferred-role', preferredRole);
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      localStorage.removeItem('neuroclass-preferred-role');
      throw error;
    }
    if (data?.user && preferredRole) {
      await upsertUserRole(data.user, preferredRole);
    }
    return data;
  }

  async function loginWithGoogle(preferredRole = 'Student') {
    localStorage.setItem('neuroclass-preferred-role', preferredRole);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) throw error;
    return data;
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  useEffect(() => {
    let isMounted = true;

    // Fail-safe: never allow auth bootstrap to keep the app blank forever.
    const fallbackTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 4000);

    // Initial session loading
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      const user = session?.user || null;
      if (user) {
        // Map user properties dynamically to match original Firebase implementation partially
        user.displayName = user.user_metadata?.full_name || user.email?.split('@')[0];
        user.photoURL = user.user_metadata?.avatar_url;
        user.uid = user.id;

        const preferredRole = localStorage.getItem('neuroclass-preferred-role');
        if (preferredRole) localStorage.removeItem('neuroclass-preferred-role');
        resolveUserRole(user, preferredRole).then(role => {
          if (!isMounted) return;
          setUserRole(role);
          setCurrentUser(user);
          setLoading(false);
          clearTimeout(fallbackTimer);
        });
      } else {
        setUserRole(null);
        setCurrentUser(null);
        setLoading(false);
        clearTimeout(fallbackTimer);
      }
    }).catch((err) => {
      console.error("Supabase GenSession Error:", err);
      if (isMounted) setLoading(false);
      clearTimeout(fallbackTimer);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user || null;
      if (user) {
        user.displayName = user.user_metadata?.full_name || user.email?.split('@')[0];
        user.photoURL = user.user_metadata?.avatar_url;
        user.uid = user.id;

        const preferredRole = localStorage.getItem('neuroclass-preferred-role');
        if (preferredRole) localStorage.removeItem('neuroclass-preferred-role');
        const role = await resolveUserRole(user, preferredRole);
        setUserRole(role);
      } else {
        setUserRole(null);
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      subscription?.unsubscribe();
    };
  // Role sync relies on auth events and intentionally runs once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchRole() {
    if (!currentUser) return;
    const newRole = userRole === 'Instructor' ? 'Student' : 'Instructor';
    const dbRole = newRole === 'Instructor' ? 'teacher' : 'student';
    setUserRole(newRole);
    await supabase.from('profiles').update({ role: dbRole }).eq('id', currentUser.id);
  }

  const value = {
    currentUser,
    userRole,
    login,
    signup,
    loginWithGoogle,
    logout,
    switchRole
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
