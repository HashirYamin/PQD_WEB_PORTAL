import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pqd_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pqd_token');
      localStorage.removeItem('pqd_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const downloadWithAuth = async (url, filename) => {
  const response = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
};

export const viewWithAuth = async (url) => {
  // Open the tab immediately so browsers do not block it as a popup.
  const previewWindow = window.open('about:blank', '_blank');

  if (previewWindow) {
    previewWindow.document.title = 'Loading document…';
    previewWindow.document.body.innerHTML =
      '<p style="font-family:Arial;padding:24px">Loading document preview…</p>';
  }

  try {
    const response = await api.get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(response.data);

    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.location.replace(href);
    } else {
      window.open(href, '_blank', 'noopener,noreferrer');
    }

    // Keep the object URL available long enough for the new tab to load it.
    window.setTimeout(() => URL.revokeObjectURL(href), 5 * 60 * 1000);
  } catch (error) {
    if (previewWindow) previewWindow.close();
    throw error;
  }
};

export default api;
