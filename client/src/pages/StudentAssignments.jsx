import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileText, Calendar, UploadCloud, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { aiService } from '../services/aiService';

export default function StudentAssignments({ courseIdFilter }) {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState({}); // Mapping assignmentId -> submission status
  
  const [selectedAssn, setSelectedAssn] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);

  // 1. Fetch courses student is enrolled in
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const load = async () => {
      const data = await aiService.fetchCourses({ studentId: currentUser.uid });
      if (!cancelled) setCourses(data.courses || []);
    };
    load();
    const interval = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentUser]);

  // 2. Fetch assignments for those courses
  useEffect(() => {
    if (courses.length === 0) return;
    let cancelled = false;
    const load = async () => {
      const data = await aiService.fetchAssignments(courseIdFilter ? { courseId: courseIdFilter } : { studentId: currentUser.uid });
      if (!cancelled) setAssignments((data.assignments || []).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
    };
    load();
    const interval = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [courses, courseIdFilter, currentUser?.uid]);

  // 3. Fetch user's previous submissions to grey out completed assignments
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const load = async () => {
      const data = await aiService.fetchSubmissions({ studentId: currentUser.uid });
      if (cancelled) return;
      const subData = {};
      (data.submissions || []).forEach((s) => { subData[s.assignmentId] = s; });
      setSubmissions(subData);
    };
    load();
    const interval = setInterval(load, 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentUser]);

  const handleSubmit = async () => {
    if (!selectedAssn) return;
    if (!uploadFile && !textAnswer.trim()) {
      setError('Please write your answer or upload a file before submitting.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      // Build submission text — prefer typed answer, fall back to file reference
      let submissionText = textAnswer.trim();
      let downloadURL = null;
      let fileName = null;

      if (uploadFile) {
        const uploadMeta = await aiService.uploadSubmissionFile(uploadFile);
        downloadURL = uploadMeta.fileUrl;
        fileName = uploadMeta.fileName || uploadFile.name;
        if (!submissionText) {
          submissionText = `[File submission: ${fileName}]`;
        }
      }

      // AI Evaluation
      let aiScore = 0;
      let aiFeedback = 'Evaluation failed connection.';
      let aiMarks = {};
      let plagiarismScore = 0;
      let vectorJson = {};

      try {
        const evaluation = await aiService.evaluateSubmission({
          textContent: submissionText,
          courseId: selectedAssn.courseId,
          instructorId: selectedAssn.instructorId,
          studentId: currentUser.uid,
          assignmentId: selectedAssn.id,
          assignmentPrompt: selectedAssn.description,
          maxScore: selectedAssn.maxScore,
        });
        aiScore = evaluation.score;
        aiFeedback = evaluation.feedback;
        aiMarks = evaluation.marks || {};
        plagiarismScore = evaluation.plagiarismScore || 0;
        vectorJson = evaluation.vector || {};
      } catch (err) {
        console.warn('AI evaluation error:', err.message);
        aiFeedback = `ERROR: ${err.message || 'Auto-grading failed.'} (Pending manual instructor review)`;
      }

      await aiService.createSubmission({
        assignmentId: selectedAssn.id,
        courseId: selectedAssn.courseId,
        instructorId: selectedAssn.instructorId,
        studentId: currentUser.uid,
        studentName: currentUser.displayName || currentUser.email.split('@')[0],
        fileUrl: downloadURL,
        fileName: fileName,
        status: 'evaluated',
        aiScore,
        aiFeedback,
        studentAnswer: submissionText,
        vectorJson,
        plagiarismScore,
        aiMarks,
        maxScore: selectedAssn.maxScore,
      });

      setUploadFile(null);
      setTextAnswer('');
      setSelectedAssn(null);
      
    } catch (err) {
      console.error(err);
      setError("Failed to upload submission. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`px-4 md:px-12 py-6 md:py-10 max-w-screen-2xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-8 ${courseIdFilter ? 'h-[calc(100vh-250px)]' : 'min-h-0 lg:h-[calc(100vh-80px)]'}`}>
      
      {/* List Panel */}
      <div className="w-full lg:w-1/3 flex flex-col h-[50vh] lg:h-full overflow-y-auto pr-2 lg:pr-4 custom-scrollbar space-y-4 shrink-0">
        <h2 className="text-2xl md:text-3xl font-black font-headline tracking-tighter mb-2 md:mb-4">Pending Tasks</h2>
        
        {assignments.length === 0 && (
          <div className="p-8 text-center text-on-surface-variant opacity-60">
            <CheckCircle className="w-10 h-10 mx-auto mb-2" />
            <p className="font-bold">You are completely caught up!</p>
          </div>
        )}

        {assignments.map(assn => {
          const isSubmitted = submissions[assn.id];
          const isSelected = selectedAssn?.id === assn.id;
          
          return (
            <div 
              key={assn.id}
              onClick={() => {
                 if (!isSubmitted) {
                   setSelectedAssn(assn);
                   // Scroll to top on mobile when selected
                   window.scrollTo({ top: 0, behavior: 'smooth' });
                 }
              }}
              className={`p-5 md:p-6 rounded-xl border transition-all cursor-pointer flex flex-col ${isSubmitted ? 'bg-surface-container opacity-60 border-transparent cursor-not-allowed' : isSelected ? 'bg-primary-fixed/20 border-primary/40 shadow-md shadow-primary/10' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30'} `}>
              
              <div className="flex justify-between items-start mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-secondary-fixed text-on-secondary-fixed-variant">
                  {assn.courseCode}
                </span>
                {isSubmitted ? (
                  <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                    <CheckCircle className="w-3 h-3" /> Submitted
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-on-surface-variant">
                    <Calendar className="w-4 h-4" /> {assn.dueDate}
                  </span>
                )}
              </div>
              <h4 className="font-bold font-headline text-lg line-clamp-2 md:line-clamp-1">{assn.title}</h4>
            </div>
          );
        })}
      </div>

      {/* Detail Panel */}
      <div className="flex-1 min-h-[70vh] lg:min-h-0 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl flex flex-col overflow-y-auto shadow-inner relative">
        {!selectedAssn ? (
           <div className="flex flex-col items-center justify-center h-full opacity-50 relative z-10">
             <FileText className="w-16 h-16 mb-4 text-outline" />
             <p className="font-headline font-bold text-xl">Select an assignment</p>
             <p className="text-sm">Requirements and upload portal will appear here.</p>
           </div>
        ) : (
          <div className="flex flex-col h-full animate-fade-in">
            {/* Header info */}
            <div className="p-10 border-b border-outline-variant/10">
               <h2 className="text-3xl font-black font-headline mb-4">{selectedAssn.title}</h2>
               <div className="flex gap-6 items-center flex-wrap text-sm text-on-surface-variant font-medium">
                 <span className="flex items-center gap-2"><Calendar className="w-4 h-4"/> Due {selectedAssn.dueDate}</span>
                 <span className="flex items-center gap-2 border-l border-outline-variant/30 pl-6 text-outline">Max Score: {selectedAssn.maxScore}</span>
               </div>
               
               <p className="mt-8 leading-relaxed whitespace-pre-wrap text-on-surface font-medium">{selectedAssn.description}</p>
            </div>

            {/* Submission Area */}
            <div className="flex-1 p-6 md:p-10 bg-surface-container-low/50 flex flex-col gap-6">

              {error && <div className="text-error font-medium text-sm flex items-center gap-2 bg-error/10 px-4 py-3 rounded-lg"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}

              {/* Text Answer */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Write Your Answer
                </label>
                <textarea
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  rows={7}
                  placeholder="Type your answer here... You can explain concepts, write code, show your working, etc."
                  className="w-full resize-none bg-surface-container-lowest border border-outline-variant/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3 text-sm text-on-surface placeholder-on-surface-variant/50 transition outline-none"
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-outline-variant/20" />
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">or attach a file</span>
                <div className="flex-1 h-px bg-outline-variant/20" />
              </div>

              {/* File Upload */}
              <div
                className="border-2 border-dashed border-primary/30 bg-primary-fixed/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-colors hover:bg-primary-fixed/10 cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) setUploadFile(e.dataTransfer.files[0]);
                }}
                onClick={() => !uploadFile && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => setUploadFile(e.target.files[0])}
                />
                {!uploadFile ? (
                  <>
                    <div className="w-12 h-12 rounded-full primary-gradient flex items-center justify-center text-white shadow-lg mb-3 shadow-primary/20">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-sm mb-1">Upload Deliverable</p>
                    <p className="text-xs text-on-surface-variant">Drag & drop your PDF, DOCX, or ZIP, or <span className="text-primary font-bold">browse</span></p>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full px-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm line-clamp-1">{uploadFile.name}</p>
                        <p className="text-xs text-on-surface-variant">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                      className="px-3 py-1 border border-error/30 text-error rounded-full text-[10px] font-bold uppercase hover:bg-error/10 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={loading || (!textAnswer.trim() && !uploadFile)}
                className="w-full py-4 primary-gradient text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? 'Processing...' : <><Sparkles className="w-4 h-4" /> Submit &amp; Evaluate with AI</>}
              </button>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
