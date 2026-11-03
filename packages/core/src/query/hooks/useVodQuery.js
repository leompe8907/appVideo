import { useQuery } from '@tanstack/react-query';
import { loadVODData } from '../../services/vodService';
import { queryKeys } from '../keys';

export function useVodQuery(brandConfig, { enabled = true, t, enableRetry } = {}) {
  const brand = brandConfig?.brand || brandConfig?.id || 'default';
  return useQuery({
    queryKey: queryKeys.vod(brand),
    enabled: enabled && !!brandConfig,
    queryFn: async () => {
      return loadVODData(brandConfig, {
        t,
        enableRetry: !!enableRetry,
      });
    },
    staleTime: 10 * 60_000,
    gcTime: 15 * 60_000,
  });
}

export default useVodQuery;

