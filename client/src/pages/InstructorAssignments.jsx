import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, getDocs } from 'firebase/firestore';
import { FileText, Plus, Calendar, AlertCircle } from 'lucide-react';

export default function InstructorAssignments({ courseIdFilter }) {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  
  // Form State
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    courseId: '',
    title: '',
    description: '',
    dueDate: '',
    maxScore: 100
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch instructed courses
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'courses'), where('instructorId', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const courseData = [];
      snapshot.forEach(doc => courseData.push({ id: doc.id, ...doc.data() }));
      setCourses(courseData);
      if (courseData.length > 0 && !formData.courseId) {
        setFormData(prev => ({ ...prev, courseId: courseIdFilter || courseData[0].id }));
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Fetch assignments created by this instructor
  useEffect(() => {
    if (!currentUser) return;
    const q = courseIdFilter 
       ? query(collection(db, 'assignments'), where('instructorId', '==', currentUser.uid), where('courseId', '==', courseIdFilter))
       : query(collection(db, 'assignments'), where('instructorId', '==', currentUser.uid));
       
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assnData = [];
      snapshot.forEach(doc => assnData.push({ id: doc.id, ...doc.data() }));
      // Sort in memory (simplest without composite index)
      assnData.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setAssignments(assnData);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.courseId || !formData.dueDate) {
      setError("Please fill all required fields.");
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Find course code to save alongside
      const course = courses.find(c => c.id === formData.courseId);
      
      await addDoc(collection(db, 'assignments'), {
        instructorId: currentUser.uid,
        courseId: formData.courseId,
        courseName: course?.courseName || 'Unknown Course',
        courseCode: course?.courseCode || '----',
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        maxScore: Number(formData.maxScore),
        createdAt: serverTimestamp()
      });
      
      setShowCreate(false);
      setFormData({ ...formData, title: '', description: '', dueDate: '', maxScore: 100 });
    } catch (err) {
      setError("Failed to create assignment: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`px-4 md:px-12 ${courseIdFilter ? 'py-4' : 'py-10 max-w-screen-2xl mx-auto'}`}>
      {!courseIdFilter && (
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface">Assignment Management</h2>
          <p className="text-on-surface-variant font-medium mt-1">Create and manage assignments across your modules.</p>
        </div>
        <button 
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-6 py-3 primary-gradient text-white rounded-full font-bold uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-primary/30 transition-shadow">
          <Plus className="w-4 h-4" />
          {showCreate ? 'Cancel' : 'New Assignment'}
        </button>
      </div>
      )}
      
      {courseIdFilter && (
        <div className="flex justify-between items-center mb-8 bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
          <h3 className="font-headline font-bold text-lg">Course Assignments</h3>
          <button 
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-6 py-2 primary-gradient text-white rounded-full font-bold uppercase tracking-widest text-[10px] hover:shadow-lg hover:shadow-primary/30 transition-shadow">
            <Plus className="w-3 h-3" />
            {showCreate ? 'Cancel' : 'Create Task'}
          </button>
        </div>
      )}

      {error && <div className="mb-6 p-4 bg-error/10 text-error rounded-xl flex items-center gap-3"><AlertCircle className="w-5 h-5"/>{error}</div>}

      {showCreate && (
        <div className="bg-surface-container-lowest glass-panel rounded-xl p-8 mb-10 border border-primary/20 shadow-xl shadow-primary/5 animate-fade-in">
          <h3 className="text-xl font-bold font-headline mb-6">Define New Assignment</h3>
          <form onSubmit={handleCreateAssignment} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Course Module</label>
                <select 
                  value={formData.courseId}
                  disabled={!!courseIdFilter}
                  onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                  className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary rounded-xl py-3 px-4 disabled:opacity-50">
                  {courses.map(c => <option key={c.id} value={c.id}>{c.courseCode} - {c.courseName}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Assignment Title</label>
                <input 
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary rounded-xl py-3 px-4"
                  placeholder="e.g. Midterm Logic Project"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Due Date</label>
                <input 
                  type="date"
                  required
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary rounded-xl py-3 px-4"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Max Score</label>
                <input 
                  type="number"
                  required
                  min="1"
                  value={formData.maxScore}
                  onChange={(e) => setFormData({...formData, maxScore: e.target.value})}
                  className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary rounded-xl py-3 px-4"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Description / Prompt</label>
              <textarea 
                rows="4"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary rounded-xl py-3 px-4 resize-none"
                placeholder="Detail the requirements, constraints, and expected deliverables..."
              ></textarea>
            </div>
            <div className="flex justify-end pt-4">
              <button disabled={loading} type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-full font-bold active:scale-95 transition-transform disabled:opacity-50">
                {loading ? 'Creating...' : 'Deploy Assignment'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignments.length === 0 && !showCreate && (
          <div className="col-span-12 flex flex-col items-center justify-center p-16 opacity-60 bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">
            <FileText className="w-12 h-12 mb-4 text-on-surface-variant" />
            <p className="font-bold">No assignments active</p>
            <p className="text-sm">Click "New Assignment" to generate tasks for your students.</p>
          </div>
        )}
        {assignments.map(assn => (
          <div key={assn.id} className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-6 hover:shadow-xl hover:shadow-primary/5 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <span className="bg-secondary-fixed text-on-secondary-fixed-variant px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                {assn.courseCode}
              </span>
              <div className="flex items-center gap-1 text-on-surface-variant">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-bold">{assn.dueDate}</span>
              </div>
            </div>
            <h4 className="font-bold font-headline text-lg mb-2">{assn.title}</h4>
            <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed mb-6">{assn.description}</p>
            
            <div className="pt-4 border-t border-outline-variant/10 flex justify-between items-center text-sm font-semibold">
              <span className="text-outline">Max Score: {assn.maxScore}</span>
              <button className="text-primary hover:text-indigo-600 transition-colors">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
