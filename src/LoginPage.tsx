import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);

const LoginPage: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      onLogin(cred.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Logo mark */}
        <div style={styles.logoMark}>A</div>

        <h1 style={styles.title}>Airtech ERP</h1>
        <p style={styles.subtitle}>Inventory Management System</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={styles.footer}>© {new Date().getFullYear()} Airtech Industries</p>
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:       '100vh',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    background:      'linear-gradient(135deg, #1a237e 0%, #3949ab 60%, #5c6bc0 100%)',
  },
  card: {
    background:     '#fff',
    borderRadius:   16,
    boxShadow:      '0 8px 40px rgba(0,0,0,0.18)',
    padding:        '48px 40px 36px',
    width:          '100%',
    maxWidth:       360,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            0,
  },
  logoMark: {
    width:          56,
    height:         56,
    borderRadius:   14,
    background:     '#1a237e',
    color:          '#fff',
    fontSize:       28,
    fontWeight:     800,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   20,
    letterSpacing:  '-1px',
    boxShadow:      '0 4px 12px rgba(26,35,126,0.3)',
  },
  title: {
    margin:       '0 0 4px',
    fontSize:     24,
    fontWeight:   700,
    color:        '#1a237e',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin:     '0 0 28px',
    fontSize:   13,
    color:      '#6b7280',
    fontWeight: 400,
  },
  form: {
    width:         '100%',
    display:       'flex',
    flexDirection: 'column',
    gap:           12,
  },
  input: {
    width:       '100%',
    boxSizing:   'border-box',
    padding:     '11px 14px',
    borderRadius: 8,
    border:      '1px solid #d1d5db',
    fontSize:    14,
    outline:     'none',
    transition:  'border-color 0.15s',
    background:  '#fafafa',
  },
  error: {
    margin:     '0',
    padding:    '9px 12px',
    borderRadius: 7,
    background: '#fef2f2',
    border:     '1px solid #fecaca',
    color:      '#dc2626',
    fontSize:   13,
    fontWeight: 500,
    textAlign:  'center',
  },
  btn: {
    marginTop:    4,
    padding:      '12px 0',
    background:   '#1a237e',
    color:        '#fff',
    border:       'none',
    borderRadius:  8,
    fontWeight:    600,
    fontSize:      15,
    cursor:        'pointer',
    transition:    'background 0.15s',
    letterSpacing: '0.1px',
  },
  btnDisabled: {
    background: '#9ca3af',
    cursor:     'not-allowed',
  },
  footer: {
    marginTop: 28,
    fontSize:  12,
    color:     '#9ca3af',
  },
};

export default LoginPage;