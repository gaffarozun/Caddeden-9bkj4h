import type { VenueDemographics } from './cafePresenceService';
import { occupancyShare } from './educationService';
export interface VenueRatioPair { id: string; firstLabel: string; secondLabel: string; first: number | null; second: number | null }
// Two independent partitions of known declarations; undisclosed data is never labelled as non-student.
export function venueRatioPairs(data?: VenueDemographics): VenueRatioPair[] {
 const female = Math.max(0, data?.female ?? 0); const male = Math.max(0, data?.male ?? 0);
 const university = Math.max(0, data?.university ?? 0);
 const nonUniversity = Math.max(0, (data?.student ?? 0) - university) + Math.max(0, data?.nonstudent ?? 0);
 const genderShare = occupancyShare(female, female + male);
 const universityShare = occupancyShare(university, university + nonUniversity);
 return [
  { id: 'gender', firstLabel: 'Kadın', secondLabel: 'Erkek', first: genderShare, second: genderShare === null ? null : 100 - genderShare },
  { id: 'university', firstLabel: 'Üniversite öğrencisi', secondLabel: 'Üniversite öğrencisi değil', first: universityShare, second: universityShare === null ? null : 100 - universityShare },
 ];
}
