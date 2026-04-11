import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, Send, CheckCircle2, AlertCircle,
  Loader2, X, Brain, ChevronDown, Award, Target, BarChart3
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8000/api';

// ─── Helper ────────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const SUBMIT_MODES = { TEXT: 'text', FILE: 'file' };

// ─── Confidence Badge ───────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  const color = pct >= 75 ? 'emerald' : pct >= 50 ? 'amber' : 'red';
  const label = pct >= 75 ? 'High' : pct >= 50 ? 'Medium' : 'Low';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-${color}-100 text-${color}-700`}>
      <Target className="w-3 h-3" />
      {label} Confidence ({pct}%)
    </span>
  );
}

// ─── Result Card ───────────────────────────────────────────────────────────
function ResultCard({ result }) {
  const { marks, total, maxMarks, feedback, confidence } = result;
  const percentage = maxMarks > 0 ? Math.round((total / maxMarks) * 100) : 0;

  return (
    <div className="mt-8 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-lg animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-bold text-emerald-900">AI Evaluation Complete</h3>
          <p className="text-xs text-emerald-600">Powered by Groq · Rubric-based grading</p>
        </div>
        <div className="ml-auto">
          <ConfidenceBadge confidence={confidence} />
        </div>
      </div>

      {/* Score Banner */}
      <div className="flex items-center justify-center gap-4 py-6 mb-5 bg-white rounded-xl border border-emerald-100 shadow-sm">
        <div className="text-center">
          <p className="text-5xl font-black text-emerald-700">{total}</p>
          <p className="text-sm text-gray-400 font-medium">out of {maxMarks}</p>
        </div>
        <div className="h-14 w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-3xl font-black text-gray-700">{percentage}%</p>
          <p className="text-sm text-gray-400 font-medium">score</p>
          {/* Score bar */}
          <div className="w-24 h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${percentage >= 75 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Criterion breakdown */}
      {marks && Object.keys(marks).length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5" /> Criterion Breakdown
          </p>
          <div className="space-y-1.5">
            {Object.entries(marks).map(([criterion, awarded]) => (
              <div key={criterion} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white border border-gray-100">
                <span className="text-sm text-gray-700 capitalize">{criterion}</span>
                <span className="text-sm font-bold text-emerald-700">{awarded} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1">
          <Award className="w-3.5 h-3.5" /> Feedback
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">{feedback || 'No feedback provided.'}</p>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function SubmitAssignment() {
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [mode, setMode] = useState(SUBMIT_MODES.TEXT);
  const [textAnswer, setTextAnswer] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Load subjects
  useEffect(() => {
    apiFetch('/evaluator/subjects')
      .then(d => setSubjects(d.subjects || []))
      .catch(() => {});
  }, []);

  // Load assignments when subject changes
  useEffect(() => {
    if (!selectedSubject) { setAssignments([]); return; }
    apiFetch(`/evaluator/subjects/${selectedSubject}/assignments`)
      .then(d => setAssignments(d.assignments || []))
      .catch(() => {});
  }, [selectedSubject]);

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0];
    if (picked) setFile(picked);
    e.target.value = null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAssignment) { setError('Please select an assignment.'); return; }
    if (mode === SUBMIT_MODES.TEXT && !textAnswer.trim()) { setError('Please write your answer.'); return; }
    if (mode === SUBMIT_MODES.FILE && !file) { setError('Please upload a file.'); return; }

    setError('');
    setResult(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('assignment_id', selectedAssignment.id);

      if (mode === SUBMIT_MODES.TEXT) {
        formData.append('student_answer', textAnswer.trim());
      } else {
        formData.append('file', file);
      }

      const data = await apiFetch('/evaluator/assignments/submit', {
        method: 'POST',
        body: formData, // multipart works for both modes
      });

      setResult(data.result);
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setError('');
    setTextAnswer('');
    setFile(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Submit Assignment</h1>
              <p className="text-sm text-gray-500">AI-evaluated · Instant feedback · Groq-powered</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Subject Selector */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
              Subject
            </label>
            <div className="relative">
              <select
                value={selectedSubject}
                onChange={e => { setSelectedSubject(e.target.value); setSelectedAssignment(null); resetForm(); }}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Select a subject --</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Assignment Selector */}
          {assignments.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Assignment
              </label>
              <div className="space-y-2">
                {assignments.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setSelectedAssignment(a); resetForm(); }}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${selectedAssignment?.id === a.id
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2">{a.question}</p>
                        <p className="text-xs text-gray-400 mt-1 capitalize">{a.type} · {a.total_marks} marks</p>
                      </div>
                      {selectedAssignment?.id === a.id && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submission Mode Toggle + Input */}
          {selectedAssignment && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                Your Answer
              </label>

              {/* Mode Toggle */}
              <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setMode(SUBMIT_MODES.TEXT); setFile(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${mode === SUBMIT_MODES.TEXT
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FileText className="w-4 h-4" /> Type Answer
                </button>
                <button
                  type="button"
                  onClick={() => { setMode(SUBMIT_MODES.FILE); setTextAnswer(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${mode === SUBMIT_MODES.FILE
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Upload className="w-4 h-4" /> Upload File
                </button>
              </div>

              {/* Text Mode */}
              {mode === SUBMIT_MODES.TEXT && (
                <textarea
                  value={textAnswer}
                  onChange={e => setTextAnswer(e.target.value)}
                  placeholder="Write your answer here..."
                  rows={8}
                  className="w-full resize-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              )}

              {/* File Mode */}
              {mode === SUBMIT_MODES.FILE && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {file ? (
                    <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        <div>
                          <p className="text-sm font-semibold text-indigo-900">{file.name}</p>
                          <p className="text-xs text-indigo-400">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setFile(null)} className="p-1.5 rounded-full hover:bg-indigo-100 transition">
                        <X className="w-4 h-4 text-indigo-500" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-10 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2 text-gray-400 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-500 transition-all group"
                    >
                      <Upload className="w-7 h-7 group-hover:scale-110 transition-transform" />
                      <p className="text-sm font-semibold">Click to upload file</p>
                      <p className="text-xs">PDF, DOCX, or TXT · Max 20MB</p>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit Button */}
          {selectedAssignment && (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Evaluating with AI...</>
              ) : (
                <><Send className="w-5 h-5" /> Submit & Evaluate</>
              )}
            </button>
          )}
        </form>

        {/* Result */}
        {result && <ResultCard result={result} />}
      </div>
    </div>
  );
}
