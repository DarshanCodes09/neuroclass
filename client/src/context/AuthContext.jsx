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
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', uid)
        .single();
        
      if (data) {
        return data.role;
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
    return 'Student'; // default role
  }

  async function signup(email, password, role = 'Student', name = '') {
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    
    if (user) {
      // Create user document in Supabase public.users
      await supabase.from('users').insert([{
        id: user.id,
        email: user.email,
        name: name || email.split('@')[0],
        role: role
      }]);
    }
    
    return { user };
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function loginWithGoogle(role = 'Student') {
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
    // Initial session loading
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user || null;
      if (user) {
        // Map user properties dynamically to match original Firebase implementation partially
        user.displayName = user.user_metadata?.full_name || user.email?.split('@')[0];
        user.photoURL = user.user_metadata?.avatar_url;
        user.uid = user.id;
        
        fetchUserRole(user.id).then(role => {
          setUserRole(role);
          setCurrentUser(user);
          setLoading(false);
        });
      } else {
        setUserRole(null);
        setCurrentUser(null);
        setLoading(false);
      }
    }).catch((err) => {
      console.error("Supabase GenSession Error:", err);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      if (user) {
        user.displayName = user.user_metadata?.full_name || user.email?.split('@')[0];
        user.photoURL = user.user_metadata?.avatar_url;
        user.uid = user.id;

        const role = await fetchUserRole(user.id);
        setUserRole(role);
      } else {
        setUserRole(null);
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  async function switchRole() {
    if (!currentUser) return;
    const newRole = userRole === 'Instructor' ? 'Student' : 'Instructor';
    setUserRole(newRole);
    await supabase.from('users').update({ role: newRole }).eq('id', currentUser.id);
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
