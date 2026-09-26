import { StaticRating } from '@/types/database';

export interface RatingTier {
  value: StaticRating;
  label: string;
  description: string;
  startingElo: number;
}

export const RATING_TIERS: readonly RatingTier[] = [
  { value: 0, label: 'Unrated', description: 'No rating assigned', startingElo: 1200 },
  { value: 1, label: 'Beginner', description: 'Learning the rules', startingElo: 600 },
  { value: 2, label: 'Novice', description: 'Basic rallies & positioning', startingElo: 950 },
  { value: 3, label: 'Intermediate', description: 'Consistent dinks & strategy', startingElo: 1300 },
  { value: 4, label: 'Advanced', description: 'Aggressive play & resets', startingElo: 1650 },
  { value: 5, label: 'Expert', description: 'Tournament competitive', startingElo: 2000 },
] as const;

export function getRatingTier(rating: number | null | undefined): RatingTier {
  const match = RATING_TIERS.find((t) => t.value === rating);
  return match ?? RATING_TIERS[0];
}

export function formatRating(rating: number | null | undefined): string {
  if (rating === null || rating === undefined || rating === 0) return 'Unrated';
  const tier = getRatingTier(rating);
  return `★ ${tier.label} (${tier.value})`;
}

export function formatRatingShort(rating: number | null | undefined): string {
  if (rating === null || rating === undefined || rating === 0) return 'Unrated';
  return `★ ${rating}`;
}
