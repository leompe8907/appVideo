import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../../contexts/BrandContext';
import { getChannelStableId } from '@appvideo/core/utils/channelId';

function buildLogoUrlFromLogo2Id(channel) {
  if (!channel) return null;
  const logo2id = channel.logo2id ?? channel.logo2Id ?? channel.logo2ID ?? channel.logo_2_id;
  if (!logo2id) return null;
  return `/cdn/public/images/${logo2id}/v/thumb.png`;
}

export function ParentalChannelCard({
  channel,
  blocked = false,
  onSelect,
}) {
  const { t } = useTranslation();
  const { currentBrand, getImage } = useBrand();
  const id = getChannelStableId(channel);

  const placeholderImageUrl =
    currentBrand?.assets?.placeholder || getImage?.('placeholder_220x160.png') || '';

  const initialLogoUrl = useMemo(() => {
    const logo =
      buildLogoUrlFromLogo2Id(channel) ||
      channel?.img ||
      channel?.imageUrl ||
      channel?.logoUrl ||
      channel?.logo ||
      channel?.icon ||
      '';
    return logo || placeholderImageUrl || '';
  }, [channel, placeholderImageUrl]);

  const [logoSrc, setLogoSrc] = useState(initialLogoUrl);

  return (
    <button
      type="button"
      className={[
        'parental-channel-card',
        blocked ? 'parental-channel-card--blocked' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect?.(channel)}
      data-id={id}
      data-lcn={channel?.lcn ?? ''}
      aria-label={`${channel?.lcn ?? ''} ${channel?.name ?? ''}`.trim()}
    >
      <div className="parental-channel-card__media">
        {logoSrc ? (
          <img
            className="parental-channel-card__img"
            src={logoSrc}
            alt={channel?.name ?? ''}
            onError={() => {
              if (placeholderImageUrl && logoSrc !== placeholderImageUrl) {
                setLogoSrc(placeholderImageUrl);
              } else if (logoSrc) {
                setLogoSrc('');
              }
            }}
          />
        ) : (
          <div className="parental-channel-card__img parental-channel-card__img--placeholder" />
        )}
      </div>

      <div className="parental-channel-card__name" title={channel?.name ?? ''}>
        {channel?.lcn != null && channel?.lcn !== '' ? `${channel.lcn} ` : ''}
        {channel?.name ?? ''}
      </div>
      <div className="parental-channel-card__state">
        {blocked
          ? `🔒 ${t('parental.blocked', { defaultValue: 'Bloqueado' })}`
          : t('parental.block', { defaultValue: 'Bloquear canal' })}
      </div>
    </button>
  );
}

export default ParentalChannelCard;

