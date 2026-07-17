import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  FileCheck2,
  LockKeyhole,
  Mail,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

const initialForm = {
  companyName: '',
  crNumber: '',
  companyEmail: '',
  companyPhone: '',
  address: '',
  contactPerson: '',
  adminName: '',
  adminEmail: '',
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
              <ShieldCheck size={28} />
            </div>

            <div>
              <strong>PQD Web Portal</strong>
              <span>Company registration</span>
            </div>
          </div>

          <h1>Registration submitted</h1>

          <p>
            Your company registration is waiting for
            Super Admin approval. You can sign in after
            your account has been approved.
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

            <h2>Your company workspace is being prepared.</h2>

            <p>
              After approval, you can manage documents,
              projects, checklists and PQD submissions.
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
          Submit your details. Access will be activated
          after Super Admin approval.
        </p>

        <form
          onSubmit={submit}
          className="stack-form"
        >
          <h3>Company information</h3>

          <label>
            Company name
            <input
              name="companyName"
              value={form.companyName}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Commercial registration number
            <input
              name="crNumber"
              value={form.crNumber}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Company email
            <div className="input-with-icon">
              <Mail size={17} />

              <input
                type="email"
                name="companyEmail"
                value={form.companyEmail}
                onChange={updateField}
                required
              />
            </div>
          </label>

          <label>
            Company phone
            <input
              name="companyPhone"
              value={form.companyPhone}
              onChange={updateField}
            />
          </label>

          <label>
            Company address
            <textarea
              name="address"
              value={form.address}
              onChange={updateField}
              rows="3"
            />
          </label>

          <label>
            Contact person
            <input
              name="contactPerson"
              value={form.contactPerson}
              onChange={updateField}
            />
          </label>

          <h3>Company administrator</h3>

          <label>
            Administrator full name
            <input
              name="adminName"
              value={form.adminName}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Administrator email
            <div className="input-with-icon">
              <Mail size={17} />

              <input
                type="email"
                name="adminEmail"
                value={form.adminEmail}
                onChange={updateField}
                required
              />
            </div>
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
                required
              />
            </div>
          </label>

          <small className="password-help">
            Minimum 8 characters with uppercase,
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
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>

      <div className="login-visual">
        <div className="visual-content">
          <div className="visual-icon">
            <FileCheck2 size={34} />
          </div>

          <h2>
            Create a secure PQD workspace for your company.
          </h2>

          <p>
            Manage documents, project checklists,
            expiry warnings and generated submissions.
          </p>

          <div className="visual-grid">
            <div>
              <strong>Approval based</strong>
              <span>Reviewed by Super Admin</span>
            </div>

            <div>
              <strong>Company separated</strong>
              <span>Independent company data</span>
            </div>

            <div>
              <strong>Secure access</strong>
              <span>Role-based permissions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}