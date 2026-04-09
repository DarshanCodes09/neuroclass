import React, { useState, useEffect, useRef } from 'react';
import { BrainCircuit, Upload, FileText, CheckCircle, Brain, Target, ShieldCheck, Sparkles, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { aiService } from '../services/aiService';

const EMPTY_PROFILE = { status: 'calibrating', rubricCount: 0, sampleCount: 0 };

export default function AIEvaluatorTraining() {
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);
  
  const [courseId, setCourseId] = useState('');
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [rubrics, setRubrics] = useState([]);
  const [goldSamples, setGoldSamples] = useState([]);
  const [uploadingCategory, setUploadingCategory] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [sampleMeta, setSampleMeta] = useState({
    high: { studentAnswer: '', marks: '', feedback: '' },
    avg: { studentAnswer: '', marks: '', feedback: '' },
    low: { studentAnswer: '', marks: '', feedback: '' },
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!courseId) return;
    aiService.getTrainingProfile(courseId)
      .then((data) => {
        setProfile(data.profile || EMPTY_PROFILE);
        setRubrics(data.rubrics || []);
        setGoldSamples(data.samples || []);
      })
      .catch(() => {});
  }, [courseId]);

  const trainingProgress = profile?.status === 'ready' ? 100 : Math.min(99, (profile.rubricCount || 0) * 20 + (profile.sampleCount || 0) * 20);
  const status = profile?.status || 'calibrating';

  const triggerUpload = (category) => {
    if (!courseId) {
      alert("Please enter a Course ID first.");
      return;
    }
    setUploadingCategory(category);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const pickedFiles = Array.from(e.target.files || []);
    if (!pickedFiles.length || !currentUser || !uploadingCategory || !courseId) {
      setUploadingCategory(null);
      return;
    }

    // Reset input so the same file could be selected again if needed
    e.target.value = null;

    try {
      setErrorMessage('');
      setStatusMessage('');
      setUploadProgress(10);
      if (uploadingCategory === 'rubric') {
        const response = await aiService.uploadRubrics({
          courseId,
          instructorId: currentUser.uid,
          files: pickedFiles,
        });
        setRubrics((prev) => [...prev, ...(response.rubrics || [])]);
        setStatusMessage(`Uploaded ${pickedFiles.length} rubric file(s).`);
      } else {
        const sampleType = uploadingCategory.split('-')[1];
        const meta = sampleMeta[sampleType];
        const response = await aiService.uploadGoldSample({
          courseId,
          instructorId: currentUser.uid,
          sampleType,
          studentAnswer: meta.studentAnswer,
          marks: meta.marks,
          feedback: meta.feedback,
          file: pickedFiles[0],
        });
        setGoldSamples((prev) => [...prev, response.sample]);
        setStatusMessage(`Uploaded ${sampleType} sample.`);
      }
      await refreshProfile();
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload failed', error);
      setErrorMessage(error.message || 'Upload failed.');
    } finally {
      setUploadingCategory(null);
      setUploadProgress(0);
    }
  };

  const refreshProfile = async () => {
    const data = await aiService.getTrainingProfile(courseId);
    setProfile(data.profile || EMPTY_PROFILE);
    setRubrics(data.rubrics || []);
    setGoldSamples(data.samples || []);
  };

  const handleRemoveRubric = async (rubricId) => {
    if (!rubricId) return;
    try {
      await aiService.deleteRubric(rubricId);
      await refreshProfile();
      setStatusMessage('Rubric removed.');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to remove rubric.');
    }
  };

  const handleRemoveSample = async (sampleId) => {
    if (!sampleId) return;
    try {
      await aiService.deleteSample(sampleId);
      await refreshProfile();
      setStatusMessage('Gold sample removed.');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to remove gold sample.');
    }
  };

  const handleStartTraining = async () => {
    if (!currentUser || !courseId) return;
    try {
      setIsTraining(true);
      setErrorMessage('');
      setStatusMessage('');
      const result = await aiService.startTraining({
        courseId,
        instructorId: currentUser.uid,
      });
      await refreshProfile();
      setStatusMessage(`Training complete. ${result.sampleCount || 0} sample(s) calibrated.`);
    } catch (error) {
      setErrorMessage(error.message || 'Training failed.');
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="px-12 py-10 max-w-screen-2xl mx-auto">
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".pdf,.doc,.docx,.txt" 
      />

      <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface">AI Evaluator Training</h2>
          <p className="text-on-surface-variant font-medium mt-1">Calibrate exactly how the NeuroClass engine evaluates your students.</p>
          <input
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            placeholder="Enter Course ID"
            className="mt-4 px-3 py-2 rounded-lg border border-outline-variant/30 bg-surface-container-low text-sm"
          />
        </div>
        <div className="bg-surface-container-lowest px-6 py-4 rounded-xl border border-outline-variant/20 shadow-sm flex items-center gap-6">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Calibration</p>
            <p className="text-2xl font-black font-headline text-primary">{trainingProgress}% <span className="text-sm font-medium text-on-surface-variant">{status === 'calibrating' ? 'Pending' : 'Ready'}</span></p>
          </div>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${status === 'ready' ? 'bg-emerald-100' : 'bg-primary-fixed/30'}`}>
            <BrainCircuit className={`w-8 h-8 ${status === 'ready' ? 'text-emerald-600' : 'text-primary'}`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Rubrics & Guidelines Upload */}
        <section className="col-span-12 lg:col-span-6 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-fixed/20 rounded-bl-full blur-2xl -z-10"></div>
            <div className="mb-6">
              <span className="bg-secondary-fixed text-on-secondary-fixed-variant px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-4 inline-block">Step 1</span>
              <h3 className="text-2xl font-bold font-headline mb-2 flex items-center gap-2">Core Rubrics & Syllabus <Target className="w-5 h-5 text-secondary" /></h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">Upload your official grading rubrics, course syllabus, and general evaluation criteria. The AI will extract your core marking priorities from these documents.</p>
            </div>
            
            <div 
              onClick={() => triggerUpload('rubric')}
              className="flex-1 border-2 border-dashed border-outline-variant/30 rounded-xl flex flex-col items-center justify-center p-8 hover:bg-surface-container-low/50 hover:border-primary/50 transition-all cursor-pointer group relative">
              
              {uploadingCategory === 'rubric' ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                  <p className="text-sm font-bold text-primary">Uploading... {uploadProgress}%</p>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-4 group-hover:bg-primary-fixed/50 transition-colors">
                    <Upload className="w-6 h-6 text-on-surface-variant group-hover:text-primary transition-colors" />
                  </div>
                  <p className="font-bold text-sm text-on-surface">Click here to add documents</p>
                  <p className="text-xs text-on-surface-variant mt-1">Supports PDF, DOCX, TXT (Max 10MB)</p>
                </>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Uploaded Documents ({profile.rubricCount || rubrics.length})</h4>
              {rubrics.length === 0 && !profile.rubricCount ? (
                 <p className="text-xs text-on-surface-variant italic">No rubrics uploaded yet.</p>
              ) : (
                rubrics.map((rubric, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/10 group relative">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-[200px]" title={rubric.fileName}>{rubric.fileName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <button 
                          onClick={(e) => { e.stopPropagation(); handleRemoveRubric(rubric.id); }}
                        className="p-1 rounded-full bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Gold Standard Examples */}
        <section className="col-span-12 lg:col-span-6 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 h-full flex flex-col relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary-fixed/20 rounded-bl-full blur-2xl -z-10"></div>
             <div className="mb-6">
              <span className="bg-primary-fixed text-on-primary-fixed-variant px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-4 inline-block">Step 2</span>
              <h3 className="text-2xl font-bold font-headline mb-2 flex items-center gap-2">Gold Standard Samples <ShieldCheck className="w-5 h-5 text-primary" /></h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">Provide previous student submissions along with the exact grade and feedback you gave. This calibrates the AI to your tone and strictness.</p>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
               {['high', 'low', 'avg'].map(type => {
                 // Check if we have a sample of this type
                 const sample = goldSamples.find(s => (s.type || s.sampleType) === type);
                 const isUploading = uploadingCategory === `gold-${type}`;
                 
                 const titleMap = {
                   'high': 'High-Scoring Example',
                   'low': 'Low-Scoring Example',
                   'avg': 'Average Example'
                 };

                 return (
                   <div 
                     key={type}
                     onClick={() => !sample && !isUploading && triggerUpload(`gold-${type}`)}
                     className={`border rounded-xl p-5 h-32 flex flex-col justify-center items-center ${type === 'avg' ? 'sm:col-span-2' : ''} ${sample ? 'border-emerald-500/30 bg-emerald-50/10 cursor-default' : 'border-outline-variant/20 hover:bg-surface-container-low cursor-pointer group transition-colors'}`}
                   >
                     {isUploading ? (
                        <>
                          <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
                          <p className="text-xs font-bold text-center text-primary">{uploadProgress}%</p>
                        </>
                     ) : sample ? (
                        <div className="relative w-full h-full flex flex-col justify-center items-center group">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveSample(sample.id); }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-200 shadow-sm"
                            title="Remove sample">
                            <X className="w-3 h-3" />
                          </button>
                          <CheckCircle className="w-6 h-6 text-emerald-500 mb-2" />
                          <p className="text-xs font-bold text-center text-emerald-700 truncate w-full px-2" title={sample.fileName || titleMap[type]}>
                            {sample.fileName || `${titleMap[type]} saved`}
                          </p>
                        </div>
                     ) : (
                        <>
                          <Upload className="w-6 h-6 text-on-surface-variant mb-2 group-hover:text-primary transition-colors" />
                          <p className="text-xs font-bold text-center text-on-surface">Add {titleMap[type]}</p>
                          <input
                            value={sampleMeta[type].marks}
                            onChange={(e) => setSampleMeta((prev) => ({ ...prev, [type]: { ...prev[type], marks: e.target.value } }))}
                            placeholder="Marks"
                            className="mt-2 px-2 py-1 rounded border border-outline-variant/20 text-xs w-full"
                          />
                          <textarea
                            value={sampleMeta[type].studentAnswer}
                            onChange={(e) => setSampleMeta((prev) => ({ ...prev, [type]: { ...prev[type], studentAnswer: e.target.value } }))}
                            placeholder="Paste the student's answer or upload a file"
                            className="mt-1 px-2 py-1 rounded border border-outline-variant/20 text-xs w-full"
                            rows={3}
                          />
                          <textarea
                            value={sampleMeta[type].feedback}
                            onChange={(e) => setSampleMeta((prev) => ({ ...prev, [type]: { ...prev[type], feedback: e.target.value } }))}
                            placeholder="Feedback"
                            className="mt-1 px-2 py-1 rounded border border-outline-variant/20 text-xs w-full"
                            rows={2}
                          />
                        </>
                     )}
                   </div>
                 );
               })}
            </div>

            <div className="mt-6 flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/30">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Adding at least 3 distinct graded examples improves evaluation accuracy by up to 40%.</p>
            </div>
          </div>
        </section>

        {/* Action Bar */}
        <section className="col-span-12 mt-4">
          {errorMessage && <div className="mb-3 p-3 rounded bg-red-50 text-red-700 text-sm">{errorMessage}</div>}
          {statusMessage && <div className="mb-3 p-3 rounded bg-emerald-50 text-emerald-700 text-sm">{statusMessage}</div>}
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
                <Brain className="w-6 h-6 text-on-surface-variant" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Force Re-calibration</h4>
                <p className="text-xs text-on-surface-variant hidden sm:block">Trigger neuro-engine training manually based on new uploads.</p>
              </div>
            </div>
            <button 
              onClick={handleStartTraining}
              disabled={isTraining || !courseId || ((profile.rubricCount || rubrics.length) === 0 && (profile.sampleCount || goldSamples.length) === 0)}
              className="w-full sm:w-auto px-8 py-3 primary-gradient text-on-primary rounded-full font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
               {isTraining ? <><Loader2 className="w-5 h-5 animate-spin" /> Calibrating Engine...</> : 'Start Training Sequence'}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
