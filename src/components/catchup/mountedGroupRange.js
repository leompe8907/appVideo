import { getMountedRange } from '../../utils/mountedWindow';

const GROUPS_BEHIND = 2;
const GROUPS_AHEAD = 5;

/** Secciones de riel montadas alrededor de la que tiene el foco (índices inclusivos). */
export function getMountedGroupRange(focusGroup, total) {
  return getMountedRange(focusGroup, total, GROUPS_BEHIND, GROUPS_AHEAD);
}
