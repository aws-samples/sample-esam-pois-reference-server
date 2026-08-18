// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, FileText } from 'lucide-react';
import { sections } from '../content/sections';

interface SearchItem {
  id: string;
  title: string;
  parent: string | null;
  keywords?: string[];
}

// Additional keywords for better search discovery
const SEARCH_KEYWORDS: Record<string, string[]> = {
  'configuration': ['rules', 'rule', 'conditions', 'priority', 'modifications', 'replace', 'delete', 'noop', 'action'],
  'how-to-create-channel': ['create', 'new channel', 'form', 'setup'],
  'descriptor-priority': ['segmentation', 'descriptor', 'priority', 'type id'],
  'stateful-mode': ['break', 'cue-in', 'cue-out', 'state', 'tracking'],
  'external-actions': ['medialive', 'webhook', 'trigger', 'action', 'plugin'],
  'virtual-input-switching': ['vis', 'switch', 'input', 'alternate', 'content', 'cue-out', 'cue-in', 'elemental'],
  'api-esam': ['esam', 'scte-35', 'signal', 'processing', 'post'],
  'api-channels': ['channels', 'crud', 'create', 'update', 'delete'],
  'authentication': ['cognito', 'login', 'rbac', 'roles', 'jwt', 'auth'],
  'environment': ['env', 'variables', 'config', 'lambda'],
  'correlation-tracking': ['correlation', 'tracking', 'request id'],
  'quick-start': ['deploy', 'install', 'setup', 'getting started'],
};

interface SearchModalProps {
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Build flat searchable array from sections
  const searchItems = useMemo<SearchItem[]>(() => {
    return sections.flatMap(section => [
      { id: section.id, title: section.title, parent: null, keywords: SEARCH_KEYWORDS[section.id] },
      ...(section.items?.map(item => ({
        id: item.id,
        title: item.title,
        parent: section.title,
        keywords: SEARCH_KEYWORDS[item.id],
      })) || []),
    ]);
  }, []);

  // Filter results based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return searchItems;
    const normalizedQuery = query.trim().toLowerCase();
    return searchItems.filter(item =>
      item.title.toLowerCase().includes(normalizedQuery) ||
      (item.keywords?.some(kw => kw.toLowerCase().includes(normalizedQuery)) ?? false)
    );
  }, [query, searchItems]);

  // Group filtered results by parent section
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};

    filteredItems.forEach(item => {
      const groupKey = item.parent || item.title;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    return groups;
  }, [filteredItems]);

  // Flat list of results for keyboard navigation
  const flatResults = useMemo(() => {
    const results: SearchItem[] = [];
    Object.values(groupedResults).forEach(group => {
      group.forEach(item => results.push(item));
    });
    return results;
  }, [groupedResults]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll active item into view
  useEffect(() => {
    const activeItem = itemRefs.current[activeIndex];
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleSelect = useCallback((id: string) => {
    onNavigate(id);
    onClose();
  }, [onNavigate, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev =>
          prev < flatResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev =>
          prev > 0 ? prev - 1 : flatResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (flatResults[activeIndex]) {
          handleSelect(flatResults[activeIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [flatResults, activeIndex, handleSelect, onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Highlight matched text in result titles
  const highlightMatch = (text: string): React.ReactNode => {
    if (!query.trim()) return text;

    const normalizedQuery = query.trim().toLowerCase();
    const lowerText = text.toLowerCase();
    const matchIndex = lowerText.indexOf(normalizedQuery);

    if (matchIndex === -1) return text;

    const before = text.slice(0, matchIndex);
    const match = text.slice(matchIndex, matchIndex + query.trim().length);
    const after = text.slice(matchIndex + query.trim().length);

    return (
      <>
        {before}
        <span className="font-semibold text-indigo-600">{match}</span>
        {after}
      </>
    );
  };

  // Track the flat index for keyboard navigation
  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start justify-center animate-fadeIn"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Search documentation"
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 mt-[15vh] animate-scaleIn overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documentation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-lg bg-transparent outline-none placeholder:text-slate-400 text-slate-900"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto py-2">
          {flatResults.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No results found</p>
              <p className="text-xs text-slate-400 mt-1">
                Try a different search term
              </p>
            </div>
          ) : (
            Object.entries(groupedResults).map(([groupName, items]) => (
              <div key={groupName}>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-4 pt-3 pb-1">
                  {groupName}
                </div>
                {items.map((item) => {
                  const currentIndex = flatIndex++;
                  const isActive = currentIndex === activeIndex;

                  return (
                    <button
                      key={item.id}
                      ref={(el) => { itemRefs.current[currentIndex] = el; }}
                      onClick={() => handleSelect(item.id)}
                      onMouseEnter={() => setActiveIndex(currentIndex)}
                      className={`
                        w-full px-4 py-2.5 flex items-center gap-3 cursor-pointer rounded-md mx-2
                        transition-colors duration-100
                        ${isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-700 hover:bg-indigo-50'
                        }
                      `}
                      style={{ width: 'calc(100% - 16px)' }}
                    >
                      <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-sm font-medium truncate">
                          {highlightMatch(item.title)}
                        </span>
                        {item.parent && (
                          <span className="text-xs text-slate-400 truncate">
                            {item.parent}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-slate-200 px-4 py-2.5 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
};
