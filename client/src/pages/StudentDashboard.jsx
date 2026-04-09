import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { BookOpen, BarChart2, MessageCircle, Plus, Brain, Users } from 'lucide-react';

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  
  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Student';

  useEffect(() => {
    if (!currentUser) return;

    const fetchCourses = async () => {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .contains('students', [currentUser.uid]);
      if (data) setCourses(data);
    };

    fetchCourses();

    const subscription = supabase
      .channel('student-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        fetchCourses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentUser]);

  return (
    <div className="px-12 py-10 max-w-screen-2xl mx-auto">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface">Student Portal</h2>
          <p className="text-on-surface-variant font-medium mt-1">Hello, {displayName}. Here's your academic sync status.</p>
        </div>
        <button 
          onClick={() => navigate('/student/join-course')}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-secondary-fixed/20 hover:bg-secondary-fixed/40 transition-colors text-secondary border border-secondary/10">
          <Plus className="w-5 h-5 mb-1" />
          <span className="text-[10px] uppercase font-bold tracking-widest">Join Course</span>
        </button>
      </div>
      
      <div className="grid grid-cols-12 gap-8">
        
        {/* AI Tutor Callout */}
        <section className="col-span-12 lg:col-span-8 relative group">
          <div className="absolute inset-0 primary-gradient rounded-xl opacity-10 group-hover:opacity-15 transition-opacity blur-2xl -z-10"></div>
          <div className="glass-card rounded-xl p-10 border border-outline-variant/10 shadow-sm relative overflow-hidden h-full flex items-center">
            <div className="flex flex-col md:flex-row justify-between items-start gap-8 w-full">
              <div className="max-w-md">
                <span className="bg-primary-fixed text-on-primary-fixed-variant px-4 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-6 inline-block">Study Help</span>
                <h3 className="text-3xl font-bold font-headline mb-4">NeuroClass AI Tutor</h3>
                <p className="text-on-surface-variant leading-relaxed mb-8">Clear conceptual doubts directly referencing your professors' curriculum materials and uploaded PDFs.</p>
                <Link to="/student/ai-tutor" className="px-8 py-3 primary-gradient text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2 w-max">
                  <Brain className="w-5 h-5" /> Start Chat
                </Link>
              </div>

            </div>
          </div>
        </section>
        
        {/* Progress Tracker */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 flex flex-col justify-between h-full">
            <div>
              <h4 className="text-lg font-bold font-headline mb-2">Semester Progress</h4>
              <p className="text-sm text-on-surface-variant mb-6">Fall Semester 2024</p>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-semibold">Active Enrollments</span>
                <span className="text-2xl font-bold font-headline text-primary">{courses.length}</span>
              </div>
              <div className="h-3 bg-surface-container-highest rounded-full overflow-hidden mt-4">
                <div className="h-full primary-gradient" style={{width: "40%"}}></div>
              </div>
              <p className="text-[11px] text-on-surface-variant italic">Mid-terms approaching in 3 weeks.</p>
            </div>
          </div>
        </section>

        {/* Action Grid */}
        <section className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
            onClick={() => navigate('/student/courses')}
            className="bg-surface-container-lowest p-6 rounded-xl hover:bg-primary-fixed/30 transition-all cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
              <BookOpen className="w-6 h-6 text-primary group-hover:text-on-primary" />
            </div>
            <h5 className="text-xl font-bold font-headline">My Modules</h5>
            <p className="text-sm text-on-surface-variant mt-2">Access {courses.length} enrolled courses</p>
          </div>
          
          <div 
            className="bg-surface-container-lowest p-6 rounded-xl hover:bg-secondary-fixed/30 transition-all cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center mb-6 group-hover:bg-secondary transition-colors">
              <BarChart2 className="w-6 h-6 text-secondary group-hover:text-on-secondary" />
            </div>
            <h5 className="text-xl font-bold font-headline">Assignments</h5>
            <p className="text-sm text-on-surface-variant mt-2">0 pending tasks</p>
          </div>

          <div 
            className="bg-surface-container-lowest p-6 rounded-xl hover:bg-emerald-100 transition-all cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-6 group-hover:bg-emerald-500 transition-colors">
              <Users className="w-6 h-6 text-emerald-600 group-hover:text-white" />
            </div>
            <h5 className="text-xl font-bold font-headline">Grades</h5>
            <p className="text-sm text-on-surface-variant mt-2">View official transcripts</p>
          </div>
        </section>

      </div>
    </div>
  );
}
