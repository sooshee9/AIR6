import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);

// Base64 icon injected at build — replace ICON_B64 with actual value
const ICON_B64 = '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';

const LoginPage: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [pwVisible, setPwVisible] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      onLogin(cred.user);
    } catch (err: any) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .lp-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 30%, #1a3a5c 0%, #0f2540 45%, #071525 100%);
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          position: relative;
          overflow: hidden;
        }

        /* ambient glows */
        .lp-page::before {
          content: '';
          position: absolute; width: 700px; height: 700px; border-radius: 50%;
          background: radial-gradient(circle, rgba(30,90,160,0.14) 0%, transparent 65%);
          top: -20%; left: 50%; transform: translateX(-50%);
          pointer-events: none;
        }
        .lp-page::after {
          content: '';
          position: absolute; width: 500px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(15,60,120,0.1) 0%, transparent 70%);
          bottom: -10%; left: 50%; transform: translateX(-50%);
          pointer-events: none;
        }

        /* Card */
        .lp-card {
          position: relative;
          width: 100%; max-width: 400px;
          margin: 24px;
          background: rgba(255,255,255,0.97);
          border-radius: 24px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.08),
            0 24px 80px rgba(0,0,0,0.45),
            0 0 120px rgba(21,101,192,0.12);
          padding: 44px 40px 36px;
          display: flex; flex-direction: column; align-items: center;
          animation: cardIn 0.7s cubic-bezier(0.34,1.2,0.64,1) both;
          overflow: hidden;
        }

        /* top accent bar */
        .lp-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, #0d47a1, #1565C0, #1976D2, #42a5f5, #1976D2, #1565C0, #0d47a1);
          background-size: 200% 100%;
          animation: barShimmer 3s linear infinite;
        }

        /* Icon */
        .lp-icon-wrap {
          margin-bottom: 22px;
          animation: iconDrop 0.7s 0.1s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .lp-icon-ring {
          padding: 5px; border-radius: 28px;
          background: linear-gradient(145deg, rgba(21,101,192,0.2), rgba(13,71,161,0.1));
          box-shadow: 0 0 0 1px rgba(21,101,192,0.18), 0 4px 20px rgba(13,71,161,0.2);
        }
        .lp-icon-card {
          width: 82px; height: 82px; border-radius: 20px;
          background: linear-gradient(160deg, #ffffff 0%, #eef4ff 100%);
          box-shadow: 0 2px 0 rgba(255,255,255,0.9) inset, 0 -1px 0 rgba(150,190,255,0.3) inset,
            0 8px 24px rgba(0,0,0,0.12);
          display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
        }
        .lp-icon-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 50%;
          background: linear-gradient(to bottom, rgba(255,255,255,0.6), rgba(255,255,255,0));
          border-radius: 20px 20px 0 0; z-index: 2; pointer-events: none;
        }
        .lp-icon-card img {
          width: 62px; height: 62px; object-fit: contain; position: relative; z-index: 1;
        }

        /* Title */
        .lp-title {
          font-family: 'Cinzel', serif;
          font-weight: 900; font-size: 24px; letter-spacing: 0.1em;
          color: #1565C0;
          text-shadow: 0 1px 3px rgba(21,101,192,0.15);
          margin-bottom: 4px;
          animation: fadeUp 0.5s 0.3s ease both;
        }
        .lp-title .erp { color: #1976D2; font-weight: 700; }

        /* Ornament */
        .lp-ornament {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 6px;
          animation: fadeUp 0.5s 0.38s ease both;
        }
        .lp-orn-line {
          width: 36px; height: 1px;
          background: linear-gradient(to right, transparent, rgba(21,101,192,0.4));
        }
        .lp-orn-line.r { background: linear-gradient(to left, transparent, rgba(21,101,192,0.4)); }
        .lp-orn-diamond { width: 4px; height: 4px; background: rgba(25,118,210,0.6); transform: rotate(45deg); }

        /* Subtitle */
        .lp-subtitle {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-style: italic; font-weight: 600; font-size: 14px;
          letter-spacing: 0.06em; color: #6b7280;
          margin-bottom: 32px;
          animation: fadeUp 0.5s 0.45s ease both;
        }

        /* Divider */
        .lp-divider {
          width: 100%; height: 1px; margin-bottom: 24px;
          background: linear-gradient(to right, transparent, #e5e7eb, transparent);
          animation: fadeUp 0.4s 0.5s ease both;
        }

        /* Form */
        .lp-form {
          width: 100%; display: flex; flex-direction: column; gap: 14px;
          animation: fadeUp 0.5s 0.55s ease both;
        }

        .lp-field {
          position: relative;
        }
        .lp-field-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; font-size: 15px; pointer-events: none;
          display: flex; align-items: center;
        }
        .lp-input {
          width: 100%;
          padding: 12px 14px 12px 40px;
          border-radius: 10px;
          border: 1.5px solid #e5e7eb;
          font-size: 14px; font-family: 'Inter', sans-serif;
          color: #1a1f36; background: #f9faff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .lp-input:focus {
          border-color: #1565C0;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(21,101,192,0.1);
        }
        .lp-input::placeholder { color: #b0b7c3; }

        .lp-pw-toggle {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #9ca3af;
          font-size: 13px; padding: 4px; transition: color 0.15s;
        }
        .lp-pw-toggle:hover { color: #1565C0; }

        /* Error */
        .lp-error {
          padding: 10px 13px; border-radius: 8px;
          background: #fef2f2; border: 1px solid #fecaca;
          color: #dc2626; font-size: 13px; font-weight: 500;
          text-align: center; animation: shake 0.4s ease;
        }

        /* Button */
        .lp-btn {
          margin-top: 4px; padding: 13px 0;
          background: linear-gradient(135deg, #0d47a1 0%, #1565C0 50%, #1976D2 100%);
          color: #fff; border: none; border-radius: 10px;
          font-family: 'Cinzel', serif;
          font-weight: 700; font-size: 14px; letter-spacing: 0.12em;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(13,71,161,0.35), 0 1px 0 rgba(255,255,255,0.1) inset;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          position: relative; overflow: hidden;
        }
        .lp-btn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, rgba(255,255,255,0.12), transparent);
          border-radius: 10px;
        }
        .lp-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(13,71,161,0.45);
        }
        .lp-btn:active:not(:disabled) { transform: translateY(0); }
        .lp-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        /* Spinner inside button */
        .lp-spinner {
          display: inline-block; width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: middle; margin-right: 8px;
        }

        /* Footer */
        .lp-footer {
          margin-top: 28px; font-size: 11.5px;
          color: #c4c9d4; letter-spacing: 0.04em;
          animation: fadeUp 0.4s 0.8s ease both;
        }

        /* Keyframes */
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes iconDrop {
          from { opacity: 0; transform: scale(0.6) translateY(-12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes barShimmer {
          from { background-position: 200% 0; } to { background-position: -200% 0; }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="lp-page">
        <div className="lp-card">

          {/* Icon */}
          <div className="lp-icon-wrap">
            <div className="lp-icon-ring">
              <div className="lp-icon-card">
                <img src={`data:image/png;base64,${ICON_B64}`} alt="Airtech" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="lp-title">AIRTECH&nbsp;<span className="erp">ERP</span></h1>

          {/* Ornament */}
          <div className="lp-ornament">
            <div className="lp-orn-line"></div>
            <div className="lp-orn-diamond"></div>
            <div className="lp-orn-line r"></div>
          </div>

          {/* Subtitle */}
          <p className="lp-subtitle">Inventory Management System</p>

          <div className="lp-divider"></div>

          {/* Form */}
          <form className="lp-form" onSubmit={handleLogin}>

            <div className="lp-field">
              <span className="lp-field-icon">✉</span>
              <input
                className="lp-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="lp-field">
              <span className="lp-field-icon">🔒</span>
              <input
                className="lp-input"
                type={pwVisible ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className="lp-pw-toggle"
                onClick={() => setPwVisible(v => !v)}
                tabIndex={-1}
              >
                {pwVisible ? '🙈' : '👁'}
              </button>
            </div>

            {error && <div className="lp-error">{error}</div>}

            <button type="submit" className="lp-btn" disabled={loading}>
              {loading && <span className="lp-spinner"></span>}
              {loading ? 'Signing In…' : 'Sign In'}
            </button>
          </form>

          <p className="lp-footer">© {new Date().getFullYear()} Airtech Industries</p>
        </div>
      </div>
    </>
  );
};

export default LoginPage;