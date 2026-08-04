import React, { useState } from 'react';
import { Users, Edit2, Phone, CreditCard, CheckCircle2, ShieldAlert } from 'lucide-react';
import { getMemberStats } from '../utils/storage';

export default function MemberRoster({ state, onUpdateMember }) {
  const [editingMember, setEditingMember] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editUpi, setEditUpi] = useState('');

  const handleStartEdit = (member) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditPhone(member.phone);
    setEditUpi(member.upiId);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingMember) return;

    onUpdateMember({
      ...editingMember,
      name: editName,
      phone: editPhone,
      upiId: editUpi
    });

    setEditingMember(null);
  };

  return (
    <div className="members-container">
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Users size={20} color="#10b981" /> 10 Group Members Directory
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {state.members.map((member) => {
            const mStats = getMemberStats(state, member.id);

            return (
              <div
                key={member.id}
                style={{
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar" style={{ backgroundColor: member.avatarColor || '#10b981' }}>
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 style={{ fontWeight: '700', fontSize: '1rem', color: '#ffffff' }}>
                          {member.name}
                        </h4>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          Joined: Jan 2026
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleStartEdit(member)}
                      style={{ padding: '4px 8px', minHeight: '30px' }}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                  </div>

                  <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={13} color="#94a3b8" /> {member.phone}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CreditCard size={13} color="#94a3b8" /> UPI: {member.upiId}
                    </div>
                  </div>
                </div>

                {/* Member Status Badge & Brief Stats */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: '#94a3b8' }}>Status:</span>
                    {mStats.status === 'CLEAN' && <span className="status-badge clean">Good Standing</span>}
                    {mStats.status === 'PENDING_1' && <span className="status-badge pending_1">1 Wk Pending</span>}
                    {mStats.status === 'OVERDUE_2' && <span className="status-badge overdue_2">2 Wks Overdue</span>}
                    {mStats.status === 'CRITICAL_3' && <span className="status-badge critical_3">3 Wks Critical</span>}
                    {mStats.status === 'BLOCKED' && <span className="status-badge blocked">⛔ BLOCKED DEFAULTER</span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '6px', fontWeight: '600' }}>
                    <span style={{ color: '#94a3b8' }}>Regular Invested:</span>
                    <span style={{ color: '#34d399' }}>₹{mStats.totalRegularPaid.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="modal-overlay" onClick={() => setEditingMember(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Edit Member Details</h3>
              <button className="modal-close" onClick={() => setEditingMember(null)}>×</button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number (with WhatsApp format)</label>
                <input
                  type="text"
                  className="form-input"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">UPI ID (e.g. name@upi)</label>
                <input
                  type="text"
                  className="form-input"
                  value={editUpi}
                  onChange={(e) => setEditUpi(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingMember(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
