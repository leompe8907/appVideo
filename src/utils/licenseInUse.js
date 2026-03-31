export function isLicenseInUseError(err) {
  // panaccessService puede envolver el error real dentro de `cause`,
  // por eso juntamos mensajes/códigos en varios niveles.
  const collectMessages = (e) => {
    const parts = [];
    let cur = e;
    let depth = 0;
    while (cur && depth < 6) {
      if (typeof cur?.message === 'string') parts.push(cur.message);
      if (typeof cur?.userMessage === 'string') parts.push(cur.userMessage);
      if (typeof cur?.errorInfo?.userMessage === 'string') parts.push(cur.errorInfo.userMessage);
      if (typeof cur?.errorInfo?.message === 'string') parts.push(cur.errorInfo.message);
      if (typeof cur?.originalError?.message === 'string') parts.push(cur.originalError.message);
      cur = cur.cause;
      depth += 1;
    }
    return parts.join(' | ');
  };

  const msg = collectMessages(err).toLowerCase();
  const code =
    err?.errorCode ||
    err?.code ||
    err?.errorInfo?.code ||
    err?.cause?.errorCode ||
    err?.cause?.code ||
    '';

  return (
    msg.includes('already in use') ||
    msg.includes('en uso') ||
    msg.includes('license_already_in_use') ||
    code === 'license_already_in_use'
  );
}

