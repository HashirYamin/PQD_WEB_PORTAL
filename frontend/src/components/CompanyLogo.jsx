import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import api from '../api/client';

export default function CompanyLogo({
  companyId,
  companyName = 'Company',
  className = '',
  fallbackSize = 18
}) {
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    setLogoUrl('');

    if (!companyId) {
      return undefined;
    }

    api
      .get(`/companies/${companyId}/logo`, {
        responseType: 'blob'
      })
      .then(({ data }) => {
        if (!active) return;

        objectUrl = URL.createObjectURL(data);
        setLogoUrl(objectUrl);
      })
      .catch(() => {
        if (active) {
          setLogoUrl('');
        }
      });

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [companyId]);

  return (
    <span
      className={`company-logo-shell ${className}`}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${companyName} logo`}
        />
      ) : (
        <Building2 size={fallbackSize} />
      )}
    </span>
  );
}