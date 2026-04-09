import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Key } from 'lucide-react';
import { aiService } from '../services/aiService';

export default function JoinCourse() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-character course code.');
      return;
    }

    try {
      setLoading(true);
      await aiService.joinCourse({ courseCode: code.toUpperCase(), studentId: currentUser.uid });
      navigate('/student/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to join course. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface dark:bg-slate-950 min-h-[calc(100vh-80px)]">
      <div className="max-w-md w-full glass-card p-10 rounded-2xl border border-outline-variant/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 primary-gradient"></div>
        
        <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center mb-8 mx-auto shadow-inner text-primary">
          <Key className="w-8 h-8" />
        </div>

        <h2 className="text-3xl font-black font-headline text-center mb-2 text-on-surface">Join Course</h2>
        <p className="text-on-surface-variant text-center text-sm mb-8">Enter the 6-character access code provided by your instructor to sync your academic profile.</p>

        {error && (
          <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm font-semibold mb-6 flex items-center justify-center">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Access Code</label>
            <input 
              type="text" 
              maxLength="6"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. X7AB9Q" 
              className="w-full bg-surface-container-low border-none rounded-xl p-4 focus:ring-2 ring-primary/20 text-on-surface font-headline font-bold text-center tracking-[0.5em] uppercase placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || code.length !== 6}
            className="w-full btn-gradient py-4 rounded-xl text-white font-headline font-bold uppercase tracking-widest text-sm shadow-xl shadow-primary/20 hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:transform-none">
            {loading ? 'Authenticating...' : 'Sync Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
