import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LayoutDashboard, Brain, HelpCircle, LogOut, BrainCircuit, Users, ClipboardCheck, GraduationCap, X } from 'lucide-react';

export default function SideNavBar({ isOpen, setIsOpen }) {
  const navigate = useNavigate();
  const { logout, userRole } = useAuth();

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error("Failed to log out", err);
    }
  };

  const basePath = userRole === 'Instructor' ? '/instructor' : '/student';

  return (
    <aside className={`h-screen fixed lg:sticky top-0 left-0 w-64 flex flex-col bg-slate-50 dark:bg-slate-950 no-line-rule bg-surface-container-low py-6 space-y-2 border-r border-outline-variant/10 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="px-6 mb-10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-indigo-700 dark:text-indigo-100 font-headline uppercase tracking-tighter">NeuroClass</h1>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-1">{userRole} Portal</p>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="lg:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-outline-variant/20 dark:hover:bg-slate-800 text-on-surface-variant dark:text-slate-300">
          <X className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar px-2">
        <NavLink onClick={() => setIsOpen(false)} end to={`${basePath}/dashboard`} className={({isActive}) => `px-4 py-3 rounded-full transition-all flex items-center gap-3 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          <span className="font-['Space_Grotesk'] text-sm uppercase tracking-wider truncate">Overview</span>
        </NavLink>
        
        <NavLink onClick={() => setIsOpen(false)} to={`${basePath}/courses`} className={({isActive}) => `px-4 py-3 rounded-full transition-all flex items-center gap-3 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
          <BookOpen className="w-5 h-5 shrink-0" />
          <span className="font-['Space_Grotesk'] text-sm uppercase tracking-wider truncate">My Courses</span>
        </NavLink>

        {/* INSTRUCTOR SPECIFIC */}
        {userRole === 'Instructor' && (
          <>
            <NavLink onClick={() => setIsOpen(false)} to="/instructor/create-course" className={({isActive}) => `px-4 py-3 rounded-full transition-all flex items-center gap-3 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
              <Users className="w-5 h-5 shrink-0" />
              <span className="font-['Space_Grotesk'] text-sm uppercase tracking-wider truncate">Initialize</span>
            </NavLink>
            <NavLink onClick={() => setIsOpen(false)} to="/instructor/evaluator-training" className={({isActive}) => `px-4 py-3 rounded-full transition-all flex items-center gap-3 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
              <BrainCircuit className="w-5 h-5 shrink-0" />
              <span className="font-['Space_Grotesk'] text-sm uppercase tracking-wider truncate">AI Training</span>
            </NavLink>
            <NavLink onClick={() => setIsOpen(false)} to="/instructor/assignments" className={({isActive}) => `px-4 py-3 rounded-full transition-all flex items-center gap-3 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
              <BookOpen className="w-5 h-5 shrink-0" />
              <span className="font-['Space_Grotesk'] text-sm uppercase tracking-wider truncate">Assignments</span>
            </NavLink>
            <NavLink onClick={() => setIsOpen(false)} to="/instructor/grade-review" className={({isActive}) => `px-4 py-3 rounded-full transition-all flex items-center gap-3 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
              <ClipboardCheck className="w-5 h-5 shrink-0" />
              <span className="font-['Space_Grotesk'] text-sm uppercase tracking-wider truncate">Grade Review</span>
            </NavLink>
          </>
        )}

        {/* STUDENT SPECIFIC */}
        {userRole === 'Student' && (
          <>
            <NavLink onClick={() => setIsOpen(false)} to="/student/join-course" className={({isActive}) => `px-4 py-3 rounded-full transition-all flex items-center gap-3 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
              <Users className="w-5 h-5 shrink-0" />
              <span className="font-['Space_Grotesk'] text-sm uppercase tracking-wider truncate">Join Course</span>
            </NavLink>
            <NavLink onClick={() => setIsOpen(false)} to="/student/ai-tutor" className={({isActive}) => `px-4 py-3 rounded-full transition-all flex items-center gap-3 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
              <Brain className="w-5 h-5 shrink-0" />
              <span className="font-['Space_Grotesk'] text-sm uppercase tracking-wider truncate">AI Tutor</span>
            </NavLink>
            <NavLink onClick={() => setIsOpen(false)} to="/student/assignments" className={({isActive}) => `px-4 py-3 rounded-full transition-all flex items-center gap-3 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
               <BookOpen className="w-5 h-5 shrink-0" />
               <span className="font-['Space_Grotesk'] text-sm uppercase tracking-wider truncate">Assignments</span>
            </NavLink>
            <NavLink onClick={() => setIsOpen(false)} to="/student/grades" className={({isActive}) => `px-4 py-3 rounded-full transition-all flex items-center gap-3 ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
               <GraduationCap className="w-5 h-5 shrink-0" />
               <span className="font-['Space_Grotesk'] text-sm uppercase tracking-wider truncate">Grades</span>
            </NavLink>
          </>
        )}

      </nav>
      <div className="px-4 mt-auto">
        <div className="mt-6 border-t border-outline-variant/10 pt-4">
          <a href="#" onClick={handleLogout} className="text-slate-600 dark:text-slate-300 px-4 py-3 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-full transition-all flex items-center gap-3 cursor-pointer">
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="font-['Space_Grotesk'] text-sm font-semibold uppercase tracking-wider truncate">Logout</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
