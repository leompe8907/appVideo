import '../../styles/license/LicenseLoadingState.scss';

export function LicenseLoadingState({ message = 'Cargando licencias...' }) {
  return (
    <div className="license-loading-state">
      <div className="loading-spinner"></div>
      <p className="loading-text">{message}</p>
    </div>
  );
}

export default LicenseLoadingState;

