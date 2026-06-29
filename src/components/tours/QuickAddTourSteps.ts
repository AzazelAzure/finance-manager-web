import { tr, type AppLocale } from '../../lib/i18n';
import type { Step } from 'react-joyride';

export const QUICK_ADD_TOUR_ID = 'quick_add_form_tour';

type QuickActionType = 'INCOME' | 'EXPENSE' | 'XFER' | 'BILL';

export function buildQuickAddSteps(locale: AppLocale, actionType: QuickActionType): Step[] {
  const common: Step[] = [
    {
      target: '#quick-form-date',
      title: tr('tour.quickAdd.date.title', locale),
      content: tr('tour.quickAdd.date.content', locale),
      skipBeacon: true,
    },
  ];

  if (actionType === 'XFER') {
    return [
      ...common,
      {
        target: '#quick-xfer-from',
        title: tr('tour.quickAdd.xferFrom.title', locale),
        content: tr('tour.quickAdd.xferFrom.content', locale),
        skipBeacon: true,
      },
      {
        target: '#quick-xfer-to',
        title: tr('tour.quickAdd.xferTo.title', locale),
        content: tr('tour.quickAdd.xferTo.content', locale),
        skipBeacon: true,
      },
      {
        target: '#quick-xfer-sent',
        title: tr('tour.quickAdd.amount.title', locale),
        content: tr('tour.quickAdd.amount.content', locale),
        skipBeacon: true,
      },
      {
        target: '#quick-xfer-received',
        title: tr('tour.quickAdd.xferReceived.title', locale),
        content: tr('tour.quickAdd.xferReceived.content', locale),
        skipBeacon: true,
      },
      {
        target: '#quick-form-desc',
        title: tr('tour.quickAdd.description.title', locale),
        content: tr('tour.quickAdd.description.content', locale),
        skipBeacon: true,
      },
    ];
  }

  if (actionType === 'BILL') {
    return [
      {
        target: '#quick-single-amount',
        title: tr('tour.quickAdd.amount.title', locale),
        content: tr('tour.quickAdd.amount.content', locale),
        skipBeacon: true,
      },
      {
        target: '#quick-single-source',
        title: tr('tour.quickAdd.source.title', locale),
        content: tr('tour.quickAdd.source.content', locale),
        skipBeacon: true,
      },
      {
        target: '#quick-form-due',
        title: tr('tour.quickAdd.dueDate.title', locale),
        content: tr('tour.quickAdd.dueDate.content', locale),
        skipBeacon: true,
      },
      {
        target: '#quick-form-desc',
        title: tr('tour.quickAdd.description.title', locale),
        content: tr('tour.quickAdd.description.content', locale),
        skipBeacon: true,
      },
    ];
  }

  return [
    ...common,
    {
      target: '#quick-single-amount',
      title: tr('tour.quickAdd.amount.title', locale),
      content: tr('tour.quickAdd.amount.content', locale),
      skipBeacon: true,
    },
    {
      target: '#quick-single-source',
      title: tr('tour.quickAdd.source.title', locale),
      content: tr('tour.quickAdd.source.content', locale),
      skipBeacon: true,
    },
    {
      target: '#quick-single-currency',
      title: tr('tour.quickAdd.currency.title', locale),
      content: tr('tour.quickAdd.currency.content', locale),
      skipBeacon: true,
    },
    {
      target: '#quick-form-cat',
      title: tr('tour.quickAdd.category.title', locale),
      content: tr('tour.quickAdd.category.content', locale),
      skipBeacon: true,
    },
    {
      target: '#quick-form-link-bill',
      title: tr('tour.quickAdd.linkBill.title', locale),
      content: tr('tour.quickAdd.linkBill.content', locale),
      skipBeacon: true,
    },
    {
      target: '#quick-form-tags',
      title: tr('tour.quickAdd.tags.title', locale),
      content: tr('tour.quickAdd.tags.content', locale),
      skipBeacon: true,
    },
    {
      target: '#quick-form-desc',
      title: tr('tour.quickAdd.description.title', locale),
      content: tr('tour.quickAdd.description.content', locale),
      skipBeacon: true,
    },
  ];
}
