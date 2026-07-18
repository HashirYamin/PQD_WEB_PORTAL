import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  FileCheck2,
  LockKeyhole,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

const initialForm = {
  companyName: '',
  crNumber: '',
  address: '',
  phone: '',
  email: '',
  adminName: '',
  password: '',
  confirmPassword: ''
};

export default function SignupPage() {
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      const { data } = await api.post(
        '/auth/register-company',
        form
      );

      toast.success(data.message);
      setSubmitted(true);
      setForm(initialForm);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Registration could not be submitted.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-mark large">
              <FileCheck2 size={28} />
            </div>

            <div>
              <strong>PQD Web Portal</strong>
              <span>Company registration</span>
            </div>
          </div>

          <h1>Registration submitted</h1>

          <p>
            Your registration is waiting for Super Admin
            approval. Use the same email and password to
            sign in after approval.
          </p>

          <Link
            to="/login"
            className="primary-button full"
          >
            Return to sign in
          </Link>
        </div>

        <div className="login-visual">
          <div className="visual-content">
            <div className="visual-icon">
              <FileCheck2 size={34} />
            </div>

            <h2>Your company workspace is being reviewed.</h2>

            <p>
              After approval, you can manage company
              documents, projects, checklists and PQD
              submissions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page signup-page">
      <div className="login-card signup-card">
        <div className="login-brand">
          <div className="brand-mark large">
            <Building2 size={28} />
          </div>

          <div>
            <strong>PQD Web Portal</strong>
            <span>New company registration</span>
          </div>
        </div>

        <h1>Register your company</h1>

        <p>
          Enter your company details. Access will be
          activated after administrator approval.
        </p>

        <form
          className="stack-form"
          onSubmit={submit}
        >
          <label>
            Company name
            <input
              name="companyName"
              value={form.companyName}
              onChange={updateField}
              placeholder="Enter registered company name"
              required
            />
          </label>

          <label>
            Commercial registration number
            <input
              name="crNumber"
              value={form.crNumber}
              onChange={updateField}
              placeholder="Enter CR number"
              required
            />
          </label>

          <label>
            Company address
            <div className="input-with-icon">
              <MapPin size={17} />

              <input
                name="address"
                value={form.address}
                onChange={updateField}
                placeholder="Enter company address"
                required
              />
            </div>
          </label>

          <label>
            Company phone
            <div className="input-with-icon">
              <Phone size={17} />

              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={updateField}
                placeholder="Enter company phone number"
                required
              />
            </div>
          </label>

          <label>
            Company or administrator email
            <div className="input-with-icon">
              <Mail size={17} />

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={updateField}
                placeholder="Enter company or your email"
                required
              />
            </div>

            <small>
              This email will be used for communication
              and account login.
            </small>
          </label>

          <label>
            Administrator full name
            <input
              name="adminName"
              value={form.adminName}
              onChange={updateField}
              placeholder="Enter account administrator name"
              required
            />
          </label>

          <label>
            Password
            <div className="input-with-icon">
              <LockKeyhole size={17} />

              <input
                type="password"
                name="password"
                value={form.password}
                onChange={updateField}
                placeholder="Create password"
                required
              />
            </div>
          </label>

          <label>
            Confirm password
            <div className="input-with-icon">
              <LockKeyhole size={17} />

              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={updateField}
                placeholder="Confirm password"
                required
              />
            </div>
          </label>

          <small className="password-help">
            Use at least 8 characters with uppercase,
            lowercase, number and special character.
          </small>

          <button
            className="primary-button full"
            disabled={busy}
          >
            {busy
              ? 'Submitting registration…'
              : 'Submit registration'}
          </button>
        </form>

        <p className="auth-switch">
          Already registered?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>

      <div className="login-visual">
        <div className="visual-content">
          <div className="visual-icon">
            <FileCheck2 size={34} />
          </div>

          <h2>
            Create a secure workspace for PQD submissions.
          </h2>

          <p>
            Organize reusable documents, project-specific
            checklists, expiry warnings and generated PDFs.
          </p>

          <div className="visual-grid">
            <div>
              <strong>Reviewed</strong>
              <span>Super Admin approval</span>
            </div>

            <div>
              <strong>Separated</strong>
              <span>Private company data</span>
            </div>

            <div>
              <strong>Secure</strong>
              <span>Role-based access</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}