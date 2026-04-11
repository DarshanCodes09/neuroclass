import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UploadCloud, FileText, X, Loader2 } from 'lucide-react';
import { aiService } from '../services/aiService';

export default function CreateCourse() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    courseName: '',
    academicLevel: 'Undergraduate',
    capacity: '',
  });

  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef(null);

  const canSubmit = Boolean(formData.courseName.trim() && formData.capacity);

  const handleFileSelect = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !currentUser) return;

    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      const progress = {};
      files.forEach((file) => {
        progress[file.name] = 100;
      });
      setUploadProgress(progress);

      await aiService.initializeCourse({ formData, files, currentUser });
      setSuccessMessage('Course initialized successfully. Content processing is complete.');
      navigate('/instructor/dashboard');
    } catch (err) {
      console.error('Failed to create course', err);
      setErrorMessage(err.message || 'Could not create the course.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="p-8 md:p-12 max-w-6xl mx-auto w-full">
      <div className="mb-10">
        <span className="text-xs font-bold tracking-[0.3em] text-indigo-600 dark:text-indigo-400 uppercase mb-2 block font-headline">Instructor Control Panel</span>
        <h2 className="text-4xl font-headline font-black tracking-tight text-slate-900">Create Course Module</h2>
        <p className="text-slate-700 mt-3 text-base max-w-2xl font-medium leading-relaxed">
          Define your course parameters and ingest curriculum materials. Our AI will automatically index these documents for the Student Evaluator.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-12">
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-headline font-bold text-sm shadow-md">01</span>
              <h3 className="text-2xl font-headline font-semibold text-slate-900 dark:text-white">Course Details</h3>
            </div>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">Course Name</label>
                  <input
                    value={formData.courseName}
                    onChange={(e) => setFormData(prev => ({ ...prev, courseName: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-4 focus:ring-2 ring-primary/20 text-slate-900 dark:text-slate-100 placeholder:text-slate-500"
                    placeholder="e.g. Database Management Systems"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">Academic Level</label>
                  <select
                    value={formData.academicLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, academicLevel: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-4 focus:ring-2 ring-primary/20 text-slate-900 dark:text-slate-100">
                    <option>Post-Graduate (PhD)</option>
                    <option>Graduate (Master)</option>
                    <option>Undergraduate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">Class Capacity</label>
                  <input
                    value={formData.capacity}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-4 focus:ring-2 ring-primary/20 text-slate-900 dark:text-slate-100"
                    placeholder="60"
                    type="number"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-headline font-bold text-sm shadow-md">02</span>
              <h3 className="text-2xl font-headline font-semibold text-slate-900 dark:text-white">Course Materials</h3>
            </div>

            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.pptx"
            />

            <div
              onClick={() => !loading && fileInputRef.current?.click()}
              className={`border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-12 rounded-xl flex flex-col items-center justify-center text-center group transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/40'}`}>
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-slate-800 flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform">
                <UploadCloud className="w-8 h-8 text-primary dark:text-indigo-400" />
              </div>
              <h4 className="font-headline font-bold text-lg mb-1 text-slate-900 dark:text-slate-100">Upload course curriculum</h4>
              <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs">
                Rubrics, notes, slides, or references. Our AI uses these to understand your course module.
              </p>
            </div>

            {files.length > 0 && (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-md">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">Selected Assets</h4>
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {loading ? (
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{uploadProgress[f.name] || 0}%</span>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => removeFile(idx)} 
                          className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="pt-8 border-t border-outline-variant/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            {errorMessage && (
              <div className="w-full p-3 rounded-lg bg-red-50 text-red-700 text-sm font-medium">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="w-full p-3 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm font-medium">
                {successMessage}
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
              className="btn-gradient w-full sm:w-auto px-12 py-4 rounded-full font-headline text-sm font-bold uppercase tracking-widest text-white shadow-xl shadow-primary/30 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creating Course...' : 'Create Course'}
            </button>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="glass-panel p-8 rounded-xl border border-white/50 shadow-xl shadow-indigo-500/5">
            <h4 className="text-sm font-bold font-headline uppercase tracking-[0.2em] text-primary mb-6">Course Preview</h4>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-6 group">
              <img className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBFTHT47_-3zy-7KJLNCqAbja9CKc2nuB-P_54A65uSmxGRj0wQRT3bVmA7EkIIfmb_gmHIQ9diOYUxNOH0p9vT07EFXyU42zyQFmGe49nrrWpjhBr6ezXl3yOYogtC4f4HWH-copJT6FnHFRkB_IVeL8psmVjXtJzykNeaPMfKGd1O4Cq4c5K5gE_u4IwSqOkPHvnkUYLeY9Y98IDwLBGS2i8CFd5wtgTdFGntN9Bphmz_jTMzMBBvCutrQRSZKcDsJA2ujDPqTs3R" alt="abstract network" />
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/80 to-transparent"></div>
              <div className="absolute bottom-4 left-4">
                <p className="text-white font-headline font-bold text-lg leading-tight w-11/12">{formData.courseName || 'New Course'}</p>
                <p className="text-indigo-200 text-xs mt-1">{formData.academicLevel}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/10 dark:border-slate-800">
                <span className="text-xs text-on-surface-variant dark:text-slate-400">Ready To Create</span>
                <span className="text-xs font-bold text-primary dark:text-indigo-400">{canSubmit ? 'Yes' : 'No'}</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-highest dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full btn-gradient transition-all ${canSubmit ? 'w-full' : 'w-1/2'}`}></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-surface dark:bg-slate-900/50 p-4 rounded-lg border border-transparent dark:border-slate-800">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Files</p>
                  <p className="font-headline font-bold text-xl dark:text-slate-200">{files.length}</p>
                </div>
                <div className="bg-surface dark:bg-slate-900/50 p-4 rounded-lg border border-transparent dark:border-slate-800">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Capacity</p>
                  <p className="font-headline font-bold text-xl dark:text-slate-200">{formData.capacity || 0}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
