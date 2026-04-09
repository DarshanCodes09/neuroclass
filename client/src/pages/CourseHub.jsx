import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, MoreVertical, Send, Loader2, Calendar } from 'lucide-react';
import StudentAssignments from './StudentAssignments';
import InstructorAssignments from './InstructorAssignments';
import AITutor from './AITutor';
import { aiService } from '../services/aiService';

function getCommentsStorageKey(courseId) {
  return `neuroclass:course-comments:${courseId}`;
}

export default function CourseHub() {
  const { courseId } = useParams();
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [activeTab, setActiveTab] = useState('stream'); // stream, classwork, ai_tutor, people
  const [announcements, setAnnouncements] = useState([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);
  
  // Comments state
  const [comments, setComments] = useState({}); // { postId: [...] }
  const [commentDrafts, setCommentDrafts] = useState({}); // { postId: text }
  const [expandedComments, setExpandedComments] = useState({}); // { postId: boolean }

  // Fetch Course details
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    aiService.fetchCourseById(courseId)
      .then((data) => { if (!cancelled) setCourse(data.course); })
      .catch(() => navigate(`/${userRole?.toLowerCase() || 'instructor'}/dashboard`));
    return () => { cancelled = true; };
  }, [courseId, navigate, userRole]);

  // Fetch Announcements
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    const load = async () => {
      const data = await aiService.fetchAnnouncements(courseId);
      if (!cancelled) setAnnouncements(data.announcements || []);
    };
    load();
    const interval = setInterval(load, 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [courseId]);

  // Fetch Upcoming Assignments
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    const load = async () => {
      const data = await aiService.fetchAssignments({ courseId });
      const assns = (data.assignments || []).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      if (!cancelled) setUpcomingAssignments(assns);
    };
    load();
    const interval = setInterval(load, 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [courseId]);

  // Load locally persisted comments
  useEffect(() => {
    if (!courseId) return;
    try {
      const raw = localStorage.getItem(getCommentsStorageKey(courseId));
      setComments(raw ? JSON.parse(raw) : {});
    } catch (error) {
      console.error('Failed to load course comments:', error);
      setComments({});
    }
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;
    localStorage.setItem(getCommentsStorageKey(courseId), JSON.stringify(comments));
  }, [comments, courseId]);

  const handlePostComment = async (postId) => {
    const text = commentDrafts[postId]?.trim();
    if (!text || !currentUser) return;

    const nextComment = {
      id: crypto.randomUUID(),
      courseId,
      postId,
      text,
      authorId: currentUser.uid,
      authorName: currentUser.displayName || currentUser.email.split('@')[0],
      authorPhoto: currentUser.photoURL || null,
      createdAt: new Date().toISOString(),
    };

    setComments((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), nextComment],
    }));
    setCommentDrafts(prev => ({ ...prev, [postId]: '' }));
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.trim()) return;
    
    try {
      setLoadingMsg(true);
      await aiService.postAnnouncement(courseId, {
        text: newAnnouncement,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email.split('@')[0],
        authorPhoto: currentUser.photoURL || null
      });
      setNewAnnouncement('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMsg(false);
    }
  };

  if (!course) {
    return (
      <div className="w-full h-[calc(100vh-80px)] flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderStream = () => (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 mt-6">
      {/* Left Sidebar: Upcoming */}
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-6">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold font-headline text-sm mb-4 text-on-surface">Upcoming</h3>
          {upcomingAssignments.length === 0 ? (
            <p className="text-xs text-on-surface-variant mb-4">Woohoo, no work due soon!</p>
          ) : (
             <div className="space-y-3 mb-4">
               {upcomingAssignments.slice(0, 3).map(assn => (
                 <div key={assn.id} className="text-xs group cursor-pointer" onClick={() => setActiveTab('classwork')}>
                    <span className="font-semibold block truncate group-hover:text-primary transition-colors">{assn.title}</span>
                    <span className="text-on-surface-variant flex items-center gap-1 mt-1"><Calendar className="w-3 h-3"/> {assn.dueDate}</span>
                 </div>
               ))}
             </div>
          )}
          <button onClick={() => setActiveTab('classwork')} className="text-xs font-bold text-primary hover:underline float-right">View all</button>
          <div className="clear-both"></div>
        </div>
      </div>

      {/* Main Feed */}
      <div className="flex-1 space-y-6">
        {/* Post Input */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-sm overflow-hidden transition-all focus-within:shadow-md focus-within:border-primary/40">
          <form onSubmit={handlePostAnnouncement}>
            <div className="p-4 flex gap-4 items-start">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="Avatar" className="w-10 h-10 rounded-full shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                  {currentUser.displayName?.charAt(0) || currentUser.email.charAt(0).toUpperCase()}
                </div>
              )}
              <textarea 
                value={newAnnouncement}
                onChange={(e) => setNewAnnouncement(e.target.value)}
                placeholder={userRole === 'Instructor' ? "Announce something to your class" : "Share something with your class..."}
                className="w-full bg-transparent border-none resize-none focus:ring-0 text-sm py-2 min-h-[40px] text-on-surface"
                rows="2"
              ></textarea>
            </div>
            {newAnnouncement.trim() && (
              <div className="bg-surface-container-low px-4 py-3 flex justify-end border-t border-outline-variant/10">
                <button 
                  disabled={loadingMsg}
                  type="submit" 
                  className="bg-primary text-white px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-2">
                  {loadingMsg ? <Loader2 className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3"/>}
                  Post
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Announcements List */}
        {announcements.map((post) => (
          <div key={post.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                 {post.authorPhoto ? (
                    <img src={post.authorPhoto} alt="Avatar" className="w-10 h-10 rounded-full shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold shrink-0">
                      {post.authorName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-sm leading-tight text-on-surface">{post.authorName}</h4>
                    <span className="text-[10px] text-on-surface-variant font-medium">
                      {post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                    </span>
                  </div>
              </div>
              {userRole === 'Instructor' && <button className="text-on-surface-variant hover:bg-surface-container p-2 rounded-full"><MoreVertical className="w-4 h-4"/></button>}
            </div>
            <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{post.text}</p>
            
            <div 
              onClick={() => setExpandedComments(prev => ({...prev, [post.id]: !prev[post.id]}))}
              className="mt-4 pt-4 border-t border-outline-variant/10 text-xs text-on-surface-variant font-semibold flex items-center gap-2 hover:bg-surface-container-low w-max px-3 py-2 rounded-full cursor-pointer transition-colors">
              <MessageSquare className="w-4 h-4" /> {comments[post.id]?.length || 0} class comments
            </div>
            
            {expandedComments[post.id] && (
              <div className="mt-4 space-y-4">
                {/* Existing Comments */}
                <div className="space-y-4">
                  {(comments[post.id] || []).map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      {comment.authorPhoto ? (
                        <img src={comment.authorPhoto} alt="Avatar" className="w-8 h-8 rounded-full shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold shrink-0 text-[10px]">
                          {comment.authorName?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-on-surface">{comment.authorName}</span>
                          <span className="text-[10px] text-on-surface-variant font-medium">
                            {comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface mt-0.5">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Add Comment Input */}
                <div className="flex gap-3 items-center pt-2">
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-full shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0 text-[10px]">
                      {currentUser.displayName?.charAt(0) || currentUser.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <input 
                    type="text"
                    value={commentDrafts[post.id] || ''}
                    onChange={(e) => setCommentDrafts(prev => ({...prev, [post.id]: e.target.value}))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handlePostComment(post.id);
                      }
                    }}
                    placeholder="Add class comment..."
                    className="flex-1 bg-surface-container-low text-xs border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary rounded-full py-2 px-4 outline-none"
                  />
                  <button 
                    onClick={() => handlePostComment(post.id)}
                    disabled={!commentDrafts[post.id]?.trim()}
                    className="p-2 text-primary hover:bg-surface-container-low rounded-full disabled:opacity-50 transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-surface font-body">
      {/* Tabs / Header Navigation */}
      <div className="border-b border-outline-variant/20 bg-white/50 backdrop-blur-xl sticky top-0 z-10 px-4 md:px-12">
        <div className="max-w-6xl mx-auto flex gap-6 md:gap-8 overflow-x-auto custom-scrollbar no-scrollbar-on-mobile">
          {['stream', 'classwork', 'ai_tutor', 'people'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-2 text-sm font-bold capitalize transition-colors relative whitespace-nowrap ${activeTab === tab ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {tab.replace('_', ' ')}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full"></div>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-12 pb-12">
        
        {/* Render Only Hero in Stream or Classwork */}
        {(activeTab === 'stream' || activeTab === 'classwork') && (
          <div className="max-w-6xl mx-auto mt-6">
            {/* Hero Image / Banner */}
            <div className="w-full h-40 md:h-64 rounded-2xl overflow-hidden relative shadow-md feature-card-bg">
              <div className="absolute inset-0 bg-teal-700/90 mix-blend-multiply"></div>
              {/* Optional background image could go here */}
              <div className="absolute inset-0 primary-gradient opacity-80 z-0"></div>
              <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 z-10 text-white">
                <h1 className="text-3xl md:text-5xl font-black font-headline tracking-tight mb-2 drop-shadow-md">{course.courseName}</h1>
                <p className="text-lg md:text-xl font-medium text-white/90 drop-shadow-md">{course.courseCode} | {course.academicLevel}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Content Loading */}
        {activeTab === 'stream' && renderStream()}
        {activeTab === 'classwork' && (
          <div className="max-w-6xl mx-auto mt-6 bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden shadow-sm min-h-[500px]">
             {userRole === 'Instructor' ? (
                <InstructorAssignments courseIdFilter={courseId} />
             ) : (
                <StudentAssignments courseIdFilter={courseId} />
             )}
          </div>
        )}
        {activeTab === 'ai_tutor' && (
          <div className="max-w-6xl mx-auto mt-6 bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden shadow-sm h-[600px] mb-8">
             <AITutor courseIdFilter={courseId} />
          </div>
        )}
        {activeTab === 'people' && (
          <div className="max-w-6xl mx-auto mt-8 bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-12 text-center text-on-surface-variant">
             <h3 className="font-headline font-bold text-xl mb-4 text-on-surface">Roster Pending</h3>
             <p>Instructor and enrolled students will appear here.</p>
          </div>
        )}

      </div>
    </div>
  );
}
