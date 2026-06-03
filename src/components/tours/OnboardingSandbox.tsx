import { useState } from 'react';
import { GlobalOnboardingTour } from './GlobalOnboardingTour';
import { BookOpen, Calendar, LayoutDashboard, List, LogOut, PlayCircle } from 'lucide-react';

interface OnboardingSandboxProps {
  onDismiss: () => void;
}

export function OnboardingSandbox({ onDismiss }: OnboardingSandboxProps) {
  const [view, setView] = useState('dashboard');
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg-body)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="protected-root" style={{ width: '100%', height: '100%' }}>
        <aside className="protected-sidebar" aria-label="Main navigation (desktop)">
          <div className="protected-brand" aria-hidden>
            <span className="protected-brand__mark" />
            <span className="protected-brand__text">Hive</span>
          </div>
          <div className="protected-side-nav">
            <button
              id="sandbox-nav-dashboard"
              className={`shell-nav-link ${view === 'dashboard' ? 'shell-nav-link--active' : ''}`}
              onClick={() => setView('dashboard')}
            >
              <LayoutDashboard size={20} className="shell-nav-icon" />
              <span className="shell-nav-label">Dashboard</span>
            </button>
            <button
              id="sandbox-nav-transactions"
              className={`shell-nav-link ${view === 'transactions' ? 'shell-nav-link--active' : ''}`}
              onClick={() => setView('transactions')}
            >
              <List size={20} className="shell-nav-icon" />
              <span className="shell-nav-label">Transactions</span>
            </button>
            <button
              id="sandbox-nav-calendar"
              className={`shell-nav-link ${view === 'calendar' ? 'shell-nav-link--active' : ''}`}
              onClick={() => setView('calendar')}
            >
              <Calendar size={20} className="shell-nav-icon" />
              <span className="shell-nav-label">Calendar</span>
            </button>
          </div>
          <div className="protected-bottom-bar">
            <button type="button" className="shell-nav-link">
              <BookOpen size={20} className="shell-nav-icon" />
              <span className="shell-nav-label">Guide</span>
            </button>
            <button type="button" className="shell-nav-link">
              <PlayCircle size={20} className="shell-nav-icon" />
              <span className="shell-nav-label">Replay Tour</span>
            </button>
            <button className="shell-nav-link shell-nav-link--danger" type="button">
              <LogOut size={20} className="shell-nav-icon" />
              <span className="shell-nav-label">Log out</span>
            </button>
          </div>
        </aside>

        <div className="protected-content-wrap">
          <header className="protected-sticky-top">
            <div className="protected-sticky-top__title-wrap">
              <h1 id="app-page-title">
                {view === 'dashboard' ? 'Dashboard' : view === 'transactions' ? 'Transactions' : 'Calendar'}
              </h1>
              <span className="protected-sticky-top__subtitle">Sandbox Mode</span>
            </div>
          </header>
          
          <main className="protected-main-inner" aria-labelledby="app-page-title">
            {view === 'dashboard' && (
              <div id="sandbox-dashboard-view" className="stack dashboard-page">
                <section id="sandbox-kpi-cards" className="dashboard-section" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <h3 className="muted-text" style={{ fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>Total Income</h3>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>$4,500.00</div>
                  </div>
                  <div style={{ flex: '1 1 200px', padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <h3 className="muted-text" style={{ fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>Total Expenses</h3>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>$2,100.00</div>
                  </div>
                  <div style={{ flex: '1 1 200px', padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <h3 className="muted-text" style={{ fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>Total Leaks</h3>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-danger)' }}>$150.00</div>
                  </div>
                </section>
                <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                   <h3 className="muted-text" style={{ margin: '0 0 1rem 0' }}>Flow Chart (Mock)</h3>
                   <div style={{ height: '200px', background: 'var(--bg-input)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <span className="muted-text">Chart Visualization</span>
                   </div>
                </div>
              </div>
            )}
            
            {view === 'transactions' && (
              <div id="sandbox-transactions-view" className="stack">
                <div style={{ padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <h3 className="muted-text" style={{ margin: '0 0 1rem 0' }}>Recent Transactions</h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    <li style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Grocery Store</strong> <span style={{ color: 'var(--text-danger)' }}>-$85.00</span>
                    </li>
                    <li style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Electric Bill</strong> <span style={{ color: 'var(--text-danger)' }}>-$120.00</span>
                    </li>
                    <li style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Salary</strong> <span style={{ color: 'var(--text-success)' }}>+$2,250.00</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {view === 'calendar' && (
              <div id="sandbox-calendar-view" className="stack">
                <div style={{ padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <h3 className="muted-text" style={{ margin: '0 0 1rem 0' }}>Upcoming Bills</h3>
                  <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Internet Subscription</strong>
                      <span>$60.00</span>
                    </div>
                    <div className="muted-text" style={{ fontSize: '0.875rem' }}>Due in 3 days</div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
      
      <GlobalOnboardingTour run={true} onViewChange={setView} onFinish={onDismiss} />
    </div>
  );
}
