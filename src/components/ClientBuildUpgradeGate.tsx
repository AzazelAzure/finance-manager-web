import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  clientBuildUnsupportedEventName,
  type ClientBuildUnsupportedDetail,
} from '../lib/clientBuildUpgradeEvents'
import { Button } from './ui/Button'

export function ClientBuildUpgradeGate(): ReactNode {
  const [detail, setDetail] = useState<ClientBuildUnsupportedDetail | null>(null)

  useEffect(() => {
    const eventName = clientBuildUnsupportedEventName()
    const onUnsupported = (e: Event): void => {
      const ce = e as CustomEvent<ClientBuildUnsupportedDetail>
      setDetail(ce.detail ?? {})
    }
    window.addEventListener(eventName, onUnsupported)
    return () => window.removeEventListener(eventName, onUnsupported)
  }, [])

  if (!detail) {
    return null
  }

  const reload = (): void => {
    window.location.reload()
  }

  return createPortal(
    <div className="ui-modal-backdrop" role="presentation" style={{ cursor: 'default' }}>
      <div
        className="ui-modal-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="fm-upgrade-title"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <h2 id="fm-upgrade-title" style={{ margin: 0, fontSize: 'var(--font-lg)' }}>
          Update required
        </h2>
        <p style={{ marginTop: '0.75rem', lineHeight: 1.5 }}>
          {detail.message ??
            'This version of the app can no longer sync changes. Reload to get the latest version.'}
        </p>
        {detail.min_supported_build ? (
          <p style={{ marginTop: '0.5rem', fontSize: 'var(--font-sm)', opacity: 0.85 }}>
            Minimum supported build: {detail.min_supported_build}
          </p>
        ) : null}
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button type="button" variant="primary" onClick={reload}>
            Reload app
          </Button>
          {detail.documentation_url ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.open(detail.documentation_url, '_blank', 'noopener,noreferrer')
              }}
            >
              Learn more
            </Button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
