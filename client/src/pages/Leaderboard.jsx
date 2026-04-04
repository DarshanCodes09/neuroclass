import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';

// For the mock, we can seed or simulate users if they don't exist, 
// but let's assume we fetch from 'students' or just render a mock array for demonstration 
// if the DB is empty, while hooking into Firestore.

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, query a 'leaderboard' or 'users' collection with role='student'
    const q = query(collection(db, 'leaderboard'), orderBy('xp', 'desc'), limit(10));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });

      // Provide mock data if the collection is empty for the sake of the MVP demo
      if (data.length === 0) {
        data = [
          { id: '1', name: 'Elias Thorne', xp: 14500, avatar: null, change: '+12%' },
          { id: '2', name: 'Sophia Lin', xp: 13200, avatar: null, change: '+5%' },
          { id: '3', name: 'Marcus Chen', xp: 12850, avatar: null, change: '-2%' },
          { id: '4', name: 'Aaliyah Jones', xp: 11900, avatar: null, change: '+8%' },
          { id: '5', name: 'Oliver Smith', xp: 10500, avatar: null, change: '+1%' }
        ];
      }
      
      setLeaders(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center h-full">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="px-12 py-10 max-w-screen-xl mx-auto w-full">
      <div className="mb-12 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Trophy className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface">Global Leaderboard</h2>
          <p className="text-on-surface-variant font-medium mt-1">Top performing students across all active modules.</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-8 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/10">
              <th className="pb-4 pt-2 font-headline font-bold text-xs uppercase tracking-widest text-on-surface-variant w-24 text-center">Rank</th>
              <th className="pb-4 pt-2 font-headline font-bold text-xs uppercase tracking-widest text-on-surface-variant">Student</th>
              <th className="pb-4 pt-2 font-headline font-bold text-xs uppercase tracking-widest text-on-surface-variant text-right">Experience (XP)</th>
              <th className="pb-4 pt-2 font-headline font-bold text-xs uppercase tracking-widest text-on-surface-variant text-right w-32">Trend</th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((student, idx) => (
              <tr key={student.id} className="group hover:bg-surface-container-low transition-colors border-b border-outline-variant/5 last:border-0">
                <td className="py-6 text-center">
                  {idx === 0 ? <Medal className="w-6 h-6 text-amber-500 mx-auto" /> :
                   idx === 1 ? <Medal className="w-6 h-6 text-slate-400 mx-auto" /> :
                   idx === 2 ? <Medal className="w-6 h-6 text-amber-700 mx-auto" /> :
                   <span className="font-headline font-bold text-on-surface-variant">{idx + 1}</span>}
                </td>
                <td className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {student.avatar ? <img src={student.avatar} alt={student.name} className="w-full h-full rounded-full object-cover" /> : student.name.charAt(0)}
                    </div>
                    <span className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors">{student.name}</span>
                  </div>
                </td>
                <td className="py-6 text-right">
                  <span className="font-mono font-bold text-lg text-on-surface">{student.xp.toLocaleString()}</span>
                  <span className="text-xs text-on-surface-variant ml-1 font-bold">XP</span>
                </td>
                <td className="py-6 text-right">
                  <div className="flex items-center justify-end gap-1 text-emerald-500 font-bold text-sm">
                    <TrendingUp className="w-4 h-4" />
                    {student.change}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
