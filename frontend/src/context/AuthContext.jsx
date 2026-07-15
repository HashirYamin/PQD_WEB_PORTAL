import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pqd_user')) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('pqd_token')));
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => localStorage.getItem('pqd_company_id') || '');

  useEffect(() => {
    const token = localStorage.getItem('pqd_token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
        localStorage.setItem('pqd_user', JSON.stringify(data.user));
        if (data.user.companyId && !selectedCompanyId) {
          setSelectedCompanyId(data.user.companyId);
          localStorage.setItem('pqd_company_id', data.user.companyId);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('pqd_token', data.token);
    localStorage.setItem('pqd_user', JSON.stringify(data.user));
    setUser(data.user);
    if (data.user.companyId) {
      setSelectedCompanyId(data.user.companyId);
      localStorage.setItem('pqd_company_id', data.user.companyId);
    }
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('pqd_token');
    localStorage.removeItem('pqd_user');
    localStorage.removeItem('pqd_company_id');
    setUser(null);
    setSelectedCompanyId('');
  };

  const selectCompany = (id) => {
    setSelectedCompanyId(id);
    if (id) localStorage.setItem('pqd_company_id', id);
    else localStorage.removeItem('pqd_company_id');
  };

  const companyQuery = selectedCompanyId ? `companyId=${selectedCompanyId}` : '';
  const appendCompany = (url) => selectedCompanyId ? `${url}${url.includes('?') ? '&' : '?'}companyId=${selectedCompanyId}` : url;

  const value = useMemo(() => ({ user, loading, login, logout, selectedCompanyId, selectCompany, companyQuery, appendCompany }), [user, loading, selectedCompanyId]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
