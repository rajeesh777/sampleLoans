import React, { useState } from 'react';
import {
  ShieldCheck,
  Clock,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Crown,
  X
} from 'lucide-react';

import {
  FEATURES,
  LEVELS,
  ROLES,
  ROLE_KEYS,
  describeWindow,
  daysRemaining,
  getGrantStatus,
  getMemberAccess,
  normalizeAccess,
  rankOf
} from '../utils/permissions';

const LEVEL_STYLE = {
  none: { label: 'No access', color: '#64748b', Icon: EyeOff },
  view: { label: 'View', color: '#3b82f6', Icon: Eye },
  edit: { label: 'Edit', color: '#10b981', Icon: Pencil }
};

const STATUS_STYLE = {
  ACTIVE: { color: '#10b981', label: 'ACTIVE' },
  SCHEDULED: { color: '#f59e0b', label: 'SCHEDULED' },
  EXPIRED: { color: '#64748b', label: 'EXPIRED' }
};

// Super-admin-only console: who holds which role, what each member may see or edit,
// and time-boxed grants that hand out editing rights for a fixed window.
export default function AccessControl({
  state,
  today,
  onSetMemberRole,
  onSetFeatureOverride,
  onAddGrant,
  onRevokeGrant,
  onTransferSuperAdmin
}) {
  const access = normalizeAccess(state);
  const members = state.members || [];

  const [selectedMemberId, setSelectedMemberId] = useState(
    () => members.find((m) => m.id !== access.superAdminId)?.id || members[0]?.id || ''
  );
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantForm, setGrantForm] = useState({
    memberId: '',
    feature: 'contributions',
    level: LEVELS.EDIT,
    from: today,
    until: '',
    note: ''
  });
  const [formError, setFormError] = useState('');

  const selectedMember = members.find((m) => m.id === selectedMemberId) || null;
  const selectedIsSuperAdmin = selectedMemberId === access.superAdminId;
  const effective = selectedMember
    ? getMemberAccess(state, selectedMember.id, today)
    : {};
  const overrides = access.overrides[selectedMemberId] || {};

  const openGrantModal = (memberId) => {
    setGrantForm({
      memberId,
      feature: 'contributions',
      level: LEVELS.EDIT,
      from: today,
      until: '',
      note: ''
    });
    setFormError('');
    setShowGrantModal(true);
  };

  const submitGrant = () => {
    if (!grantForm.memberId) return setFormError('Pick a member.');
    if (!grantForm.until && !grantForm.from) {
      return setFormError('Set at least a start or an end date for the interval.');
    }
    if (grantForm.from && grantForm.until && grantForm.until < grantForm.from) {
      return setFormError('The end date cannot fall before the start date.');
    }
    onAddGrant(grantForm);
    setShowGrantModal(false);
  };

  const memberName = (id) => members.find((m) => m.id === id)?.name || 'Unknown';

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-header" style={{ marginBottom: '8px' }}>
        <span className="card-title">
          <ShieldCheck size={18} style={{ marginRight: '8px', verticalAlign: '-3px' }} />
          Access Control
        </span>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Decide who can see and edit each part of the app. Roles set the baseline, a
        per-member override pins a feature open or shut, and a timed grant hands out
        editing rights that expire on their own.
      </p>

      {/* --- Roles ------------------------------------------------------------ */}
      <h4 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Roles</h4>
      <div style={{ display: 'grid', gap: '8px', marginBottom: '28px' }}>
        {members.map((m) => {
          const roleKey = access.roles[m.id] || 'member';
          const role = ROLES[roleKey];
          const isSA = m.id === access.superAdminId;
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(148, 163, 184, 0.07)',
                border: `1px solid ${isSA ? role.color : 'transparent'}`
              }}
            >
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: m.avatarColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  flexShrink: 0
                }}
              >
                {m.name.charAt(0)}
              </span>
              <span style={{ fontWeight: 600, minWidth: '120px' }}>{m.name}</span>

              {isSA ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: role.color,
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}
                  title="The super admin always has every feature and cannot be demoted here."
                >
                  <Crown size={15} /> Super Admin
                </span>
              ) : (
                <>
                  <select
                    className="form-input"
                    value={roleKey}
                    onChange={(e) => onSetMemberRole(m.id, e.target.value)}
                    style={{ padding: '6px 10px', minWidth: '140px' }}
                  >
                    {ROLE_KEYS.filter((k) => k !== 'superadmin').map((k) => (
                      <option key={k} value={k}>
                        {ROLES[k].label}
                      </option>
                    ))}
                  </select>

                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => openGrantModal(m.id)}
                    title="Give this member editing rights for a limited period"
                  >
                    <Clock size={14} /> Timed grant
                  </button>

                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setSelectedMemberId(m.id)}
                    title="Configure exactly what this member can see"
                  >
                    <Eye size={14} /> Visibility
                  </button>

                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Hand the Super Admin role to ${m.name}? You will become a Collector and lose access control.`
                        )
                      ) {
                        onTransferSuperAdmin(m.id);
                      }
                    }}
                    title="Transfer the super admin role"
                  >
                    <Crown size={14} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* --- Per-member feature matrix ---------------------------------------- */}
      <h4 style={{ fontSize: '0.95rem', marginBottom: '4px' }}>Feature access</h4>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '12px' }}>
        Pick a member to set what they may see. <strong>Role default</strong> follows
        their role; the other choices pin the feature regardless of role.
      </p>

      <select
        className="form-input"
        value={selectedMemberId}
        onChange={(e) => setSelectedMemberId(e.target.value)}
        style={{ padding: '8px 12px', marginBottom: '16px', minWidth: '200px' }}
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.id === access.superAdminId ? ' (Super Admin)' : ''}
          </option>
        ))}
      </select>

      {selectedIsSuperAdmin ? (
        <div
          style={{
            padding: '14px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid #f59e0b',
            color: '#fcd34d',
            fontSize: '0.85rem',
            marginBottom: '28px'
          }}
        >
          <Crown size={15} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
          The super admin has full access to every feature by definition. To change
          that, transfer the role to someone else first.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '28px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px' }}>Feature</th>
                <th style={{ padding: '8px' }}>Setting</th>
                <th style={{ padding: '8px' }}>In effect now</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => {
                const level = effective[f.key] || LEVELS.NONE;
                const style = LEVEL_STYLE[level];
                const overridden = overrides[f.key] !== undefined;
                // A timed grant may be lifting this above what the setting says.
                const raisedByGrant =
                  rankOf(level) >
                  rankOf(
                    overridden
                      ? overrides[f.key]
                      : ROLES[access.roles[selectedMemberId] || 'member'].defaults[f.key]
                  );
                return (
                  <tr key={f.key} style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{f.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {f.description}
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <select
                        className="form-input"
                        value={overridden ? overrides[f.key] : 'inherit'}
                        onChange={(e) =>
                          onSetFeatureOverride(
                            selectedMemberId,
                            f.key,
                            e.target.value === 'inherit' ? null : e.target.value
                          )
                        }
                        style={{ padding: '6px 10px', minWidth: '140px' }}
                      >
                        <option value="inherit">Role default</option>
                        <option value={LEVELS.NONE}>No access</option>
                        <option value={LEVELS.VIEW}>View only</option>
                        {f.editable && <option value={LEVELS.EDIT}>View &amp; edit</option>}
                      </select>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: style.color,
                          fontWeight: 600,
                          fontSize: '0.85rem'
                        }}
                      >
                        <style.Icon size={14} />
                        {style.label}
                      </span>
                      {raisedByGrant && (
                        <span
                          style={{ marginLeft: '8px', fontSize: '0.72rem', color: '#f59e0b' }}
                          title="Raised by an active timed grant; reverts when it expires"
                        >
                          <Clock size={11} style={{ verticalAlign: '-1px' }} /> timed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* --- Timed grants ------------------------------------------------------ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Timed edit grants</h4>
        <button className="btn btn-sm btn-primary" onClick={() => openGrantModal('')}>
          <Plus size={14} /> New grant
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '12px' }}>
        A grant only ever raises access, and lapses by itself once the window passes.
      </p>

      {access.grants.length === 0 ? (
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            background: 'rgba(148, 163, 184, 0.07)',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}
        >
          No timed grants yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {access.grants.map((g) => {
            const status = getGrantStatus(g, today);
            const s = STATUS_STYLE[status];
            const days = daysRemaining(g, today);
            const feature = FEATURES.find((f) => f.key === g.feature);
            return (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(148, 163, 184, 0.07)',
                  borderLeft: `3px solid ${s.color}`,
                  opacity: status === 'EXPIRED' ? 0.6 : 1
                }}
              >
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: s.color,
                    minWidth: '76px'
                  }}
                >
                  {s.label}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', minWidth: '110px' }}>
                  {memberName(g.memberId)}
                </span>
                <span style={{ fontSize: '0.85rem' }}>
                  {LEVEL_STYLE[g.level].label} &middot; {feature?.label || g.feature}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                  {describeWindow(g)}
                  {status === 'ACTIVE' && days !== null && (
                    <> &middot; {days === 0 ? 'ends today' : `${days}d left`}</>
                  )}
                </span>
                {g.note && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    “{g.note}”
                  </span>
                )}
                <button
                  className="btn btn-sm btn-rose"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => onRevokeGrant(g.id)}
                  title={status === 'EXPIRED' ? 'Remove this lapsed grant' : 'Revoke now'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* --- Grant modal ------------------------------------------------------- */}
      {showGrantModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000
          }}
          onClick={() => setShowGrantModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: '440px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}
            >
              <span className="card-title">
                <Clock size={16} style={{ marginRight: '8px', verticalAlign: '-2px' }} />
                Timed access grant
              </span>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setShowGrantModal(false)}
              >
                <X size={14} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid #f43f5e',
                  color: '#fca5a5',
                  padding: '10px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  marginBottom: '14px'
                }}
              >
                {formError}
              </div>
            )}

            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px' }}>
              Member
            </label>
            <select
              className="form-input"
              value={grantForm.memberId}
              onChange={(e) => setGrantForm({ ...grantForm, memberId: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', marginBottom: '14px' }}
            >
              <option value="">Select a member…</option>
              {members
                .filter((m) => m.id !== access.superAdminId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>

            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px' }}>
              Feature
            </label>
            <select
              className="form-input"
              value={grantForm.feature}
              onChange={(e) => setGrantForm({ ...grantForm, feature: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', marginBottom: '14px' }}
            >
              {FEATURES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>

            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px' }}>
              Access level
            </label>
            <select
              className="form-input"
              value={grantForm.level}
              onChange={(e) => setGrantForm({ ...grantForm, level: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', marginBottom: '14px' }}
            >
              <option value={LEVELS.VIEW}>View only</option>
              {FEATURES.find((f) => f.key === grantForm.feature)?.editable && (
                <option value={LEVELS.EDIT}>View &amp; edit</option>
              )}
            </select>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px' }}>
                  From
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={grantForm.from}
                  onChange={(e) => setGrantForm({ ...grantForm, from: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px' }}>
                  Until
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={grantForm.until}
                  min={grantForm.from || undefined}
                  onChange={(e) => setGrantForm({ ...grantForm, until: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Both dates are inclusive. Leave <em>Until</em> blank for a grant with no end
              date, or <em>From</em> blank to start immediately.
            </p>

            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px' }}>
              Reason (optional)
            </label>
            <input
              type="text"
              className="form-input"
              value={grantForm.note}
              placeholder="e.g. covering collections while I travel"
              onChange={(e) => setGrantForm({ ...grantForm, note: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', marginBottom: '18px' }}
            />

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={submitGrant}
            >
              <Plus size={15} /> Create grant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
