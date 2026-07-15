import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loader"><div className="spinner" /><p>Loading portal…</p></div>;
  return user ? children : <Navigate to="/login" replace />;
}
