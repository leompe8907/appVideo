import { useActiveProfileStore } from './activeProfileStore';

export function useActiveProfile() {
  const id = useActiveProfileStore((s) => s.id);
  const name = useActiveProfileStore((s) => s.name);
  const imageId = useActiveProfileStore((s) => s.imageId);
  const setActiveProfile = useActiveProfileStore((s) => s.setActiveProfile);

  return { id, name, imageId, setActiveProfile };
}

export default useActiveProfile;
