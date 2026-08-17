import React from 'react';
import { LayoutDashboard, Calendar, HandCoins, Award, Users, AlertTriangle, Download, Settings as SettingsIcon, LogOut, ShieldCheck } from 'lucide-react';
import { can } from '../utils/permissions';

// Single source for the tab strip so desktop and mobile can never drift apart.
const NAV_TABS = [
  { tab: 'dashboard', label: 'Dashboard', shortLabel: 'Home', Icon: LayoutDashboard },
  { tab: 'contributions', label: 'Contributions', shortLabel: 'Contrib', Icon: Calendar },
  { tab: 'loan-collections', label: 'Loan Collections', shortLabel: 'Loans', Icon: HandCoins },
  { tab: 'settlement', label: 'Year-End (Wk 52)', shortLabel: 'Wk 52', Icon: Award },
  { tab: 'members', label: 'Members', shortLabel: 'Members', Icon: Users },
  { tab: 'settings', label: 'Settings', shortLabel: 'Settings', Icon: SettingsIcon }
];

export default function Navbar({ activeTab, setActiveTab, groupStats, loggedInMember, onLogout, memberCount, weeklyAmount, access, role }) {
  // Only tabs this member may open. `access` is undefined only if a caller forgets to
  // pass it, in which case fall back to showing everything rather than an empty nav.
  const visibleTabs = access
    ? NAV_TABS.filter((t) => can(access, t.tab, 'view'))
    : NAV_TABS;

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
            <div className="brand-subtitle">{memberCount} Members • ₹{weeklyAmount || 1000} / Sunday</div>
          </div>
        </div>

        <div className="header-badges">
          <div className="pill-badge indigo">
            <span>👤 {loggedInMember?.name}</span>
          </div>

          {/* Everyone can see their own role, so read-only screens are never a surprise */}
          {role && (
            <div
              className="pill-badge"
              style={{
                background: `${role.color}22`,
                border: `1px solid ${role.color}`,
                color: role.color
              }}
              title={role.description}
            >
              <ShieldCheck size={14} />
              <span>{role.label}</span>
            </div>
          )}

          <div className="pill-badge emerald">
            <span>Week {groupStats.currentWeek} of 52</span>
          </div>

          {groupStats.totalOverdueMembersCount > 0 && (!access || can(access, 'defaulters', 'view')) && (
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
        {visibleTabs.map(({ tab, label, Icon }) => (
          <button
            key={tab}
            className={`nav-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      {/* aria-label/title carry the name because the visible label is hidden on
          very narrow screens, where six labels cannot fit side by side. */}
      <div className="mobile-bottom-nav">
        {visibleTabs.map(({ tab, shortLabel, Icon }) => (
          <button
            key={tab}
            className={`mobile-nav-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            aria-label={shortLabel}
            title={shortLabel}
          >
            <Icon size={20} />
            <span>{shortLabel}</span>
          </button>
        ))}
      </div>
    </>
  );
}
