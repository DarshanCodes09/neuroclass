import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, BarChart2, Library, Plus, Copy } from 'lucide-react';
import { aiService } from '../services/aiService';

export default function InstructorDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  
  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Professor';

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const fetchCourses = async () => {
      try {
        const data = await aiService.fetchCourses({ instructorId: currentUser.uid });
        if (!cancelled) setCourses(data.courses || []);
      } catch (error) {
        console.error('Failed to load dashboard courses:', error);
      }
    };
    fetchCourses();
    const interval = setInterval(fetchCourses, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser]);

  return (
    <div className="px-12 py-10 max-w-screen-2xl mx-auto">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface">Instructor Hub</h2>
          <p className="text-on-surface-variant font-medium mt-1">Welcome back, {displayName}. Ready to orchestrate your courses?</p>
        </div>
        <button 
          onClick={() => navigate('/instructor/create-course')}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-primary-fixed/20 hover:bg-primary-fixed/40 transition-colors text-primary border border-primary/10">
          <Plus className="w-5 h-5 mb-1" />
          <span className="text-[10px] uppercase font-bold tracking-widest">New Module</span>
        </button>
      </div>
      
      <div className="grid grid-cols-12 gap-8">
        
        {/* Core Spotlight */}
        <section className="col-span-12 lg:col-span-8 relative group">
          <div className="absolute inset-0 primary-gradient rounded-xl opacity-10 group-hover:opacity-15 transition-opacity blur-2xl -z-10"></div>
          <div className="glass-card rounded-xl p-10 border border-outline-variant/10 shadow-sm relative overflow-hidden h-full flex items-center">
            <div className="flex flex-col md:flex-row justify-between items-start gap-8 w-full">
              <div className="max-w-md">
                <span className="bg-primary-fixed text-on-primary-fixed-variant px-4 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-6 inline-block">Featured Tool</span>
                <h3 className="text-3xl font-bold font-headline mb-4">AI Evaluator Calibration</h3>
                <p className="text-on-surface-variant leading-relaxed mb-8">Train the NeuroClass grading engine to mimic your exact evaluation style by uploading rubrics and gold standard submissions.</p>
                <Link to="/instructor/evaluator-training" className="px-8 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow">
                  Train AI Engine
                </Link>
              </div>

            </div>
          </div>
        </section>
        
        {/* Quick Stats */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 flex flex-col justify-between h-full">
            <div>
              <h4 className="text-lg font-bold font-headline mb-2">Teaching Metrics</h4>
              <p className="text-sm text-on-surface-variant mb-6">Fall Semester 2024</p>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-semibold">Active Courses</span>
                <span className="text-2xl font-bold font-headline text-primary">{courses.length}</span>
              </div>
              <div className="flex justify-between items-end mt-4">
                <span className="text-sm font-semibold">Total Students</span>
                <span className="text-2xl font-bold font-headline text-secondary">{courses.reduce((acc, curr) => acc + (curr.students?.length || 0), 0)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Course List & Grading Triage */}
        <section className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold font-headline">Managed Courses</h3>
              <button onClick={() => navigate('/instructor/courses')} className="text-xs font-bold text-primary hover:underline">View All &rarr;</button>
            </div>
            
            {courses.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-6 opacity-60">
                 <BookOpen className="w-8 h-8 mb-2" />
                 <p className="text-sm">No courses initialized.</p>
               </div>
            ) : (
              <div className="space-y-4">
                {courses.slice(0, 3).map((course, idx) => (
                  <div key={idx} className="flex flex-col p-4 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                    <div className="flex justify-between items-start mb-2">
                       <h6 className="font-bold text-base">{course.courseName}</h6>
                       <button 
                         onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(course.courseCode); alert(`Access Code ${course.courseCode} copied to clipboard!`); }}
                         className="flex items-center gap-1.5 bg-secondary-fixed text-on-secondary-fixed-variant px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-secondary-fixed/80 transition-colors"
                         title="Copy Student Access Code">
                         Code: {course.courseCode}
                         <Copy className="w-3 h-3 ml-0.5 opacity-70" />
                       </button>
                    </div>
                    <div className="flex gap-4 mt-2">
                       <span className="text-xs text-on-surface-variant">{course.students?.length || 0} Enrolled</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10">
            <h3 className="text-xl font-bold font-headline mb-6">Pending Grading Review</h3>
            <div className="flex flex-col items-center justify-center p-12 opacity-60 bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">
               <BarChart2 className="w-10 h-10 mb-4 text-on-surface-variant" />
               <p className="text-sm font-medium">All caught up!</p>
               <p className="text-xs text-on-surface-variant mt-2 text-center">There are no assignments pending your final override approval.</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
