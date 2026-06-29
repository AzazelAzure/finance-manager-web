import { tr, type AppLocale } from '../../lib/i18n';
import type { Step } from 'react-joyride';

export const UPCOMING_TOUR_ID = 'upcoming_expenses_tour';
export const UPCOMING_FORM_TOUR_ID = 'upcoming_bill_form_tour';

export function buildUpcomingPageSteps(locale: AppLocale): Step[] {
  return [
    {
      target: '#upcoming-filters',
      title: tr('tour.upcoming.filters.title', locale),
      content: tr('tour.upcoming.filters.content', locale),
      skipBeacon: true,
    },
    {
      target: '#upcoming-list',
      title: tr('tour.upcoming.list.title', locale),
      content: tr('tour.upcoming.list.content', locale),
      skipBeacon: true,
    },
    {
      target: '#upcoming-add',
      title: tr('tour.upcoming.add.title', locale),
      content: tr('tour.upcoming.add.content', locale),
      skipBeacon: true,
    },
  ];
}

export function buildUpcomingBillFormSteps(locale: AppLocale): Step[] {
  return [
    {
      target: '#bill-form-name',
      title: tr('tour.upcoming.form.name.title', locale),
      content: tr('tour.upcoming.form.name.content', locale),
      skipBeacon: true,
    },
    {
      target: '#bill-form-amount',
      title: tr('tour.upcoming.form.amount.title', locale),
      content: tr('tour.upcoming.form.amount.content', locale),
      skipBeacon: true,
    },
    {
      target: '#bill-form-currency',
      title: tr('tour.upcoming.form.currency.title', locale),
      content: tr('tour.upcoming.form.currency.content', locale),
      skipBeacon: true,
    },
    {
      target: '#bill-form-date',
      title: tr('tour.upcoming.form.dueDate.title', locale),
      content: tr('tour.upcoming.form.dueDate.content', locale),
      skipBeacon: true,
    },
    {
      target: '#bill-form-source',
      title: tr('tour.upcoming.form.source.title', locale),
      content: tr('tour.upcoming.form.source.content', locale),
      skipBeacon: true,
    },
    {
      target: '#bill-form-recurring',
      title: tr('tour.upcoming.form.recurring.title', locale),
      content: tr('tour.upcoming.form.recurring.content', locale),
      skipBeacon: true,
    },
    {
      target: '#bill-form-paid',
      title: tr('tour.upcoming.form.paid.title', locale),
      content: tr('tour.upcoming.form.paid.content', locale),
      skipBeacon: true,
    },
    {
      target: '#bill-form-window-toggle',
      title: tr('tour.upcoming.form.window.title', locale),
      content: tr('tour.upcoming.form.window.content', locale),
      skipBeacon: true,
    },
  ];
}
