import React, { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';

export default function Login({ members, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    // Find member by first name (case-insensitive)
    const member = members.find(m =>
      m.name.split(' ')[0].toLowerCase() === username.toLowerCase()
    );

    if (!member) {
      setError('Member not found. Use your first name as username.');
      return;
    }

    // Check password (hardcoded to 'abcd' for now)
    if (password !== 'abcd') {
      setError('Incorrect password. (Hint: abcd)');
      return;
    }

    // Login successful
    onLogin(member);
  };

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
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '12px',
            fontWeight: '800'
          }}>
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
          <p style={{
            fontSize: '0.9rem',
            color: '#94a3b8',
            marginBottom: '0'
          }}>
            Savings Group Manager
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          {/* Error Message */}
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
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Username Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#e2e8f0',
              marginBottom: '8px'
            }}>
              Username (Your First Name)
            </label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., Rajeesh"
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
            <div style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginTop: '6px'
            }}>
              Enter your first name exactly as shown in members list
            </div>
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#e2e8f0',
              marginBottom: '8px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  paddingRight: '40px',
                  borderRadius: '6px',
                  border: '1px solid #374151',
                  background: 'var(--bg-dark)',
                  color: '#ffffff',
                  fontSize: '0.95rem'
                }}
                onFocus={() => setError('')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  padding: '4px'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginTop: '6px'
            }}>
              Default: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '3px' }}>abcd</code>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '20px',
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.target.style.opacity = '0.9'}
            onMouseOut={(e) => e.target.style.opacity = '1'}
          >
            <LogIn size={18} />
            Login
          </button>
        </form>

        {/* Member List */}
        <div style={{
          background: 'rgba(102, 126, 234, 0.1)',
          border: '1px solid #667eea',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '24px'
        }}>
          <div style={{
            fontSize: '0.8rem',
            fontWeight: '600',
            color: '#94a3b8',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            📋 Members
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '8px'
          }}>
            {members.map((member) => {
              const firstName = member.name.split(' ')[0];
              return (
                <div
                  key={member.id}
                  onClick={() => {
                    setUsername(firstName);
                    setError('');
                  }}
                  style={{
                    background: 'var(--bg-dark)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    border: '1px solid #374151',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#374151';
                    e.currentTarget.style.borderColor = '#667eea';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--bg-dark)';
                    e.currentTarget.style.borderColor = '#374151';
                  }}
                  title={`Click to fill in ${firstName}`}
                >
                  {firstName}
                </div>
              );
            })}
          </div>
          <div style={{
            fontSize: '0.7rem',
            color: '#94a3b8',
            marginTop: '12px',
            fontStyle: 'italic'
          }}>
            💡 Click a name to auto-fill username
          </div>
        </div>

        {/* Info */}
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid #22c55e',
          borderRadius: '8px',
          padding: '12px',
          marginTop: '24px',
          fontSize: '0.75rem',
          color: '#86efac',
          lineHeight: '1.5'
        }}>
          <strong>ℹ️ Demo Mode:</strong> All members use password <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px' }}>abcd</code>
        </div>
      </div>
    </div>
  );
}
