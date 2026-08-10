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

    // Deliberately one message for both an unknown name and a wrong password.
    // Distinct errors would let someone enumerate valid member names by guessing.
    // (hardcoded to 'abcd' for now)
    if (!member || password !== 'abcd') {
      setError('Invalid username or password.');
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
              placeholder="Your first name"
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
              Enter your first name as registered with the group
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
      </div>
    </div>
  );
}
