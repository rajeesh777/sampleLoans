import React, { useState } from 'react';
import { Settings as SettingsIcon, Calendar, Hash, Lock, LockOpen, CheckCircle2 } from 'lucide-react';

export default function Settings({ state, onUpdateSettings, onCeaseWeek, onToggleEditLock }) {
  const [startDate, setStartDate] = useState(state.startDate || '2026-01-04');
  const [totalWeeks, setTotalWeeks] = useState(state.totalWeeks || 52);
  const [groupName, setGroupName] = useState(state.groupName || '');
  const [groupUpiVpa, setGroupUpiVpa] = useState(state.groupUpiVpa || '');
  const [weeklyAmount, setWeeklyAmount] = useState(state.weeklyAmount || 1000);
  const [groupNotes, setGroupNotes] = useState(state.groupNotes || '');
  const [saveMessage, setSaveMessage] = useState('');
  const [editLocked, setEditLocked] = useState(state.editLocked || false);
  const [selectedWeeksToCease, setSelectedWeeksToCease] = useState([]);
  const [ceaseConfirm, setCeaseConfirm] = useState(false);

  const handleSaveSettings = () => {
    if (!startDate) {
      alert('Please enter a starting date');
      return;
    }

    if (totalWeeks < 1 || totalWeeks > 104) {
      alert('Total weeks must be between 1 and 104');
      return;
    }

    onUpdateSettings({
      startDate,
      totalWeeks: parseInt(totalWeeks),
      groupName,
      groupUpiVpa,
      weeklyAmount: parseInt(weeklyAmount),
      groupNotes
    });

    setSaveMessage('✓ Settings saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleReset = () => {
    if (window.confirm('Reset all settings to defaults? This will NOT delete any data.')) {
      setStartDate('2026-01-04');
      setTotalWeeks(52);
      setGroupName('Isthooi Savings Group');
      setGroupUpiVpa('isthooi@upi');
      setWeeklyAmount(1000);
      setGroupNotes('Collection every Sunday around 8:00 PM.');
    }
  };

  const handleToggleWeekCease = (weekNum) => {
    if (selectedWeeksToCease.includes(weekNum)) {
      setSelectedWeeksToCease(selectedWeeksToCease.filter(w => w !== weekNum));
    } else {
      setSelectedWeeksToCease([...selectedWeeksToCease, weekNum]);
    }
  };

  const handleCeaseSelectedWeeks = () => {
    if (selectedWeeksToCease.length === 0) {
      alert('Please select at least one week to cease');
      return;
    }

    selectedWeeksToCease.forEach(weekNum => {
      onCeaseWeek(weekNum);
    });

    setSaveMessage(`✓ Successfully ceased ${selectedWeeksToCease.length} week(s)!`);
    setSelectedWeeksToCease([]);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleToggleLock = () => {
    onToggleEditLock();
    setEditLocked(!editLocked);
  };

  // Count ceased weeks
  const ceasedWeeks = Object.values(state.weeks).filter(w => w.ceased).length;

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <SettingsIcon size={24} color="#a78bfa" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Settings & Configuration</h2>
        </div>
        <p style={{ fontSize: '0.9rem', color: '#ddd6fe' }}>
          Configure your savings group, manage weeks, and control edit permissions
        </p>
      </div>

      {/* Success Message */}
      {saveMessage && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10b981',
          color: '#10b981',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '0.9rem'
        }}>
          {saveMessage}
        </div>
      )}

      {/* Edit Lock Alert */}
      {editLocked && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Lock size={16} />
          <span><strong>⚠️ EDIT OPERATIONS LOCKED</strong> - All editing is currently disabled. Unlock from Settings to resume operations.</span>
        </div>
      )}

      {/* Settings Form */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '20px' }}>
          <span className="card-title">
            <Calendar size={18} color="#7c3aed" /> Cycle Configuration
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Starting Date */}
          <div>
            <label className="form-label">Starting Date</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
              First Sunday of your savings cycle
            </div>
          </div>

          {/* Total Number of Weeks */}
          <div>
            <label className="form-label">Total Number of Weeks</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                className="form-input"
                value={totalWeeks}
                onChange={(e) => setTotalWeeks(Math.max(1, Math.min(104, parseInt(e.target.value) || 1)))}
                min="1"
                max="104"
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '0.9rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>weeks</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
              Min: 1, Max: 104 (2 years)
            </div>
          </div>
        </div>

        {/* Calculation Info */}
        <div style={{
          background: 'rgba(124, 58, 237, 0.1)',
          border: '1px solid #7c3aed',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '0.9rem',
          color: '#a78bfa'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Cycle Duration:</strong> {totalWeeks} weeks
          </div>
          <div>
            <strong>Expected Total Pool:</strong> ₹{(totalWeeks * 10 * weeklyAmount).toLocaleString('en-IN')} (10 members × ₹{weeklyAmount.toLocaleString('en-IN')}/week × {totalWeeks} weeks)
          </div>
        </div>
      </div>

      {/* Group Details */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '20px' }}>
          <span className="card-title">
            <Hash size={18} color="#7c3aed" /> Group Details
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Group Name */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Group Name</label>
            <input
              type="text"
              className="form-input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Isthooi Savings Group"
            />
          </div>

          {/* Weekly Amount */}
          <div>
            <label className="form-label">Weekly Contribution Amount (₹)</label>
            <input
              type="number"
              className="form-input"
              value={weeklyAmount}
              onChange={(e) => setWeeklyAmount(Math.max(100, parseInt(e.target.value) || 1000))}
              min="100"
              step="100"
            />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
              Amount each member contributes per week
            </div>
          </div>

          {/* Group UPI VPA */}
          <div>
            <label className="form-label">Group UPI VPA</label>
            <input
              type="text"
              className="form-input"
              value={groupUpiVpa}
              onChange={(e) => setGroupUpiVpa(e.target.value)}
              placeholder="e.g., isthooi@upi"
            />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
              Used in WhatsApp reminders
            </div>
          </div>

          {/* Group Notes */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Group Notes / Instructions</label>
            <textarea
              className="form-input"
              value={groupNotes}
              onChange={(e) => setGroupNotes(e.target.value)}
              placeholder="e.g., Collection every Sunday around 8:00 PM."
              style={{ minHeight: '80px', resize: 'vertical' }}
            />
          </div>
        </div>
      </div>

      {/* Edit Lock Control */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '20px' }}>
          <span className="card-title">
            <Lock size={18} color="#ef4444" /> Edit Lock Control
          </span>
        </div>

        <div style={{
          background: editLocked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
          border: `1px solid ${editLocked ? '#ef4444' : '#22c55e'}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                {editLocked ? '🔒 All Edit Operations Locked' : '🔓 Edit Operations Enabled'}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {editLocked
                  ? 'No changes can be made to payments, loans, or members. Click "Unlock" to resume operations.'
                  : 'All editing operations are currently allowed. Click "Lock" to disable all changes.'}
              </div>
            </div>
          </div>

          <button
            className={`btn btn-sm`}
            style={{
              background: editLocked ? '#10b981' : '#ef4444',
              color: 'white',
              alignSelf: 'flex-start'
            }}
            onClick={handleToggleLock}
          >
            {editLocked ? (
              <>
                <LockOpen size={14} style={{ display: 'inline', marginRight: '6px' }} />
                🔓 Unlock All Edits
              </>
            ) : (
              <>
                <Lock size={14} style={{ display: 'inline', marginRight: '6px' }} />
                🔒 Lock All Edits
              </>
            )}
          </button>
        </div>
      </div>

      {/* Cease Week Management */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '20px' }}>
          <span className="card-title">
            <CheckCircle2 size={18} color="#22c55e" /> Finalize Weeks
          </span>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '12px' }}>
            <strong>Ceased Weeks:</strong> {ceasedWeeks} out of {state.totalWeeks || 52} weeks finalized
          </div>

          <div style={{ background: 'var(--bg-dark)', borderRadius: '8px', padding: '12px', maxHeight: '300px', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px' }}>
              {Array.from({ length: state.totalWeeks || 52 }).map((_, idx) => {
                const weekNum = idx + 1;
                const isCeased = state.weeks[weekNum]?.ceased || false;
                const isSelected = selectedWeeksToCease.includes(weekNum);

                return (
                  <button
                    key={weekNum}
                    onClick={() => handleToggleWeekCease(weekNum)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: `2px solid ${isCeased ? '#22c55e' : isSelected ? '#7c3aed' : '#374151'}`,
                      background: isCeased ? 'rgba(34, 197, 94, 0.2)' : isSelected ? 'rgba(124, 58, 237, 0.2)' : 'transparent',
                      color: isCeased ? '#22c55e' : isSelected ? '#a78bfa' : '#9ca3af',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: isCeased ? 'not-allowed' : 'pointer',
                      opacity: isCeased ? 0.6 : 1
                    }}
                    disabled={isCeased}
                    title={isCeased ? 'Week already ceased' : 'Click to select'}
                  >
                    {isCeased ? '✓ W' + weekNum : 'W' + weekNum}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px' }}>
            {selectedWeeksToCease.length} week(s) selected
          </div>
        </div>

        {selectedWeeksToCease.length > 0 && (
          <button
            className="btn btn-primary"
            style={{ background: '#22c55e' }}
            onClick={handleCeaseSelectedWeeks}
          >
            ✓ Finalize {selectedWeeksToCease.length} Week(s)
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button
          className="btn btn-secondary"
          onClick={handleReset}
          title="Reset to default values (doesn't delete data)"
        >
          Reset to Defaults
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSaveSettings}
          style={{ background: '#7c3aed' }}
        >
          💾 Save Settings
        </button>
      </div>

      {/* Info Section */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        color: '#93c5fd'
      }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '10px' }}>ℹ️ Important Notes:</h3>
        <ul style={{ fontSize: '0.85rem', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
          <li><strong>Edit Lock:</strong> When enabled, ALL editing is disabled - no payments, loans, or member changes allowed</li>
          <li><strong>Finalize Weeks:</strong> Lock individual weeks to prevent accidental edits after settlement</li>
          <li><strong>Changing Settings:</strong> Regenerates calendar but preserves all payment data and ceased status</li>
          <li><strong>Multiple Cycles:</strong> You can run different cycle lengths (50 weeks, 52 weeks, 26 weeks, etc.)</li>
        </ul>
      </div>
    </div>
  );
}
