import airplay from './brand-icons/airplayaudio.svg?url';
import applemusic from './brand-icons/applemusic.svg?url';
import appletv from './brand-icons/appletv.svg?url';
import deezer from './brand-icons/deezer.svg?url';
import netflix from './brand-icons/netflix.svg?url';
import plex from './brand-icons/plex.svg?url';
import radiofrance from './brand-icons/radiofrance.svg?url';
import sonos from './brand-icons/sonos.svg?url';
import soundcloud from './brand-icons/soundcloud.svg?url';
import spotify from './brand-icons/spotify.svg?url';
import tidal from './brand-icons/tidal.svg?url';
import youtube from './brand-icons/youtube.svg?url';
import youtubemusic from './brand-icons/youtubemusic.svg?url';

export interface ServiceBrand { image: string; tone: string }

/** Genuine service artwork, shown only when HA supplies a recognisable source name. */
export function serviceBrand(source: string): ServiceBrand | undefined {
  const name = source.trim().toLowerCase();
  if (!name) return undefined;
  if (name.includes('youtube music')) return { image: youtubemusic, tone: 'youtube' };
  if (name.includes('youtube')) return { image: youtube, tone: 'youtube' };
  if (name.includes('apple music')) return { image: applemusic, tone: 'apple' };
  if (name.includes('apple tv')) return { image: appletv, tone: 'apple' };
  if (name.includes('airplay')) return { image: airplay, tone: 'airplay' };
  if (name.includes('spotify')) return { image: spotify, tone: 'spotify' };
  if (name.includes('netflix')) return { image: netflix, tone: 'netflix' };
  if (name.includes('plex')) return { image: plex, tone: 'plex' };
  if (name.includes('tidal')) return { image: tidal, tone: 'tidal' };
  if (name.includes('deezer')) return { image: deezer, tone: 'deezer' };
  if (name.includes('soundcloud')) return { image: soundcloud, tone: 'soundcloud' };
  if (name.includes('radio france') || name.includes('radiofrance')) return { image: radiofrance, tone: 'radiofrance' };
  if (name.includes('sonos')) return { image: sonos, tone: 'sonos' };
  return undefined;
}
