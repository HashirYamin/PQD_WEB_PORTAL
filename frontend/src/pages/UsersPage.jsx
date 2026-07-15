import { useEffect, useState } from 'react';
import { Plus, Save, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { EmptyState, LoadingBlock, PageHeader, StatusBadge, WarningBox } from '../components/Common';

const blank = { name: '', email: '', password: '', role: 'STAFF', companyId: '' };

export default function UsersPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const load = () => {
    setLoading(true);
    Promise.all([api.get(appendCompany('/users')), user.role === 'SUPER_ADMIN' ? api.get('/companies') : Promise.resolve({ data: { companies: [] } })])
      .then(([u, c]) => { setUsers(u.data.users || []); setCompanies(c.data.companies || []); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [selectedCompanyId]);

  const save = async (event) => {
    event.preventDefault();
    try { await api.post('/users', { ...form, companyId: user.role === 'SUPER_ADMIN' ? form.companyId || selectedCompanyId : user.companyId }); toast.success('User created'); setOpen(false); setForm(blank); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not create user'); }
  };

  if (user.role === 'SUPER_ADMIN' && !selectedCompanyId && !companies.length && !loading) return <WarningBox title="Create a company first">A non-super-admin user must belong to a company.</WarningBox>;

  return (
    <>
      <PageHeader title="Users & Access" description="Manage company administrators and staff accounts." actions={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Add user</button>} />
      {loading ? <LoadingBlock /> : !users.length ? <EmptyState title="No users found" /> : <div className="table-card"><div className="table-wrap"><table><thead><tr><th>User</th><th>Company</th><th>Role</th><th>Status</th></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td><div className="table-person"><div className="avatar small">{item.name?.slice(0, 1)}</div><div><strong>{item.name}</strong><span>{item.email}</span></div></div></td><td>{item.company?.name || 'System-wide'}</td><td>{item.role.replaceAll('_', ' ')}</td><td><StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} /></td></tr>)}</tbody></table></div></div>}
      <Modal open={open} title="Create User" onClose={() => setOpen(false)}>
        <form className="form-grid two" onSubmit={save}>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Temporary password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{user.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}<option value="COMPANY_ADMIN">Company Admin</option><option value="STAFF">Staff</option></select></label>
          {user.role === 'SUPER_ADMIN' && form.role !== 'SUPER_ADMIN' && <label className="span-2">Company<select value={form.companyId || selectedCompanyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} required><option value="">Select company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
          <div className="form-actions span-2"><button className="primary-button"><Save size={17} /> Create user</button></div>
        </form>
      </Modal>
    </>
  );
}
