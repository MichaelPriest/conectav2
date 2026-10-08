/**
 * Database columns website/music_url are nullable. Form fields need strings
 * even after reading older, partial, or inconsistent profile records.
 * Keep this module pure so normalization can be regression tested.
 */
export type ProfileDetails = {
  headline: string;
  city: string;
  website: string;
  music_url: string;
  interests: string[];
  favorite_emoji: string;
  cover_theme: 'violet' | 'aqua' | 'pink' | 'sunset' | 'midnight';
  mood_text: string;
  layout_style: 'classic' | 'myspace' | 'minimal';
};

export const DEFAULT_PROFILE_DETAILS: ProfileDetails = {
  headline: '',
  city: '',
  website: '',
  music_url: '',
  interests: [],
  favorite_emoji: '💜',
  cover_theme: 'violet',
  mood_text: '',
  layout_style: 'classic'
};

const coverThemes = ['violet', 'aqua', 'pink', 'sunset', 'midnight'] as const;
const layoutStyles = ['classic', 'myspace', 'minimal'] as const;

function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function normalizeProfileDetails(value: Record<string, unknown> | null | undefined): ProfileDetails {
  const source = value ?? {};
  return {
    headline: textOrEmpty(source.headline),
    city: textOrEmpty(source.city),
    website: textOrEmpty(source.website),
    music_url: textOrEmpty(source.music_url),
    interests: Array.isArray(source.interests)
      ? source.interests.filter((item): item is string => typeof item === 'string').slice(0, 12)
      : [],
    favorite_emoji: typeof source.favorite_emoji === 'string' && source.favorite_emoji.length > 0
      && source.favorite_emoji.length <= 16 ? source.favorite_emoji : DEFAULT_PROFILE_DETAILS.favorite_emoji,
    cover_theme: coverThemes.find(theme => theme === source.cover_theme) ?? DEFAULT_PROFILE_DETAILS.cover_theme,
    mood_text: textOrEmpty(source.mood_text),
    layout_style: layoutStyles.find(style => style === source.layout_style) ?? DEFAULT_PROFILE_DETAILS.layout_style
  };
}

/** Prepare nullable database fields without ever calling .trim() on null. */
export function prepareProfileDetails(
  details: Record<string, unknown> | null | undefined,
  interestsInput: string
): Omit<ProfileDetails, 'website' | 'music_url'> & { website: string | null; music_url: string | null } {
  const normalized = normalizeProfileDetails(details);
  const interests = [...new Set(textOrEmpty(interestsInput)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean))].slice(0, 12);
  if (interests.some(value => value.length > 32)) {
    throw new Error('Cada interesse deve ter até 32 caracteres.');
  }
  return {
    ...normalized,
    headline: normalized.headline.trim(),
    city: normalized.city.trim(),
    mood_text: normalized.mood_text.trim(),
    website: normalized.website.trim() || null,
    music_url: normalized.music_url.trim() || null,
    interests
  };
}
