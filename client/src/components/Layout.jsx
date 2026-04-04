import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import SideNavBar from './SideNavBar';
import TopNavBar from './TopNavBar';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="bg-surface text-on-surface flex h-screen overflow-hidden selection:bg-primary-fixed">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <SideNavBar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        <TopNavBar onToggleSidebar={() => setIsSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto w-full relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
