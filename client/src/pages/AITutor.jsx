import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, Sparkles, CheckCircle, Paperclip, ArrowUp, FileText, Library } from 'lucide-react';
import { aiService } from '../services/aiService';

function getTutorStorageKey(userId) {
  return `neuroclass:tutor:${userId}`;
}

export default function AITutor({ courseIdFilter }) {
  const { currentUser, userRole } = useAuth();
  const location = useLocation();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseIdFilter || null);
  
  const [allMessages, setAllMessages] = useState([]);
  const [messages, setMessages] = useState([]);
  
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // 1. Fetch user's courses to populate sidebar
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    const loadCourses = async () => {
      try {
        const filters = userRole === 'Instructor' ? { instructorId: currentUser.uid } : { studentId: currentUser.uid };
        const data = await aiService.fetchCourses(filters);
        if (cancelled) return;
        const courseData = data.courses || [];
        setCourses(courseData);
        
        // Auto-select course
        if (courseIdFilter) {
          setSelectedCourseId(courseIdFilter);
        } else if (location.state?.selectedCourseId) {
          setSelectedCourseId(location.state.selectedCourseId);
        } else if (courseData.length > 0) {
          setSelectedCourseId(prev => prev || courseData[0].id);
        }
      } catch (err) {
         console.error("Failed to load courses for AI Tutor:", err);
      }
    };

    loadCourses();
    const interval = setInterval(loadCourses, 10000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [currentUser, userRole, location.state, courseIdFilter]);

  // 2. Load message history from local persistence
  useEffect(() => {
    if (!currentUser) return;
    try {
      const raw = localStorage.getItem(getTutorStorageKey(currentUser.uid));
      setAllMessages(raw ? JSON.parse(raw) : []);
    } catch (error) {
      console.error('Failed to load tutor messages:', error);
      setAllMessages([]);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getTutorStorageKey(currentUser.uid), JSON.stringify(allMessages));
  }, [allMessages, currentUser]);

  // 3. Filter messages locally by the actively selected course
  useEffect(() => {
    if (selectedCourseId) {
      setMessages(allMessages.filter(m => m.courseId === selectedCourseId));
      scrollToBottom();
    }
  }, [allMessages, selectedCourseId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !currentUser) return;
    if (!selectedCourseId) {
      alert("Please select a course to start chatting.");
      return;
    }

    const nextInput = inputText.trim();
    const userMsg = {
      id: crypto.randomUUID(),
      text: nextInput,
      role: 'user',
      userId: currentUser.uid,
      courseId: selectedCourseId,
      createdAt: new Date().toISOString(),
      avatar: currentUser.photoURL || null
    };

    setInputText('');
    setAllMessages((prev) => [...prev, userMsg]);
    
    try {
      setIsTyping(true);
      try {
        const historyContext = [...messages, userMsg].slice(-6).map(m => ({ 
          role: m.role === 'ai' ? 'model' : 'user', 
          content: m.text 
        }));
        
        const aiResponseText = await aiService.chatWithTutor(nextInput, selectedCourseId, historyContext);
        setAllMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          text: aiResponseText,
          role: 'ai',
          userId: currentUser.uid,
          courseId: selectedCourseId,
          createdAt: new Date().toISOString()
        }]);
      } catch (err) {
        console.error("AI Error:", err);
        setAllMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          text: "I'm having trouble connecting to the NeuroClass AI Core. Please ensure the backend server is running.",
          role: 'ai',
          userId: currentUser.uid,
          courseId: selectedCourseId,
          createdAt: new Date().toISOString()
        }]);
      } finally {
        setIsTyping(false);
      }

    } catch (err) {
      console.error("Error sending message", err);
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !selectedCourseId) return;

    try {
      setUploading(true);
      const downloadURL = URL.createObjectURL(file);
      setAllMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        text: `Attached file: ${file.name}`,
        fileUrl: downloadURL,
        fileName: file.name,
        role: 'user',
        userId: currentUser.uid,
        courseId: selectedCourseId,
        createdAt: new Date().toISOString(),
        avatar: currentUser.photoURL || null
      }]);

    } catch (err) {
      console.error("Error uploading file", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Find active course details for the sidebar context showing
  const activeCourse = courses.find(c => c.id === selectedCourseId);

  return (
    <div className={`flex-1 flex overflow-hidden ${courseIdFilter ? 'h-full bg-transparent' : 'h-full'}`}>
      {/* Chat History / Course Selector Sidebar (Hidden if embedded) */}
      {!courseIdFilter && (
      <aside className="w-80 bg-surface-container-low flex flex-col border-none shrink-0 border-r border-outline-variant/10">
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline text-lg font-bold tracking-tight text-primary">Conversations</h2>
            <button className="p-2 bg-surface-container-lowest rounded-full shadow-sm hover:shadow-md transition-shadow">
              <Plus className="w-5 h-5 text-primary" />
            </button>
          </div>
          
          <div className="space-y-3 overflow-y-auto flex-1 no-scrollbar">
            {courses.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-6 opacity-50 text-center">
                 <Library className="w-8 h-8 mb-2" />
                 <p className="text-xs font-semibold">No active courses found. Join or create one first.</p>
               </div>
            ) : (
              courses.map(course => (
                <div 
                  key={course.id}
                  onClick={() => setSelectedCourseId(course.id)}
                  className={`p-4 rounded-xl shadow-sm border-l-4 cursor-pointer transition-all ${selectedCourseId === course.id ? 'bg-surface-container-lowest border-primary' : 'bg-surface-container border-transparent hover:bg-surface-container-high'}`}
                >
                  {selectedCourseId === course.id && <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-1">Current</p>}
                  <h3 className="font-headline font-semibold text-sm line-clamp-1">{course.courseName}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">{course.courseCode}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
      )}
      
      {/* Central Conversation Thread */}
      <section className="flex-1 flex flex-col relative bg-surface-bright min-w-0">
        {/* Background aesthetic gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none z-0"></div>
        
        {/* Chat Viewport */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar max-w-4xl mx-auto w-full z-10">
          
          {!selectedCourseId ? (
             <div className="flex flex-col items-center justify-center h-full opacity-60 text-center">
               <Sparkles className="w-12 h-12 mb-4 text-primary" />
               <p className="text-lg font-headline font-bold">Select a Course Module</p>
               <p className="text-sm">Choose a course from the sidebar to initialize the AI Tutor.</p>
             </div>
          ) : messages.length === 0 && !isTyping ? (
             <div className="flex flex-col items-center justify-center h-full opacity-60 text-center">
               <Sparkles className="w-12 h-12 mb-4 text-primary" />
               <p className="text-lg font-headline font-bold">Start a conversation for {activeCourse?.courseName}</p>
               <p className="text-sm max-w-sm mt-2">I'm restricted to this course's syllabus and trained evaluation models. Ask me anything!</p>
             </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 items-start ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'ai' && (
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Sparkles className="w-5 h-5 text-primary-fixed-variant" />
                  </div>
                )}
                
                {msg.role === 'ai' ? (
                  <div className="glass-panel p-6 rounded-md shadow-xl shadow-on-surface/5 border border-white/20 max-w-3xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-2">NeuroClass AI Tutor</p>
                    <div className="space-y-4 text-on-surface leading-relaxed whitespace-pre-wrap">
                      <p className="font-headline text-md font-medium leading-snug">{msg.text}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="max-w-2xl bg-gradient-to-br from-primary to-secondary text-white p-5 rounded-md shadow-lg shadow-primary/20">
                      <p className="leading-relaxed font-medium whitespace-pre-wrap">{msg.text}</p>
                      {msg.fileUrl && (
                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs bg-white/20 px-3 py-1 rounded hover:bg-white/30 transition-colors">
                          View Attachment ↗
                        </a>
                      )}
                    </div>
                    {msg.avatar ? (
                      <img className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-primary/20" src={msg.avatar} alt="User avatar"/>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex-shrink-0 border-2 border-primary/20 text-indigo-700 flex items-center justify-center font-bold">
                        {currentUser?.displayName?.charAt(0) || 'U'}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
          
          {/* AI Typing State */}
          {isTyping && (
            <div className="flex gap-4 items-start animate-pulse">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary-fixed-variant" />
              </div>
              <div className="glass-panel px-6 py-4 rounded-md border border-white/20 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{animationDelay: "-0.15s"}}></div>
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{animationDelay: "-0.3s"}}></div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary ml-2">Synthesizing resources...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="p-8 max-w-4xl mx-auto w-full bg-transparent z-10 shrink-0">
          <div className="glass-panel p-2 rounded-lg shadow-2xl shadow-on-surface/10 border border-white/50 bg-white/50 backdrop-blur-xl">
            {/* Precision Toggle */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/10 mb-2">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Scholarly Precision Mode</span>
              </div>
              <div className="w-10 h-5 bg-primary/20 rounded-full relative p-0.5 cursor-pointer">
                <div className="w-4 h-4 bg-primary rounded-full shadow-sm translate-x-5 transition-transform"></div>
              </div>
            </div>
            
            <form onSubmit={handleSendMessage} className="flex items-end gap-3 p-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !selectedCourseId}
                className={`p-3 text-on-surface-variant hover:bg-surface-container rounded-full transition-all ${uploading ? 'opacity-50 animate-pulse' : ''}`}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={!selectedCourseId}
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 font-body text-base text-on-surface placeholder:text-on-surface-variant/40 max-h-48 no-scrollbar outline-none disabled:opacity-50" 
                placeholder={selectedCourseId ? "Type your inquiry here..." : "Select a course first..."}
                rows="1"
              />
              <button 
                type="submit"
                disabled={!inputText.trim() || isTyping || !selectedCourseId}
                className="p-3 bg-gradient-to-r from-primary to-secondary text-white rounded-full shadow-lg shadow-primary/30 hover:scale-110 transition-transform disabled:opacity-50 disabled:scale-100"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            </form>
            
            <div className="px-4 pb-2 flex justify-between items-center mt-2">
              <div className="flex gap-2 opacity-50">
                <span className="px-2 py-0.5 bg-surface-container-high rounded-full text-[9px] font-bold uppercase text-on-surface-variant">Course Module Engine</span>
              </div>
              <p className="text-[10px] text-on-surface-variant/40">Tokens remaining: 4,210</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Knowledge Context */}
      <aside className="w-72 bg-surface-container-lowest border-l border-outline-variant/10 p-6 hidden xl:block shrink-0 h-full overflow-y-auto">
        <h2 className="font-headline text-sm font-black uppercase tracking-widest text-on-surface-variant mb-6">Course Context</h2>
        
        {!activeCourse ? (
           <div className="opacity-50 flex flex-col items-center justify-center h-48 text-center mt-12">
             <Library className="w-8 h-8 mb-2" />
             <p className="text-xs">Context will load once a course is selected.</p>
           </div>
        ) : (
        <div className="space-y-6">
          {/* Module Card */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">Active Module</p>
            <h4 className="font-headline font-bold text-sm mb-2 leading-snug">{activeCourse.courseName}</h4>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-gradient-to-r from-primary to-secondary"></div>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-2">64% Progress</p>
            <p className="text-[10px] font-bold uppercase text-primary mt-4 tracking-widest">Pedagogy: {activeCourse.pedagogyStyle}</p>
          </div>
          
          {/* Suggested Reading */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Course Materials</p>
            {activeCourse.assets && activeCourse.assets.length > 0 ? (
              <div className="space-y-4">
                {activeCourse.assets.map((asset, idx) => (
                  <div key={idx} className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold line-clamp-1 truncate" title={asset.fileName}>{asset.fileName}</p>
                      <a href={asset.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">View Asset</a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
               <p className="text-xs italic text-on-surface-variant">No explicit assets were uploaded during initialization.</p>
            )}
          </div>
          
          {/* Graph Image Placeholder */}
          <div className="mt-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Knowledge Map</p>
            <div className="rounded-xl overflow-hidden aspect-square relative border border-outline-variant/10">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-secondary/10"></div>
              <img className="w-full h-full object-cover mix-blend-overlay" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuC98XRBnWwWWDSvdBob66HN_n_XoScNk81h_zJEfQVnhZIfPBA37HRRcZNlFt3zWfaF-GtmUHtM7ufHdlQmCZDoKr7wA0sicG280PGW4XemthC_aQdonuWyZAoNuIJ00IarvNDA_IC_bAL_xJslOq1UUHOk7gnJWX85GSqjDdepJesgAr8G7Q2ZjnuTqj1i4tQSvSW56YhCbV0wXlPERavOx-PpAp-v-3p6TBBzd_ce_Ch48gsQQWod-cRDVGR1jQIhLF0wCSSx79" alt="Knowledge map"/>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold shadow-sm cursor-pointer hover:bg-white transition-colors">View Full Graph</span>
              </div>
            </div>
          </div>
          
        </div>
        )}
      </aside>
      
    </div>
  );
}
