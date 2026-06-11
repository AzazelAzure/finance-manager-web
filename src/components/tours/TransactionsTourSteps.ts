import { tr, type AppLocale } from '../../lib/i18n';
import type { Step } from 'react-joyride';

export const TRANSACTIONS_TOUR_ID = 'transactions_page_tour';

/**
 * Build localized tour steps for the Transactions page.
 */
export function buildTransactionsSteps(locale: AppLocale): Step[] {
  return [
    {
      target: '.app-toolbar',
      title: tr('tour.tx.overview.title', locale),
      content: tr('tour.tx.overview.content', locale),
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#tx-nav-links',
      title: tr('tour.tx.navLinks.title', locale),
      content: tr('tour.tx.navLinks.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-add',
      title: tr('tour.tx.addButtons.title', locale),
      content: tr('tour.tx.addButtons.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-filters',
      title: tr('tour.tx.filters.title', locale),
      content: tr('tour.tx.filters.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-filter-period',
      title: tr('tour.tx.filterPeriod.title', locale),
      content: tr('tour.tx.filterPeriod.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-filter-type',
      title: tr('tour.tx.filterType.title', locale),
      content: tr('tour.tx.filterType.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-filter-actions',
      title: tr('tour.tx.filterActions.title', locale),
      content: tr('tour.tx.filterActions.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-table',
      title: tr('tour.tx.table.title', locale),
      content: tr('tour.tx.table.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-table',
      title: tr('tour.tx.editDelete.title', locale),
      content: tr('tour.tx.editDelete.content', locale),
      skipBeacon: true,
    },
  ];
}
