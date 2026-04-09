import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Sparkles, User, Eye } from 'lucide-react';
import { aiService } from '../services/aiService';

export default function StudentGrades() {
  const { currentUser } = useAuth();
  const [grades, setGrades] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const load = async () => {
      const data = await aiService.fetchGrades(currentUser.uid);
      if (!cancelled) setGrades(data.grades || []);
    };
    load();
    const interval = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentUser]);

  return (
    <div className="px-12 py-10 max-w-screen-2xl mx-auto h-[calc(100vh-80px)] overflow-y-auto">
      <div className="mb-12">
        <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface">Academic Transcripts</h2>
        <p className="text-on-surface-variant font-medium mt-1">Review your finalized coursework and feedback signals.</p>
      </div>

      {grades.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 opacity-50 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30">
           <GraduationCap className="w-16 h-16 mb-4 text-outline" />
           <p className="font-headline font-bold text-xl">No grades published yet</p>
           <p className="text-sm">Submitted assignments are pending instructor/AI review.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grades.map(grade => (
            <div key={grade.id} className="bg-surface-container-lowest border border-outline-variant/20 shadow-sm rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="p-8 flex items-center justify-between border-b border-outline-variant/10">
                <div>
                  <h3 className="text-xl font-bold font-headline mb-1">{grade.fileName?.replace(/^[a-zA-Z0-9]+_/, '') || 'Submission'}</h3>
                  <div className="flex gap-3 items-center text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                    <span>Evaluated</span>
                    <span className="w-1 h-1 rounded-full bg-outline-variant/30"></span>
                    <span className={grade.status === 'overridden' ? 'text-primary' : 'text-emerald-600'}>
                      {grade.status === 'overridden' ? 'Instructor Override' : 'AI Autopilot'}
                    </span>
                  </div>
                  {grade.fileUrl && (
                    <a
                      href={aiService.resolveFileUrl(grade.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> Open submitted file
                    </a>
                  )}
                </div>
                <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 border-surface shadow-sm relative overflow-hidden bg-primary-fixed/30">
                  <div className="absolute inset-x-0 bottom-0 bg-primary/20" style={{height: `${Math.min(grade.finalScore, 100)}%`}}></div>
                  <span className="relative z-10 text-2xl font-black font-headline tracking-tighter">{grade.finalScore}</span>
                </div>
              </div>

              {/* Feedback Body */}
              <div className="p-8 bg-surface-container-low/30 space-y-6">
                
                {/* AI Feedback */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-secondary-fixed-variant" /> Primary Engine Feedback
                  </h4>
                  <p className="text-sm font-medium leading-relaxed bg-white dark:bg-slate-950 p-6 rounded-xl border border-outline-variant/10 shadow-sm">
                    {grade.aiFeedback || "No automated feedback available."}
                  </p>
                </div>

                {/* Optional Override Feedback */}
                {grade.status === 'overridden' && grade.instructorFeedback && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2 mb-3 mt-8">
                      <User className="w-4 h-4" /> Instructor Addendum
                    </h4>
                    <p className="text-sm font-medium leading-relaxed bg-primary-fixed/5 p-6 rounded-xl border border-primary/20 text-on-surface shadow-inner">
                      {grade.instructorFeedback}
                    </p>
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
