/** Static demo numbers for the marketing live preview (no API). */
export const livePreviewData = {
  kpi: [
    { label: "Income", value: "4,250.00" },
    { label: "Outgoing", value: "2,180.00" },
    { label: "Safe to spend", value: "890.00" },
  ] as const,
  rows: [
    { when: "Today", what: "Groceries", amount: "-42.00" },
    { when: "Today", what: "Payroll", amount: "2,000.00" },
    { when: "Yesterday", what: "Utilities", amount: "-128.00" },
  ] as const,
};
