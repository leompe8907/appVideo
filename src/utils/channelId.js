export function getChannelStableId(channel) {
  if (!channel) return '';
  // En este repo, el stream/canal normalmente usa `id` como identificador principal.
  // También puede existir `epgStreamId`. Como fallback, `lcn`.
  const id =
    channel.id ??
    channel.serviceId ??
    channel.channelId ??
    channel.epgStreamId ??
    channel.epg_stream_id ??
    channel.lcn ??
    '';
  return String(id).trim();
}

