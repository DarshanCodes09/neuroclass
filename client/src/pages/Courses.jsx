import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Users, Star, Copy } from 'lucide-react';
import { aiService } from '../services/aiService';

export default function Courses() {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await aiService.fetchCourses({
          instructorId: userRole === 'Instructor' ? currentUser.uid : undefined,
          studentId: userRole === 'Student' ? currentUser.uid : undefined,
        });
        if (!cancelled) {
          setCourses(data.courses || []);
        }
      } catch (error) {
        console.error('Failed to load courses:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser, userRole]);

  return (
    <div className="px-12 py-10 max-w-screen-2xl mx-auto w-full">
      <div className="mb-12">
        <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface">Course Directory</h2>
        <p className="text-on-surface-variant font-medium mt-1">Manage and access your active academic modules.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-16 text-center shadow-sm">
          <BookOpen className="w-16 h-16 mx-auto mb-6 text-slate-300" />
          <h3 className="text-2xl font-bold font-headline mb-2">No Courses Yet</h3>
          <p className="text-on-surface-variant max-w-md mx-auto">
            {userRole === 'Instructor' 
              ? "You haven't created any courses yet. Initialize your first module to begin."
              : "You aren't enrolled in any courses. Use an access code from your instructor to join one."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courses.map((course) => (
            <div key={course.id} onClick={() => navigate(`/${userRole.toLowerCase()}/course/${course.id}`)} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all group cursor-pointer flex flex-col h-full">
              <div className="h-32 primary-gradient relative p-6 flex flex-col justify-between">
                <div className="absolute inset-0 bg-black/10 transition-opacity group-hover:bg-transparent"></div>
                <div className="relative z-10 flex justify-between items-start">
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(course.courseCode); alert(`Access code ${course.courseCode} copied to clipboard!`); }}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 transition-colors"
                     title="Copy Access Code">
                    Code: {course.courseCode}
                    <Copy className="w-3 h-3 opacity-80" />
                  </button>
                  <button className="text-white/80 hover:text-white transition-colors">
                    <Star className="w-5 h-5" />
                  </button>
                </div>
                <h3 className="relative z-10 text-white font-headline font-bold text-xl leading-tight mt-auto drop-shadow-sm">
                  {course.courseName}
                </h3>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4 text-on-surface-variant text-sm">
                    <Users className="w-4 h-4" />
                    <span className="font-medium">{course.instructorName}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant">Level</span>
                      <span className="font-semibold">{course.academicLevel}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant">AI Pedagogy</span>
                      <span className="font-semibold text-primary">{course.pedagogyStyle}</span>
                    </div>
                    {userRole === 'Instructor' && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant">Enrolled</span>
                        <span className="font-semibold">{course.students?.length || 0} / {course.capacity}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-8 pt-4 border-t border-outline-variant/10 text-center">
                  <span className="text-xs font-bold font-headline uppercase tracking-widest text-primary group-hover:text-indigo-600 transition-colors">Enter Environment &rarr;</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
