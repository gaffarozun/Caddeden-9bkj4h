import { runCafeArrivalChecks } from './cafeArrivalChecks';
import { runCafeSeatingSocialChecks } from './cafeSeatingSocialChecks';
import { defaultThemeForGender, resolveTheme } from '../services/themePreferenceService';
export function runVenuePresenceChecks() {
 if (defaultThemeForGender() !== 'light' || resolveTheme('auto', 'female', true) !== 'light') throw new Error('Default appearance must be light independent of account gender/device.');
 if (resolveTheme('dark', null, false) !== 'dark' || resolveTheme('mustard', null, true) !== 'mustard') throw new Error('Explicit saved palettes must be preserved.');
 runCafeArrivalChecks();
 runCafeSeatingSocialChecks();
 return 'passed: light default, preserved explicit themes, strict 50 m location and seven-day privacy helpers';
}
