import { useState } from 'react';
import {
  Link,
  useNavigate
} from 'react-router-dom';
import { FileCheck2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@abc.local');
  const [password, setPassword] = useState('Admin@123');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success('Welcome back');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand"><div className="brand-mark large"><ShieldCheck size={28} /></div><div><strong>PQD Web Portal</strong><span>Prequalification document automation</span></div></div>
        <h1>Welcome back</h1>
        <p>Sign in to manage companies, documents, checklists, projects, and submissions.</p>
        
        <form onSubmit={submit} className="stack-form">
          <label>Email address<div className="input-with-icon"><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div></label>
          <label>Password<div className="input-with-icon"><LockKeyhole size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div></label>
          <button className="primary-button full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        {/* Your new link added right here */}
        <p className="auth-switch">
          New company?{' '}
          <Link to="/signup">
            Register your company
          </Link>
        </p> 

        <div className="demo-credentials"><strong>Demo accounts</strong><span>Company Admin: admin@abc.local / Admin@123</span><span>Super Admin: superadmin@pqd.local / Admin@123</span></div>
      </div>
      <div className="login-visual">
        <div className="visual-content"><div className="visual-icon"><FileCheck2 size={34} /></div><h2>Automate PQD submissions with clarity and speed.</h2><p>Keep reusable documents, project checklists, expiry warnings, and generated PDFs in one secure workspace.</p><div className="visual-grid"><div><strong>Documents</strong><span>Organized and expiry-aware</span></div><div><strong>Checklists</strong><span>Master to project workflow</span></div><div><strong>Submissions</strong><span>Validated and versioned</span></div></div></div>
      </div>
    </div>
  );
}