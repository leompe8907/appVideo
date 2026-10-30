import { useQuery } from '@tanstack/react-query';
import panaccessService from '../../services/panaccessService';
import { processAdsFromApi } from '../../utils/adsData';
import { queryKeys } from '../keys';

export function useAdsQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.ads(),
    enabled,
    queryFn: async () => {
      const raw = await panaccessService.getAds({ enableRetry: false });
      const list = Array.isArray(raw) ? raw : [];
      return processAdsFromApi(list);
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

export default useAdsQuery;

