// client/src/pages/Leaderboard.jsx
import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Star, Filter, Loader2, Search, ArrowUpRight } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8000/api';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('global');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSubjects();
    fetchLeaderboard('global');
  }, []);

  const fetchSubjects = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/courses`);
      const data = await resp.json();
      setSubjects(data.courses || []);
    } catch (err) {
      console.error('Failed to fetch courses', err);
    }
  };

  const fetchLeaderboard = async (subjectId) => {
    setLoading(true);
    try {
      const url = subjectId === 'global' 
        ? `${API_BASE_URL}/leaderboard`
        : `${API_BASE_URL}/leaderboard/${subjectId}`;
      const resp = await fetch(url);
      const data = await resp.json();
      setLeaderboard(data || []);
    } catch (err) {
      console.error('Failed to fetch leaderboard', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectChange = (e) => {
    const val = e.target.value;
    setSelectedSubject(val);
    fetchLeaderboard(val);
  };

  const filteredData = leaderboard.filter(s => 
    s.student_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getBadgeIcon = (badge) => {
    switch (badge) {
      case 'gold': return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 'silver': return <Medal className="w-6 h-6 text-slate-400" />;
      case 'bronze': return <Medal className="w-6 h-6 text-amber-600" />;
      default: return null;
    }
  };

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="max-w-2xl">
          <span className="text-xs font-bold tracking-[0.3em] text-indigo-600 uppercase mb-2 block font-headline">Student Success</span>
          <h2 className="text-4xl font-headline font-black tracking-tight text-slate-900">Academic Leaderboard</h2>
          <p className="text-slate-700 mt-3 text-base leading-relaxed font-medium">
            Witness the top performers across the platform. Achievements are calculated based on AI-evaluated performance, consistency, and early excellence.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 ring-primary/20 transition-all w-64"
            />
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={selectedSubject}
              onChange={handleSubjectChange}
              className="bg-transparent border-none text-sm font-semibold focus:ring-0 cursor-pointer text-slate-700 dark:text-slate-200"
            >
              <option value="global">Global Ranking</option>
              {subjects.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.courseName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top 3 Spotlight */}
      {!loading && filteredData.length >= 3 && searchTerm === '' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {[1, 0, 2].map((idx) => {
            const student = filteredData[idx];
            if (!student) return null;
            const isFirst = student.rank === 1;
            return (
              <div 
                key={student.student_id}
                className={`relative flex flex-col items-center bg-white dark:bg-slate-900 p-8 rounded-3xl border ${isFirst ? 'border-yellow-400/50 scale-105 shadow-2xl shadow-yellow-500/5 z-10' : 'border-slate-200 dark:border-slate-800 shadow-xl'} transition-all`}
              >
                {isFirst && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-950 font-black px-4 py-1 rounded-full text-[10px] uppercase tracking-tighter flex items-center gap-1 shadow-lg">
                    <Trophy className="w-3 h-3" /> Champion
                  </div>
                )}
                
                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-2xl font-black text-slate-600 dark:text-slate-300 shadow-inner">
                  {student.student_name.charAt(0)}
                </div>

                <div className="text-center">
                  <h3 className="font-headline font-black text-xl text-slate-900 dark:text-white mb-1 truncate max-w-[180px]">{student.student_name}</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1">
                    {getBadgeIcon(student.badge)} Rank #{student.rank}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Avg Score</p>
                    <p className="font-headline font-black text-2xl text-primary">{student.avg_score}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                    <p className="font-headline font-black text-2xl text-slate-700 dark:text-slate-200">{Math.floor(student.total_score)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl shadow-slate-500/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Student Name</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Score</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Score</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Assignments</th>
                <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-sm font-semibold text-slate-500">Calculating rankings...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((s) => (
                  <tr key={s.student_id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                          s.rank <= 3 ? 'bg-primary text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {s.rank}
                        </span>
                        {getBadgeIcon(s.badge)}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div>
                        <p className="font-headline font-bold text-slate-900 dark:text-white">{s.student_name}</p>
                        <p className="text-xs text-slate-500">NeuroClass ID: {s.student_id.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 w-24 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${Math.min(s.avg_score * 10, 100)}%` }}
                          />
                        </div>
                        <span className="font-headline font-black text-slate-900 dark:text-white">{s.avg_score}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-headline font-black text-slate-700 dark:text-slate-300">{Math.floor(s.total_score)}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                        {s.assignments_completed} Done
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button className="p-2 text-slate-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                        <ArrowUpRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-20 text-center opacity-60">
                    <Star className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="font-headline font-bold text-lg">No rankings available yet</p>
                    <p className="text-sm">Complete assignments to appear on the leaderboard.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
