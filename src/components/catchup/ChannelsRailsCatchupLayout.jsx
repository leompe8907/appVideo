import { useLayoutEffect, useRef, useState } from 'react';
import { EmblaHorizontalRail } from '../navigation/EmblaHorizontalRail';
import CatchupCard from './CatchupCard';
import CatchupSeeMoreCard from './CatchupSeeMoreCard';
import CatchupGroupModal from './CatchupGroupModal';
import { getMountedGroupRange } from './mountedGroupRange';
import { getCatchupGroupKey, getCatchupGroupTitle, getCatchupRailItemKey } from '@appvideo/core/utils/catchupEvent';

const ITEMS_PER_RAIL = 9;

/** Altura aproximada de una sección de riel (px) hasta medir la real. */
const FALLBACK_RAIL_HEIGHT = 340;

export function ChannelsRailsCatchupLayout({ groups, onSelectEvent, t }) {
  const [modalGroup, setModalGroup] = useState(null);
  const [focusGroup, setFocusGroup] = useState(0);
  const [railHeight, setRailHeight] = useState(FALLBACK_RAIL_HEIGHT);
  const firstSectionRef = useRef(null);

  const nonEmptyGroups = (groups || []).filter((g) => (g?.events || []).length > 0);
  const { start, end } = getMountedGroupRange(focusGroup, nonEmptyGroups.length);

  // Los marcadores de las secciones sin montar usan la altura real de una montada: el scroll no salta.
  useLayoutEffect(() => {
    const h = firstSectionRef.current?.offsetHeight;
    if (h > 0 && h !== railHeight) setRailHeight(h);
  }, [railHeight, nonEmptyGroups.length]);

  return (
    <>
      <div className="catchup-layout catchup-layout--rails">
        {nonEmptyGroups.map((group, groupIndex) => {
          const events = group.events || [];
          const preview = events.slice(0, ITEMS_PER_RAIL);
          const hasMore = events.length > ITEMS_PER_RAIL;
          const groupKey = getCatchupGroupKey(group, groupIndex);
          const groupTitle = getCatchupGroupTitle(group, t('catchup.unknownChannel', { defaultValue: 'Canal' }));

          if (groupIndex < start || groupIndex > end) {
            return (
              <section
                key={groupKey}
                className="catchup-rail-section"
                data-placeholder="true"
                aria-hidden="true"
                style={{ height: railHeight }}
              />
            );
          }

          return (
            <section
              key={groupKey}
              ref={groupIndex === start ? firstSectionRef : undefined}
              className="catchup-rail-section"
              onFocus={() => setFocusGroup(groupIndex)}
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
