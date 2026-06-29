import { tr, type AppLocale } from '../../lib/i18n';
import type { Step } from 'react-joyride';

export const PROFILE_TOUR_ID = 'profile_settings_tour';

export function buildProfileSteps(locale: AppLocale): Step[] {
  return [
    {
      target: '#profile-page-title',
      title: tr('tour.profile.overview.title', locale),
      content: tr('tour.profile.overview.content', locale),
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#profile-tab-settings',
      title: tr('tour.profile.settings.title', locale),
      content: tr('tour.profile.settings.content', locale),
      skipBeacon: true,
    },
    {
      target: '#profile-tab-data',
      title: tr('tour.profile.dataExport.title', locale),
      content: tr('tour.profile.dataExport.content', locale),
      skipBeacon: true,
    },
    {
      target: '#profile-tab-security',
      title: tr('tour.profile.security.title', locale),
      content: tr('tour.profile.security.content', locale),
      skipBeacon: true,
    },
    {
      target: '#profile-reset-tours',
      title: tr('tour.profile.resetTours.title', locale),
      content: tr('tour.profile.resetTours.content', locale),
      skipBeacon: true,
    },
  ];
}
