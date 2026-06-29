import { tr, type AppLocale } from '../../lib/i18n';
import type { Step } from 'react-joyride';

export const TRANSACTIONS_TOUR_ID = 'transactions_page_tour';
export const TRANSACTIONS_FORM_TOUR_ID = 'transactions_form_tour';

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

export function buildTransactionsFormSteps(locale: AppLocale, mode: 'single' | 'transfer'): Step[] {
  if (mode === 'transfer') {
    return [
      {
        target: '#tx-xfer-date',
        title: tr('tour.tx.form.date.title', locale),
        content: tr('tour.tx.form.date.content', locale),
        skipBeacon: true,
      },
      {
        target: '#tx-xfer-from',
        title: tr('tour.tx.form.xferFrom.title', locale),
        content: tr('tour.tx.form.xferFrom.content', locale),
        skipBeacon: true,
      },
      {
        target: '#tx-xfer-to',
        title: tr('tour.tx.form.xferTo.title', locale),
        content: tr('tour.tx.form.xferTo.content', locale),
        skipBeacon: true,
      },
      {
        target: '#tx-xfer-sent',
        title: tr('tour.tx.form.amount.title', locale),
        content: tr('tour.tx.form.amount.content', locale),
        skipBeacon: true,
      },
      {
        target: '#tx-xfer-received',
        title: tr('tour.tx.form.xferReceived.title', locale),
        content: tr('tour.tx.form.xferReceived.content', locale),
        skipBeacon: true,
      },
      {
        target: '#tx-form-desc',
        title: tr('tour.tx.form.description.title', locale),
        content: tr('tour.tx.form.description.content', locale),
        skipBeacon: true,
      },
    ];
  }

  return [
    {
      target: '#tx-form-date',
      title: tr('tour.tx.form.date.title', locale),
      content: tr('tour.tx.form.date.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-form-amount',
      title: tr('tour.tx.form.amount.title', locale),
      content: tr('tour.tx.form.amount.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-form-currency',
      title: tr('tour.tx.form.currency.title', locale),
      content: tr('tour.tx.form.currency.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-form-source',
      title: tr('tour.tx.form.source.title', locale),
      content: tr('tour.tx.form.source.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-form-type',
      title: tr('tour.tx.form.type.title', locale),
      content: tr('tour.tx.form.type.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-form-cat',
      title: tr('tour.tx.form.category.title', locale),
      content: tr('tour.tx.form.category.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-form-bill',
      title: tr('tour.tx.form.linkBill.title', locale),
      content: tr('tour.tx.form.linkBill.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-form-tags',
      title: tr('tour.tx.form.tags.title', locale),
      content: tr('tour.tx.form.tags.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tx-form-desc',
      title: tr('tour.tx.form.description.title', locale),
      content: tr('tour.tx.form.description.content', locale),
      skipBeacon: true,
    },
  ];
}
