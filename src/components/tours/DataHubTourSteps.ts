import { tr, type AppLocale } from '../../lib/i18n';
import type { Step } from 'react-joyride';

export const DATA_HUB_TOUR_ID = 'data_hub_tour';

export function buildDataHubSteps(locale: AppLocale): Step[] {
  return [
    {
      target: '.app-surface--data',
      title: tr('tour.dataHub.overview.title', locale),
      content: tr('tour.dataHub.overview.content', locale),
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#datahub-overview-kpis',
      title: tr('tour.dataHub.kpis.title', locale),
      content: tr('tour.dataHub.kpis.content', locale),
      skipBeacon: true,
    },
    {
      target: '#datahub-tab-sources',
      title: tr('tour.dataHub.sources.title', locale),
      content: tr('tour.dataHub.sources.content', locale),
      skipBeacon: true,
    },
    {
      target: '#datahub-tab-categories',
      title: tr('tour.dataHub.categories.title', locale),
      content: tr('tour.dataHub.categories.content', locale),
      skipBeacon: true,
    },
    {
      target: '#datahub-tab-tags',
      title: tr('tour.dataHub.tags.title', locale),
      content: tr('tour.dataHub.tags.content', locale),
      skipBeacon: true,
    },
  ];
}
