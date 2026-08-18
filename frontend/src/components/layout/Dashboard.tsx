// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { useState } from 'react';
import {
  Radio,
  Activity,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  LogOut,
  BookOpen,
} from 'lucide-react';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  const isAdmin = user?.groups?.includes('admin');

  const menuItems = [
    { path: '/channels', label: 'Channels', icon: Radio },
    { path: '/monitoring', label: 'Monitoring', icon: Activity },
    ...(isAdmin ? [{ path: '/users', label: 'Users', icon: Users }] : []),
    { path: '/documentation', label: 'Documentation', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-slate-200 transition-all duration-200 ${
          sidebarOpen ? 'w-60' : 'w-16'
        } flex flex-col h-screen sticky top-0`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-100">
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
                <Radio className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900 text-sm tracking-tight">
                POIS
              </span>
            </div>
          ) : (
            <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center mx-auto">
              <Radio className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2 mb-0.5 rounded-md transition-colors text-[13px] ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 font-medium border-l-2 border-indigo-600 ml-0 pl-[10px]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {sidebarOpen && <span className="ml-3">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-2 border-t border-slate-100">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-1.5 hover:bg-slate-50 rounded-md transition-colors text-slate-400"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="h-full px-8 flex justify-between items-center">
            <h1 className="text-sm font-medium text-slate-600">
              POIS Reference Server
            </h1>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                v2.0
              </span>

              {/* User Avatar */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center p-1 hover:bg-slate-50 rounded-md transition-colors"
                >
                  <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 text-xs font-medium">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>

                {/* Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 z-50 animate-scaleIn origin-top-right">
                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User className="h-3.5 w-3.5 mr-2 text-slate-400" />
                        Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-3.5 w-3.5 mr-2" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
