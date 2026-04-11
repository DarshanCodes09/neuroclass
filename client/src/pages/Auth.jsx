import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Brain, Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Default to student sign up for reality, but let's allow a toggle if we wanted
  const [isSignUp, setIsSignUp] = useState(false);
  const [selectedSignupRole, setSelectedSignupRole] = useState('Student'); 
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, signup, loginWithGoogle, currentUser, userRole } = useAuth();
  const navigate = useNavigate();

  // Watch for authenticated state to redirect automatically
  useEffect(() => {
    // If we have a pending role resolution in localStorage, wait for context to catch up
    const pendingRole = localStorage.getItem('neuroclass-preferred-role');
    if (currentUser && userRole && !pendingRole) {
      navigate(`/${userRole.toLowerCase()}/dashboard`);
    }
  }, [currentUser, userRole, navigate]);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      if (isSignUp) {
        await signup(email, password, selectedSignupRole);
      } else {
        await login(email, password, selectedSignupRole);
      }
      // Not navigating here. useEffect handles it securely once userRole is determined.
    } catch (err) {
      setError('Failed to authenticate: ' + err.message);
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle(selectedSignupRole); 
    } catch (err) {
      setError('Failed to sign in with Google: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex flex-col items-center justify-center p-6 selection:bg-primary-fixed relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px]"></div>
      </div>
      
      {/* Main Auth Container */}
      <main className="w-full max-w-[480px] z-10">
        {/* Brand Identity */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-16 h-16 primary-gradient rounded-xl flex items-center justify-center shadow-[0_12px_40px_rgba(53,37,205,0.25)] mb-6 rotate-3">
            <Brain className="text-white w-8 h-8" />
          </div>
          <h1 className="font-headline font-black text-4xl tracking-tighter text-on-surface">NeuroClass</h1>
          <p className="text-on-surface-variant font-medium mt-2">Autonomous AI Classroom Management</p>
        </div>
        
        {/* Auth Card */}
        <div className="surface-container-lowest glass-panel rounded-xl shadow-[0_40px_80px_rgba(25,28,30,0.06)] p-10 md:p-12 border border-white/40">
          <h2 className="font-headline font-bold text-2xl mb-8 tracking-tight">{isSignUp ? 'Create Workspace' : 'Welcome back'}</h2>
          
          {error && <div className="p-3 mb-6 bg-error/10 text-error text-sm rounded-lg border border-error/20 font-medium">{error}</div>}

          {/* Role Selector (Applies to both Google Auth and Email Auth) */}
          <div className="space-y-3 mb-8 bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
            <label className="font-label text-xs font-bold uppercase tracking-widest text-on-surface flex items-center justify-center">I am a...</label>
            <div className="flex justify-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-surface-container rounded-lg transition-colors">
                <input type="radio" value="Student" checked={selectedSignupRole === 'Student'} onChange={(e) => setSelectedSignupRole(e.target.value)} className="text-primary focus:ring-primary w-4 h-4" />
                <span className="text-sm font-bold text-on-surface">Student</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-surface-container rounded-lg transition-colors">
                <input type="radio" value="Instructor" checked={selectedSignupRole === 'Instructor'} onChange={(e) => setSelectedSignupRole(e.target.value)} className="text-primary focus:ring-primary w-4 h-4" />
                <span className="text-sm font-bold text-on-surface">Instructor</span>
              </label>
            </div>
          </div>

          {/* Social Provider */}
          <button 
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/30 py-4 rounded-full transition-all duration-300 shadow-sm active:scale-[0.98] disabled:opacity-50">
            <svg height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"></path>
            </svg>
            <span className="font-semibold text-sm tracking-wide">Continue with Google</span>
          </button>
          
          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/30"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] font-bold text-outline">
              <span className="px-4 bg-white/0 backdrop-blur-none" style={{backgroundColor: 'transparent'}}>Or use email</span>
            </div>
          </div>
          
          {/* Email Form */}
          <form className="space-y-6" onSubmit={handleEmailAuth}>

            <div className="space-y-2">
              <label className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-4" htmlFor="email">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                <input 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary/20 rounded-full py-4 pl-14 pr-6 text-on-surface placeholder:text-outline/50 transition-all duration-300" 
                  id="email" 
                  placeholder="name@company.com" 
                  type="email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-4">
                <label className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="password">Password</label>
                {!isSignUp && <a className="text-xs font-bold text-primary hover:text-secondary transition-colors" href="#">Forgot?</a>}
              </div>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                <input 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary/20 rounded-full py-4 pl-14 pr-6 text-on-surface placeholder:text-outline/50 transition-all duration-300" 
                  id="password" 
                  placeholder="••••••••" 
                  type={showPassword ? "text" : "password"}
                />
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors" 
                  type="button">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            {/* Submit Action */}
            <button 
              disabled={loading}
              type="submit" 
              className="block w-full text-center primary-gradient text-white font-bold py-5 rounded-full shadow-[0_12px_32px_rgba(53,37,205,0.2)] hover:shadow-[0_16px_40px_rgba(53,37,205,0.3)] transition-all duration-300 active:scale-95 mt-4 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {isSignUp ? 'Create Account' : 'Sign In to Workspace'}
            </button>
          </form>
          
          {/* Footer Link */}
          <div className="mt-10 text-center">
            <p className="text-on-surface-variant text-sm">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"} 
              <button 
                onClick={(e) => { e.preventDefault(); setIsSignUp(!isSignUp); setError(''); }}
                className="text-primary font-bold hover:text-secondary transition-all decoration-2 underline-offset-4 hover:underline ml-1">
                {isSignUp ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </div>
        </div>
        
        {/* Bottom Metadata */}
        <footer className="mt-8 flex justify-between px-6 text-[10px] font-bold uppercase tracking-[0.15em] text-outline">
          <div className="flex gap-4">
            <a className="hover:text-primary transition-colors" href="#">Privacy</a>
            <a className="hover:text-primary transition-colors" href="#">Terms</a>
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" />
            Secure Environment
          </div>
        </footer>
      </main>
      
      {/* Side Decoration (Editorial Style) */}
      <div className="fixed right-12 bottom-12 hidden lg:block max-w-[200px] text-right z-10">
        <div className="h-px w-12 bg-outline-variant ml-auto mb-4"></div>
        <p className="font-headline text-lg font-bold leading-tight text-on-surface-variant">
          Precision engineering for the <span className="text-primary">neural era.</span>
        </p>
      </div>
    </div>
  );
}
