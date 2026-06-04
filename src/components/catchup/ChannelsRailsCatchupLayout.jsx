import { useState } from 'react';
import { EmblaHorizontalRail } from '../navigation/EmblaHorizontalRail';
import CatchupCard from './CatchupCard';
import CatchupSeeMoreCard from './CatchupSeeMoreCard';
import CatchupGroupModal from './CatchupGroupModal';
import { getCatchupGroupKey, getCatchupGroupTitle, getCatchupRailItemKey } from '../../utils/catchupEvent';

const ITEMS_PER_RAIL = 9;

export function ChannelsRailsCatchupLayout({ groups, onSelectEvent, t }) {
  const [modalGroup, setModalGroup] = useState(null);

  const nonEmptyGroups = (groups || []).filter((g) => (g?.events || []).length > 0);

  return (
    <>
      <div className="catchup-layout catchup-layout--rails">
        {nonEmptyGroups.map((group, groupIndex) => {
          const events = group.events || [];
          const preview = events.slice(0, ITEMS_PER_RAIL);
          const hasMore = events.length > ITEMS_PER_RAIL;
          const groupKey = getCatchupGroupKey(group, groupIndex);
          const groupTitle = getCatchupGroupTitle(group, t('catchup.unknownChannel', { defaultValue: 'Canal' }));

          return (
            <section
              key={groupKey}
              className="catchup-rail-section"
              style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 280px' }}
            >
              <h2 className="catchup-rail-title">{groupTitle}</h2>
              <EmblaHorizontalRail className="catchup-rail-cards">
                {preview.map((event, index) => (
                  <CatchupCard
                    key={getCatchupRailItemKey(event, groupKey, index)}
                    event={event}
                    onSelect={() => onSelectEvent?.(event, group)}
                  />
                ))}
                {hasMore ? (
                  <CatchupSeeMoreCard
                    key={`${groupKey}-see-more`}
                    onSelect={() => setModalGroup({ group, groupTitle })}
                  />
                ) : null}
              </EmblaHorizontalRail>
            </section>
          );
        })}

        {nonEmptyGroups.length === 0 ? (
          <div className="catchup-empty">{t('catchup.empty', { defaultValue: 'Sin catchup disponible' })}</div>
        ) : null}
      </div>

      {modalGroup ? (
        <CatchupGroupModal
          groupTitle={modalGroup.groupTitle}
          group={modalGroup.group}
          events={modalGroup.group?.events || []}
          onSelectEvent={onSelectEvent}
          onClose={() => setModalGroup(null)}
        />
      ) : null}
    </>
  );
}

export default ChannelsRailsCatchupLayout;
