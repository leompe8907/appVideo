import '../../styles/license/LicenseActivationOverlay.scss';

export function LicenseActivationOverlay({ message = 'Estableciendo licencia...' }) {
  return (
    <div className="license-activation-overlay">
      <div className="loading-spinner"></div>
      <p className="loading-text">{message}</p>
    </div>
  );
}

export default LicenseActivationOverlay;

