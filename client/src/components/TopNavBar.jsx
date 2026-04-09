import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Bell, Menu } from 'lucide-react';
import { aiService } from '../services/aiService';

export default function TopNavBar({ onToggleSidebar }) {
  const location = useLocation();
  const { currentUser, userRole, switchRole } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openNotif, setOpenNotif] = useState(false);

  const refreshNotifications = async () => {
    if (!currentUser?.uid) return;
    try {
      const data = await aiService.fetchNotifications(currentUser.uid);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.warn('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    if (!currentUser?.uid) return undefined;

    const loadNotifications = async () => {
      try {
        const data = await aiService.fetchNotifications(currentUser.uid);
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } catch (error) {
        console.warn('Failed to fetch notifications', error);
      }
    };

    const kickoff = setTimeout(() => {
      loadNotifications();
    }, 0);
    const timer = setInterval(loadNotifications, 20000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(timer);
    };
  }, [currentUser?.uid]);

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
          <button
            onClick={() => setOpenNotif((prev) => !prev)}
            className="w-10 h-10 rounded-full hover:bg-indigo-50/50 dark:hover:bg-slate-800 flex items-center justify-center transition-all relative hidden sm:flex"
          >
            <Bell className="text-on-surface-variant dark:text-slate-300 w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-error text-white text-[10px] rounded-full ring-2 ring-white dark:ring-slate-900">{unreadCount}</span>}
          </button>
          {openNotif && (
            <div className="absolute right-8 top-16 w-80 max-h-96 overflow-y-auto rounded-xl border border-outline-variant/20 bg-white dark:bg-slate-900 shadow-xl p-2 z-50">
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Notifications</div>
              {notifications.length === 0 && (
                <div className="px-3 py-4 text-sm text-on-surface-variant dark:text-slate-400">No notifications yet.</div>
              )}
              {notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={async () => {
                    if (!item.readStatus) {
                      await aiService.markNotificationRead(item.id);
                      refreshNotifications();
                    }
                  }}
                  className={`w-full text-left px-3 py-3 rounded-lg hover:bg-surface-container-low dark:hover:bg-slate-800 transition-colors ${item.readStatus ? 'opacity-70' : 'bg-indigo-50/60 dark:bg-indigo-950/30'}`}
                >
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.message}</p>
                  <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}
          
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
