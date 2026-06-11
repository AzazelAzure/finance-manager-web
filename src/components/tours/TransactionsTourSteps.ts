import type { Step } from 'react-joyride';

export const TRANSACTIONS_TOUR_ID = 'transactions_page_tour';

/**
 * Guided tour for the Transactions page, covering each major element.
 */
export const TRANSACTIONS_TOUR_STEPS: Step[] = [
  // ── Overview ──
  {
    target: '.app-toolbar',
    title: 'Transactions Page',
    content: 'This is your full transaction ledger. Here you can view, filter, add, edit, and delete every financial entry across all your accounts.',
    placement: 'bottom',
    skipBeacon: true,
  },

  // ── Navigation links ──
  {
    target: '#tx-nav-links',
    title: 'Calendar & Deep Dive',
    content: 'Switch to Calendar view to see transactions on a monthly calendar, or Deep Dive for advanced analytics and charts on your spending patterns.',
    skipBeacon: true,
  },

  // ── Add buttons ──
  {
    target: '#tx-add',
    title: 'Add Transactions',
    content: 'Use "Add transaction" for single entries (income, expense) or "Add transfer" for account-to-account moves. Transfers automatically track fees as leaks when sent and received amounts differ.',
    skipBeacon: true,
  },

  // ── Filters ──
  {
    target: '#tx-filters',
    title: 'Filter Your Transactions',
    content: 'Narrow down by period, transaction type, tag, category, source, or currency. Hit "Apply" to reload results, or "Reset" to clear all filters.',
    skipBeacon: true,
  },

  // ── Filter period ──
  {
    target: '#tx-filter-period',
    title: 'Period Filter',
    content: 'Choose current month, last month, previous week, or a custom date range. Custom lets you specify exact start and end dates.',
    skipBeacon: true,
  },

  // ── Filter type ──
  {
    target: '#tx-filter-type',
    title: 'Type Filter',
    content: 'Filter by Expense, Income, Transfer Out, or Transfer In to isolate specific transaction types.',
    skipBeacon: true,
  },

  // ── Apply / Reset ──
  {
    target: '#tx-filter-actions',
    title: 'Apply & Reset',
    content: 'Apply commits your filter selections and reloads the table. Reset clears everything back to defaults.',
    skipBeacon: true,
  },

  // ── Data table ──
  {
    target: '#tx-table',
    title: 'Transaction Table',
    content: 'Your transactions are listed here with date, type, description, amount, source, category, and tags. Click column headers to sort.',
    skipBeacon: true,
  },

  // ── Inline actions ──
  {
    target: '#tx-table',
    title: 'Edit & Delete',
    content: 'Each row has inline Edit and Delete buttons. Delete requires a second click to confirm. Edited transactions update immediately across all dashboards and charts.',
    skipBeacon: true,
  },
];
