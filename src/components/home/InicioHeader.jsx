import { useTranslation } from 'react-i18next';

/**
 * Cabecera de Inicio: tres zonas horizontales (izquierda, centro, derecha).
 * La configuración por marca vive en `currentBrand.header` (brands.js).
 */
export function InicioHeader() {
  const { t } = useTranslation();

  return (
    <header className="inicio-header" aria-label={t('inicio.header', { defaultValue: 'Cabecera de inicio' })}>
      <div className="inicio-header__col inicio-header__col--left" />
      <div className="inicio-header__col inicio-header__col--center" />
      <div className="inicio-header__col inicio-header__col--right" />
    </header>
  );
}

export default InicioHeader;
