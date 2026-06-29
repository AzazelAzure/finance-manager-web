import { tr, type AppLocale } from '../../lib/i18n';
import type { Step } from 'react-joyride';

export const GOALS_TOUR_ID = 'goals_page_tour';

export function buildGoalsSteps(locale: AppLocale): Step[] {
  return [
    {
      target: '#goals-heading',
      title: tr('tour.goals.heading.title', locale),
      content: tr('tour.goals.heading.content', locale),
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#goals-add-btn',
      title: tr('tour.goals.add.title', locale),
      content: tr('tour.goals.add.content', locale),
      skipBeacon: true,
    },
    {
      target: '#goals-list',
      title: tr('tour.goals.list.title', locale),
      content: tr('tour.goals.list.content', locale),
      skipBeacon: true,
    },
  ];
}
