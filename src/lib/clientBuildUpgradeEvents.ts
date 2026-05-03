const EVENT = 'fm-client-build-unsupported'

export type ClientBuildUnsupportedDetail = {
  message?: string
  min_supported_build?: string
  documentation_url?: string
}

export function dispatchClientBuildUnsupported(detail: ClientBuildUnsupportedDetail): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail }))
}

export function clientBuildUnsupportedEventName(): typeof EVENT {
  return EVENT
}
