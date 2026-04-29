/** Static demo numbers for the marketing live preview (no API). */
export const livePreviewData = {
  kpi: [
    { label: "Income", value: "4,250.00" },
    { label: "Expenses", value: "2,180.00" },
    { label: "Upcoming bills", value: "640.00" },
    { label: "Safe to spend", value: "1,120.00" },
  ] as const,
  rows: [
    { when: "Today", what: "Groceries", source: "Checking", amount: "-84.20" },
    { when: "Today", what: "Payroll", source: "Employer", amount: "+2,000.00" },
    { when: "Yesterday", what: "Utilities", source: "Checking", amount: "-128.00" },
    { when: "Yesterday", what: "Transfer to Savings", source: "Checking", amount: "-300.00" },
  ] as const,
  balances: [
    { source: "Checking", amount: "2,540.00" },
    { source: "Savings", amount: "6,200.00" },
    { source: "Cash", amount: "180.00" },
  ] as const,
};
