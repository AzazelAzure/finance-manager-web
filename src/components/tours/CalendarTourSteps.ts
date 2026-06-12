import { tr, type AppLocale } from '../../lib/i18n';
import type { Step } from 'react-joyride';

export const CALENDAR_TOUR_ID = 'calendar_page_tour';

/**
 * Build localized tour steps for the Calendar page.
 */
export function buildCalendarSteps(locale: AppLocale): Step[] {
  return [
    {
      target: '.app-toolbar',
      title: tr('tour.calendar.overview.title', locale),
      content: tr('tour.calendar.overview.content', locale),
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#cal-nav-links',
      title: tr('tour.calendar.navLinks.title', locale),
      content: tr('tour.calendar.navLinks.content', locale),
      skipBeacon: true,
    },
    {
      target: '#cal-filters',
      title: tr('tour.calendar.filters.title', locale),
      content: tr('tour.calendar.filters.content', locale),
      skipBeacon: true,
    },
    {
      target: '#cal-daily-chart',
      title: tr('tour.calendar.dailyChart.title', locale),
      content: tr('tour.calendar.dailyChart.content', locale),
      skipBeacon: true,
    },
    {
      target: '#cal-month-grid',
      title: tr('tour.calendar.monthGrid.title', locale),
      content: tr('tour.calendar.monthGrid.content', locale),
      skipBeacon: true,
    },
    {
      target: '#cal-day-detail',
      title: tr('tour.calendar.dayDetail.title', locale),
      content: tr('tour.calendar.dayDetail.content', locale),
      skipBeacon: true,
    },
    {
      target: '#cal-monthly-totals',
      title: tr('tour.calendar.monthlyTotals.title', locale),
      content: tr('tour.calendar.monthlyTotals.content', locale),
      skipBeacon: true,
    },
    {
      target: '#cal-due-events',
      title: tr('tour.calendar.dueEvents.title', locale),
      content: tr('tour.calendar.dueEvents.content', locale),
      skipBeacon: true,
    },
    {
      target: '#cal-day-drill',
      title: tr('tour.calendar.dayDrill.title', locale),
      content: tr('tour.calendar.dayDrill.content', locale),
      skipBeacon: true,
    },
  ];
}
