// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  items?: { id: string; title: string }[];
}

interface SidebarProps {
  sections: Section[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  activeSection,
  onSectionChange,
  isOpen,
  onClose,
}) => {
  const [expandedSections, setExpandedSections] = React.useState<string[]>(['getting-started', 'api']);

  const toggleSection = (id: string) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          hidden lg:block w-64 flex-shrink-0 sticky top-4 self-start
          max-h-[calc(100vh-10rem)] overflow-y-auto
        `}
      >
        <nav className="h-full overflow-y-auto p-4 lg:pr-0 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <div className="space-y-1">
            {sections.map((section) => (
              <div key={section.id}>
                <button
                  onClick={() => {
                    if (section.items) {
                      toggleSection(section.id);
                    } else {
                      onSectionChange(section.id);
                      onClose();
                    }
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg
                    transition-all duration-200 group
                    ${activeSection === section.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`
                      ${activeSection === section.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}
                    `}>
                      {section.icon}
                    </span>
                    <span>{section.title}</span>
                  </div>
                  {section.items && (
                    <ChevronRight
                      className={`w-4 h-4 transition-transform duration-200 ${
                        expandedSections.includes(section.id) ? 'rotate-90' : ''
                      }`}
                    />
                  )}
                </button>

                {/* Sub-items */}
                {section.items && expandedSections.includes(section.id) && (
                  <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSectionChange(item.id);
                          onClose();
                        }}
                        className={`
                          w-full text-left px-3 py-1.5 text-sm rounded-md
                          transition-all duration-200
                          ${activeSection === item.id
                            ? 'text-indigo-700 font-medium bg-indigo-50'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }
                        `}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
};
