import React from 'react';
import { LayoutDashboard, Calendar, HandCoins, Award, Users, AlertTriangle, Download, Settings as SettingsIcon, LogOut } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, groupStats, loggedInMember, onLogout }) {
  return (
    <>
      {/* Top Header */}
      <header className="top-bar">
        <div className="brand">
          <div className="brand-icon">
            <HandCoins size={24} />
          </div>
          <div>
            <h1 className="brand-title">Isthooi</h1>
            <div className="brand-subtitle">10 Members • ₹1,000 / Sunday</div>
          </div>
        </div>

        <div className="header-badges">
          <div className="pill-badge indigo">
            <span>👤 {loggedInMember?.name}</span>
          </div>

          <div className="pill-badge emerald">
            <span>Week {groupStats.currentWeek} of 52</span>
          </div>

          {groupStats.totalOverdueMembersCount > 0 && (
            <div
              className={`pill-badge ${groupStats.totalBlockedMembersCount > 0 ? 'rose' : 'gold'}`}
              onClick={() => setActiveTab('defaulters')}
              style={{ cursor: 'pointer' }}
            >
              <AlertTriangle size={14} />
              <span>{groupStats.totalOverdueMembersCount} Overdue</span>
            </div>
          )}

          <button
            onClick={onLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
              e.currentTarget.style.borderColor = '#f87171';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = '#ef4444';
            }}
            title="Logout"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* Desktop Navigation Tabs */}
      <nav className="desktop-nav">
        <button
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'contributions' ? 'active' : ''}`}
          onClick={() => setActiveTab('contributions')}
        >
          <Calendar size={18} />
          <span>Contributions</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'loan-collections' ? 'active' : ''}`}
          onClick={() => setActiveTab('loan-collections')}
        >
          <HandCoins size={18} />
          <span>Loan Collections</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'loans' ? 'active' : ''}`}
          onClick={() => setActiveTab('loans')}
        >
          <HandCoins size={18} />
          <span>Loans (10% Fee)</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'defaulters' ? 'active' : ''}`}
          onClick={() => setActiveTab('defaulters')}
        >
          <AlertTriangle size={18} />
          <span>3-Wk Rules</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settlement' ? 'active' : ''}`}
          onClick={() => setActiveTab('settlement')}
        >
          <Award size={18} />
          <span>Year-End (Wk 52)</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <Users size={18} />
          <span>Members</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          <Download size={18} />
          <span>Backup</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <SettingsIcon size={18} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <div className="mobile-bottom-nav">
        <button
          className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Home</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeTab === 'contributions' ? 'active' : ''}`}
          onClick={() => setActiveTab('contributions')}
        >
          <Calendar size={20} />
          <span>Contrib</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeTab === 'loans' ? 'active' : ''}`}
          onClick={() => setActiveTab('loans')}
        >
          <HandCoins size={20} />
          <span>Loans</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeTab === 'defaulters' ? 'active' : ''}`}
          onClick={() => setActiveTab('defaulters')}
        >
          <AlertTriangle size={20} />
          <span>Alerts</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeTab === 'settlement' ? 'active' : ''}`}
          onClick={() => setActiveTab('settlement')}
        >
          <Award size={20} />
          <span>Wk 52</span>
        </button>
      </div>
    </>
  );
}
