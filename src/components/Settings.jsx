import React, { useState } from 'react';
import { Settings as SettingsIcon, Calendar, Hash, Lock, LockOpen, CheckCircle2, Users, Plus, Edit2, Trash2, X } from 'lucide-react';

export default function Settings({ state, onUpdateSettings, onCeaseWeek, onToggleEditLock, onUpdateMembers, onImportState, onResetState }) {
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
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    phone: '',
    upiId: '',
    avatarColor: '#10b981'
  });

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

  // Member management handlers
  const openAddMemberModal = () => {
    setEditingMemberId(null);
    setMemberForm({
      name: '',
      phone: '',
      upiId: '',
      avatarColor: '#10b981'
    });
    setShowMemberModal(true);
  };

  const openEditMemberModal = (member) => {
    setEditingMemberId(member.id);
    setMemberForm({
      name: member.name,
      phone: member.phone,
      upiId: member.upiId,
      avatarColor: member.avatarColor
    });
    setShowMemberModal(true);
  };

  const handleSaveMember = () => {
    if (!memberForm.name.trim()) {
      alert('Please enter member name');
      return;
    }
    if (!memberForm.phone.trim()) {
      alert('Please enter phone number');
      return;
    }
    if (!memberForm.upiId.trim()) {
      alert('Please enter UPI ID');
      return;
    }

    const updatedMembers = editingMemberId
      ? state.members.map(m =>
          m.id === editingMemberId
            ? { ...m, ...memberForm }
            : m
        )
      : [
          ...state.members,
          {
            id: `m${Date.now()}`,
            ...memberForm
          }
        ];

    onUpdateSettings({
      startDate,
      totalWeeks: parseInt(totalWeeks),
      groupName,
      groupUpiVpa,
      weeklyAmount: parseInt(weeklyAmount),
      groupNotes,
      members: updatedMembers
    });

    setSaveMessage(editingMemberId ? '✓ Member updated!' : '✓ Member added!');
    setShowMemberModal(false);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleDeleteMember = (memberId) => {
    if (window.confirm('Are you sure you want to delete this member? Their payment history will be preserved.')) {
      const updatedMembers = state.members.filter(m => m.id !== memberId);

      onUpdateSettings({
        startDate,
        totalWeeks: parseInt(totalWeeks),
        groupName,
        groupUpiVpa,
        weeklyAmount: parseInt(weeklyAmount),
        groupNotes,
        members: updatedMembers
      });

      setSaveMessage('✓ Member deleted!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
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
            <strong>Expected Total Pool:</strong> ₹{(totalWeeks * state.members.length * weeklyAmount).toLocaleString('en-IN')} ({state.members.length} members × ₹{weeklyAmount.toLocaleString('en-IN')}/week × {totalWeeks} weeks)
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

      {/* Members Management */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">
            <Users size={18} color="#7c3aed" /> Members Management
          </span>
          <button
            onClick={openAddMemberModal}
            style={{
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} /> Add Member
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '12px' }}>
            <strong>Total Members ({state.members.length}):</strong> Login username = First Name, Password = abcd
          </div>

          {state.members.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '30px',
              color: '#94a3b8',
              fontSize: '0.9rem'
            }}>
              No members configured. Click "Add Member" to get started.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px'
            }}>
              {state.members.map((member) => {
                const firstName = member.name.split(' ')[0];
                return (
                  <div
                    key={member.id}
                    style={{
                      background: 'var(--bg-dark)',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: member.avatarColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '0.9rem'
                        }}
                      >
                        {firstName.substring(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#ffffff' }}>
                          {member.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Username: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px' }}>{firstName}</code>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      <div>📱 {member.phone}</div>
                      <div>💳 {member.upiId}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => openEditMemberModal(member)}
                        style={{
                          flex: 1,
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        style={{
                          flex: 1,
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Member Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingMemberId ? '✏️ Edit Member' : '➕ Add New Member'}
              </h3>
              <button className="modal-close" onClick={() => setShowMemberModal(false)}>×</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                placeholder="e.g., Rajeesh"
              />
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                First name will be used as login username
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-input"
                value={memberForm.phone}
                onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                placeholder="e.g., +91 9876543210"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">UPI ID</label>
              <input
                type="text"
                className="form-input"
                value={memberForm.upiId}
                onChange={(e) => setMemberForm({ ...memberForm, upiId: e.target.value })}
                placeholder="e.g., rajesh@upi"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Avatar Color</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                {['#10b981', '#6366f1', '#ec4899', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e', '#84cc16', '#06b6d4'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setMemberForm({ ...memberForm, avatarColor: color })}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: color,
                      border: memberForm.avatarColor === color ? '3px solid white' : '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowMemberModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveMember}
                style={{ background: '#7c3aed' }}
              >
                {editingMemberId ? '✓ Update Member' : '➕ Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Backup & Data Management Section */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid #22c55e',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '1.2rem' }}>💾</span>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#86efac', margin: 0 }}>Backup & Data Management</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Export Backup */}
          <div style={{
            background: 'var(--bg-dark)',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px', color: '#86efac' }}>
              📥 Export Backup
            </h4>
            <p style={{ fontSize: '0.825rem', color: '#94a3b8', marginBottom: '12px' }}>
              Download all your group data as a JSON file. Keep regular backups for safety.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                const dataStr = JSON.stringify(state, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `isthooi-backup-${new Date().toISOString().slice(0, 10)}.json`;
                link.click();
              }}
              style={{ width: '100%', background: '#22c55e' }}
            >
              Download JSON
            </button>
          </div>

          {/* Import Backup */}
          <div style={{
            background: 'var(--bg-dark)',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px', color: '#86efac' }}>
              📤 Import Backup
            </h4>
            <p style={{ fontSize: '0.825rem', color: '#94a3b8', marginBottom: '12px' }}>
              Restore data from a previously exported JSON backup file.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    try {
                      const imported = JSON.parse(evt.target.result);
                      if (window.confirm('Are you sure you want to import this backup? Current data will be replaced.')) {
                        onImportState(imported);
                        alert('Backup imported successfully!');
                        e.target.value = ''; // Reset input
                      }
                    } catch (err) {
                      alert('Error reading backup file: ' + err.message);
                    }
                  };
                  reader.readAsText(file);
                }
              }}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-darker)',
                border: '1px solid #374151',
                borderRadius: '4px',
                color: '#e5e7eb',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

        {/* Reset to Demo Data */}
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px', color: '#fca5a5' }}>
            🔄 Reset to Demo Data
          </h4>
          <p style={{ fontSize: '0.825rem', color: '#94a3b8', marginBottom: '12px' }}>
            Reload the application with fresh demo data. All current data will be lost.
          </p>
          <button
            className="btn btn-rose"
            onClick={() => {
              if (window.confirm('This will reset all data to demo state. This action cannot be undone. Continue?')) {
                onResetState();
                alert('Application reset to demo state!');
              }
            }}
            style={{ width: '100%' }}
          >
            Reset to Demo Data
          </button>
        </div>
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
          <li><strong>Backups:</strong> Export regularly to prevent data loss. Import to restore from backups.</li>
        </ul>
      </div>
    </div>
  );
}
