import React, { useState, useEffect } from 'react';
import { LogIn, AlertCircle, KeyRound, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { isSupabaseConfigured } from '../utils/supabaseClient';
import { redeemOtp, signInAsAdmin, adminPasswordIsSet } from '../utils/db';

// Two modes.
//
// Live (Supabase configured): the member signs in with their first name or phone
// number plus a 6-digit OTP the super admin issued and handed to them. No SMS or
// email provider is involved — the code travels however the group prefers.
//
// Demo (no Supabase): the original local-only login, so the app still runs from
// localStorage for development without any cloud project.
export default function Login({ members, onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Switches the secret field from a 6-digit OTP to the super admin's password.
  const [adminMode, setAdminMode] = useState(false);

  // null = unknown / not checked. Catches the one setup slip that would otherwise
  // look like a wrong password: running the schema but skipping the seed's
  // set_admin_password() line, which leaves the account with no way in at all.
  const [pwMissing, setPwMissing] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !adminMode) return;
    let cancelled = false;
    adminPasswordIsSet().then((isSet) => {
      if (!cancelled && isSet === false) setPwMissing(true);
    });
    return () => { cancelled = true; };
  }, [adminMode]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !code) {
      setError('Enter your name and your password.');
      return;
    }

    setBusy(true);
    try {
      const memberId = await signInAsAdmin(identifier.trim(), code);
      await onLogin(memberId);
    } catch (err) {
      setError(err.message || 'Could not sign you in.');
      setBusy(false);
    }
  };

  const switchMode = (toAdmin) => {
    setAdminMode(toAdmin);
    setCode('');
    setError('');
  };

  const handleLiveLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !code.trim()) {
      setError('Enter your name or phone number, and the OTP.');
      return;
    }

    setBusy(true);
    try {
      // Establishes an anonymous session, then binds it to the member the OTP
      // belongs to. Until that succeeds the session can read nothing at all.
      const memberId = await redeemOtp(identifier.trim(), code.trim());
      await onLogin(memberId);
    } catch (err) {
      setError(err.message || 'Could not sign you in.');
      setBusy(false);
    }
  };

  const handleDemoLogin = (e) => {
    e.preventDefault();
    setError('');

    if (!identifier || !code) {
      setError('Please enter both username and password');
      return;
    }

    const member = (members || []).find(
      (m) => m.name.split(' ')[0].toLowerCase() === identifier.toLowerCase()
    );

    // Deliberately one message for both an unknown name and a wrong password.
    // Distinct errors would let someone enumerate valid member names by guessing.
    if (!member || code !== 'abcd') {
      setError('Invalid username or password.');
      return;
    }

    onLogin(member);
  };

  const live = isSupabaseConfigured;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-darker)',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        padding: '40px',
        maxWidth: '400px',
        width: '100%'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px', fontWeight: '800' }}>
            💰
          </div>
          <h1 style={{
            fontSize: '1.8rem',
            fontWeight: '800',
            color: '#ffffff',
            marginBottom: '8px'
          }}>
            Isthooi
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0' }}>
            Savings Group Manager
          </p>
        </div>

        <form
          onSubmit={
            !live ? handleDemoLogin
              : adminMode ? handleAdminLogin
              : handleLiveLogin
          }
        >
          {adminMode && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid #f59e0b',
              color: '#fcd34d',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                {pwMissing
                  ? 'No admin password has been set yet. Run the set_admin_password() line at the end of seed.sql, then come back.'
                  : 'Group admin sign-in. Everyone else uses an OTP.'}
              </span>
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid #f43f5e',
              color: '#f87171',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Identifier */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#e2e8f0',
              marginBottom: '8px'
            }}>
              {live ? 'Your name or phone number' : 'Username (Your First Name)'}
            </label>
            <input
              type="text"
              className="form-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={live ? 'e.g. Rajeesh, or 9876543210' : 'Your first name'}
              autoComplete="username"
              disabled={busy}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #374151',
                background: 'var(--bg-dark)',
                color: '#ffffff',
                fontSize: '0.95rem'
              }}
              onFocus={() => setError('')}
            />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
              {live
                ? 'Either works — whichever the group has on record for you'
                : 'Enter your first name as registered with the group'}
            </div>
          </div>

          {/* OTP / password */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#e2e8f0',
              marginBottom: '8px'
            }}>
              {!live ? 'Password' : adminMode ? 'Admin password' : 'OTP from the group admin'}
            </label>
            <input
              // The OTP is not secret in the same way — the admin reads it aloud —
              // so it stays visible, while a password is always masked.
              type={live && !adminMode ? 'text' : 'password'}
              className="form-input"
              value={code}
              onChange={(e) => setCode(
                // The OTP is always six digits; strip anything else so a pasted
                // "OTP: 483920" still works. Passwords are taken as typed.
                live && !adminMode
                  ? e.target.value.replace(/\D/g, '').slice(0, 6)
                  : e.target.value
              )}
              placeholder={
                !live ? 'Enter password'
                  : adminMode ? 'Your admin password'
                  : '6-digit code'
              }
              inputMode={live && !adminMode ? 'numeric' : undefined}
              autoComplete={adminMode ? 'current-password' : 'one-time-code'}
              disabled={busy}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #374151',
                background: 'var(--bg-dark)',
                color: '#ffffff',
                fontSize: live && !adminMode ? '1.4rem' : '0.95rem',
                letterSpacing: live && !adminMode ? '0.4em' : 'normal',
                textAlign: live && !adminMode ? 'center' : 'left',
                fontVariantNumeric: 'tabular-nums'
              }}
              onFocus={() => setError('')}
            />
            {live && !adminMode && (
              <div style={{
                fontSize: '0.8rem',
                color: '#94a3b8',
                marginTop: '8px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px'
              }}>
                <KeyRound size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  Ask the group admin for your OTP. It works once, on this device,
                  and expires after a day.
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '20px',
              transition: 'opacity 0.2s'
            }}
          >
            {busy ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}
            {busy ? 'Signing in…' : 'Login'}
          </button>

          {/* The super admin's route in, since nobody can issue them an OTP.
              Advertised plainly rather than hidden: it fails for everyone else, so
              naming it gives nothing away that guessing would not. */}
          {live && (
            <button
              type="button"
              onClick={() => switchMode(!adminMode)}
              disabled={busy}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                border: adminMode ? 'none' : '1px solid #374151',
                borderRadius: '6px',
                color: '#94a3b8',
                fontSize: '0.85rem',
                cursor: busy ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {adminMode
                ? <><ArrowLeft size={14} /> Use an admin-issued OTP instead</>
                : <><ShieldCheck size={15} /> Group admin? Sign in with password</>}
            </button>
          )}
        </form>

        {!live && (
          <div style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            textAlign: 'center',
            paddingTop: '4px'
          }}>
            Demo mode — data stays on this device. Configure Supabase for the live
            version.
          </div>
        )}
      </div>
    </div>
  );
}
