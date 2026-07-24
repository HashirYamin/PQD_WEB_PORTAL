import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function SupplierLogo({
  supplierId,
  supplierName,
  className = '',
  fallbackSize = 24
}) {
  const { appendCompany } = useAuth();
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    setSrc('');

    if (!supplierId) {
      return () => {};
    }

    api
      .get(appendCompany(`/suppliers/${supplierId}/logo`), {
        responseType: 'blob'
      })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [supplierId, appendCompany]);

  if (src) {
    return (
      <img
        src={src}
        alt={`${supplierName || 'Supplier'} logo`}
        className={className}
      />
    );
  }

  return (
    <span
      className={`${className} supplier-logo-fallback`}
      title={supplierName || 'Supplier'}
      aria-label={supplierName || 'Supplier'}
    >
      <Truck size={fallbackSize} />
    </span>
  );
}
