// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState, useEffect } from 'react';
import { Search, Menu, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ContentRenderer } from './components/ContentRenderer';
import { SearchModal } from './components/SearchModal';
import { NavigationProvider } from './components/NavigationContext';
import { sections } from './content/sections';
import './documentation.css';

export const DocumentationPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Global keyboard shortcut: Cmd+K / Ctrl+K to toggle search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="-m-8 min-h-screen bg-white">
      {/* Top Navigation */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-xs">P</span>
              </div>
              <div>
                <h1 className="text-sm font-semibold text-slate-900">POIS Reference Server</h1>
                <p className="text-[10px] text-slate-500">Documentation</p>
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8 hidden md:block">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-3 pl-3 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg
                       hover:bg-slate-100 hover:border-slate-300 transition-colors duration-150 text-left"
            >
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="flex-1 text-slate-400">Search documentation...</span>
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium text-slate-400 bg-white border border-slate-200 rounded">
                {'\u2318'}K
              </kbd>
            </button>
          </div>


        </div>
      </div>

      {/* Content */}
      <div className="mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <Sidebar
          sections={sections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main */}
        <main className="flex-1 min-w-0">
          <NavigationProvider onNavigate={setActiveSection}>
            <ContentRenderer section={activeSection} />
          </NavigationProvider>
        </main>
      </div>

      {/* Search Modal */}
      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onNavigate={(id) => setActiveSection(id)}
        />
      )}
    </div>
  );
};
