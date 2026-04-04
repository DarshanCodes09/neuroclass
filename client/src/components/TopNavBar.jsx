import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Bell, Settings, User, Menu } from 'lucide-react';

export default function TopNavBar({ onToggleSidebar }) {
  const location = useLocation();
  const { currentUser, userRole, switchRole } = useAuth();
  const basePath = userRole === 'Instructor' ? '/instructor' : '/student';

  // Simple title mapping based on route
  const getPageTitle = () => {
    if (location.pathname.includes('/dashboard')) return 'Overview';
    if (location.pathname.includes('/create-course')) return 'Initialize Course';
    if (location.pathname.includes('/evaluator-training')) return 'AI Evaluator Training';
    if (location.pathname.includes('/ai-tutor')) return 'NeuroClass AI Tutor';
    if (location.pathname.includes('/courses')) return 'Course Directory';
    if (location.pathname.includes('/join-course')) return 'Join Course';
    if (location.pathname.includes('/assignments')) return 'Assignments';
    if (location.pathname.includes('/grade-review')) return 'Grade Review';
    if (location.pathname.includes('/grades')) return 'Academic Transcripts';
    return 'Dashboard';
  };

  return (
    <header className="w-full sticky top-0 z-40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm shadow-indigo-500/5">
      <div className="flex justify-between items-center px-4 md:px-8 py-4 w-full max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={onToggleSidebar}
            className="lg:hidden w-10 h-10 flex flex-col items-center justify-center rounded-full bg-surface-container-low dark:bg-slate-800 hover:bg-surface-container dark:hover:bg-slate-700 transition-colors text-on-surface dark:text-slate-200">
            <Menu className="w-5 h-5" />
          </button>
          
          <span className="text-indigo-700 dark:text-indigo-100 font-headline text-xl md:text-2xl font-bold tracking-tighter truncate max-w-[150px] md:max-w-none">{getPageTitle()}</span>
          
          <div className="relative hidden md:block">
            <input 
              type="text" 
              placeholder="Search knowledge base..." 
              className="bg-surface-container-low dark:bg-slate-800 dark:text-slate-200 border-none rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-fixed w-64 md:w-80 font-body transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-slate-400 w-4 h-4" />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <button className="w-10 h-10 rounded-full hover:bg-indigo-50/50 dark:hover:bg-slate-800 flex items-center justify-center transition-all relative hidden sm:flex">
            <Bell className="text-on-surface-variant dark:text-slate-300 w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-white dark:ring-slate-900"></span>
          </button>
          
          {currentUser && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  if (typeof switchRole === 'function') switchRole();
                }}
                className="hidden sm:flex items-center justify-center px-3 py-1 text-[10px] font-bold uppercase tracking-widest border border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-300 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors mr-2"
                title="Dev Tool: Swap Role"
              >
                Swap Role
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-none">{currentUser.displayName || currentUser.email?.split('@')[0]}</p>
                <p className="text-[10px] text-primary dark:text-indigo-400 font-bold uppercase tracking-widest leading-none mt-1">{userRole}</p>
              </div>
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt="User profile avatar" 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover ring-2 ring-primary/10 cursor-pointer hover:ring-primary/40 transition-all shrink-0" 
                />
              ) : (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 ring-2 ring-primary/10 cursor-pointer hover:ring-primary/40 transition-all font-bold shrink-0">
                  {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
