import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ClipboardCheck, Sparkles, CheckCircle, AlertCircle, Eye, Hand } from 'lucide-react';
import { aiService } from '../services/aiService';

export default function GradeReview() {
  const { currentUser } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideFeedback, setOverrideFeedback] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Fetch evaluated submissions for courses this instructor teaches
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const load = async () => {
      const data = await aiService.fetchSubmissions({ instructorId: currentUser.uid, status: 'evaluated' });
      if (!cancelled) setSubmissions(data.submissions || []);
    };
    load();
    const interval = setInterval(load, 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentUser]);

  const handleApprove = async () => {
    if (!selectedSub) return;
    setProcessing(true);
    try {
      await aiService.reviewSubmission(selectedSub.id, {
        status: 'approved',
        finalScore: selectedSub.aiScore // Accept AI Recommendation
      });
      setSelectedSub(null);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleOverride = async (e) => {
    e.preventDefault();
    if (!selectedSub || !overrideScore) return;
    setProcessing(true);
    try {
      await aiService.reviewSubmission(selectedSub.id, {
        status: 'overridden',
        finalScore: Number(overrideScore),
        instructorFeedback: overrideFeedback
      });
      setIsOverriding(false);
      setOverrideScore('');
      setOverrideFeedback('');
      setSelectedSub(null);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="px-4 md:px-12 py-6 md:py-10 max-w-screen-2xl mx-auto flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-80px)] overflow-y-auto lg:overflow-hidden gap-6 lg:gap-8">
      
      {/* List Panel */}
      <div className="w-full lg:w-1/3 flex flex-col h-[40vh] lg:h-full overflow-y-auto pr-2 lg:pr-4 custom-scrollbar space-y-4 shrink-0">
        <h2 className="text-2xl md:text-3xl font-black font-headline tracking-tighter mb-2 md:mb-4">Grade Review Workflow</h2>
        
        {submissions.length === 0 && (
          <div className="p-8 text-center text-on-surface-variant opacity-60">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-2" />
            <p className="font-bold">Inbox zero!</p>
            <p className="text-sm">No pending submissions require your approval.</p>
          </div>
        )}

        {submissions.map(sub => {
          const isSelected = selectedSub?.id === sub.id;
          const hasFile = Boolean(sub.fileUrl);
          return (
            <div 
              key={sub.id}
              onClick={() => { 
                setSelectedSub(sub); 
                setIsOverriding(false); 
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`p-5 md:p-6 rounded-xl border transition-all cursor-pointer flex flex-col ${isSelected ? 'bg-primary-fixed/20 border-primary/40 shadow-md shadow-primary/10' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30'} `}>
              
              <div className="flex justify-between items-start mb-3 gap-2">
                <span className="font-bold text-sm tracking-tight truncate flex-1">{sub.studentName}</span>
                <span className="flex items-center shrink-0 gap-1 text-[10px] uppercase font-bold text-secondary-fixed-variant bg-secondary-fixed/50 px-2 py-0.5 rounded tracking-widest">
                  AI: {sub.aiScore} / {sub.maxScore || 100}
                </span>
              </div>
              <h4 className="font-medium text-xs text-on-surface-variant line-clamp-1 break-all flex items-center gap-2">
                 <Eye className="w-3 h-3 shrink-0"/> {sub.fileName}
                 {!hasFile && <span className="text-error ml-1">(file missing)</span>}
              </h4>
            </div>
          );
        })}
      </div>

      {/* Detail Panel */}
      <div className="flex-1 min-h-[70vh] lg:min-h-0 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl flex flex-col overflow-hidden shadow-inner relative">
        {!selectedSub ? (
           <div className="flex flex-col items-center justify-center h-full opacity-50 relative z-10">
             <ClipboardCheck className="w-16 h-16 mb-4 text-outline" />
             <p className="font-headline font-bold text-xl">Select a submission</p>
             <p className="text-sm">Review AI evaluations and provide final approvals.</p>
           </div>
        ) : (
          <div className="flex flex-col h-full animate-fade-in divide-y divide-outline-variant/10">
            
            {/* Header / Student Info */}
            <div className="p-10 flex justify-between items-start">
               <div>
                  <h2 className="text-3xl font-black font-headline mb-2">{selectedSub.studentName}</h2>
                  <a
                    href={selectedSub.fileUrl ? aiService.resolveFileUrl(selectedSub.fileUrl) : '#'}
                    target={selectedSub.fileUrl ? "_blank" : undefined}
                    rel={selectedSub.fileUrl ? "noreferrer" : undefined}
                    className={`text-sm font-bold flex items-center gap-2 w-max ${selectedSub.fileUrl ? 'text-primary hover:underline' : 'text-on-surface-variant cursor-not-allowed'}`}
                    onClick={(e) => {
                      if (!selectedSub.fileUrl) e.preventDefault();
                    }}
                  >
                    <Eye className="w-4 h-4" /> Expand Original Document
                  </a>
               </div>
               <div className="text-right">
                  <p className="text-xs uppercase font-bold tracking-widest text-on-surface-variant mb-1">AI Recommendation</p>
                  <p className="text-4xl font-headline font-black text-secondary">{selectedSub.aiScore}</p>
               </div>
            </div>

            {/* AI Context / Feedback */}
            <div className="p-10 bg-secondary-fixed/10">
               <h4 className="text-sm font-bold uppercase tracking-widest text-secondary-fixed-variant flex items-center gap-2 mb-4">
                 <Sparkles className="w-4 h-4" /> Engine Justification
               </h4>
               <p className="text-on-surface font-medium leading-relaxed rounded-xl bg-surface-container-lowest/50 p-6 border border-secondary/10 shadow-inner">
                 {selectedSub.aiFeedback || "No detailed feedback generated."}
               </p>
            </div>

            {/* Actions */}
            <div className="flex-1 p-10 bg-surface-container-lowest flex flex-col justify-center">
              
              {!isOverriding ? (
                <div className="flex gap-6 mx-auto">
                  <button 
                    onClick={() => setIsOverriding(true)}
                    className="flex flex-col items-center justify-center gap-3 w-40 h-40 rounded-2xl border-2 border-outline-variant/30 text-on-surface-variant hover:border-error hover:text-error hover:bg-error/5 transition-all">
                    <Hand className="w-8 h-8" />
                    <span className="font-bold font-headline">Override</span>
                  </button>
                  <button 
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex flex-col items-center justify-center gap-3 w-40 h-40 rounded-2xl bg-emerald-50 text-emerald-600 border-2 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-100 hover:shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50">
                    <CheckCircle className="w-8 h-8" />
                    <span className="font-bold font-headline">{processing ? 'Saving...' : 'Approve Match'}</span>
                  </button>
                </div>
              ) : (
                <div className="max-w-md mx-auto w-full animate-fade-in">
                  <h4 className="font-headline font-bold text-xl mb-4 text-error">Instructor Override</h4>
                  <form onSubmit={handleOverride} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Final Score Correction</label>
                      <input 
                        type="number" required
                        value={overrideScore}
                        onChange={(e) => setOverrideScore(e.target.value)}
                        className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-error rounded-xl py-3 px-4 mt-1"
                        placeholder="e.g. 85"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Override Justification (Sent to Student)</label>
                      <textarea 
                        rows="3" required
                        value={overrideFeedback}
                        onChange={(e) => setOverrideFeedback(e.target.value)}
                        className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-error rounded-xl py-3 px-4 resize-none mt-1"
                        placeholder="Explain why the AI evaluation was adjusted..."
                      ></textarea>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => setIsOverriding(false)} className="flex-1 px-4 py-3 border border-outline-variant/30 rounded-full font-bold">Cancel</button>
                      <button type="submit" disabled={processing} className="flex-1 px-4 py-3 bg-error text-white rounded-full font-bold shadow-lg shadow-error/20 disabled:opacity-50">
                        {processing ? 'Saving...' : 'Finalize Grades'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
