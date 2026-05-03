/** Immutable SPA build id sent as `X-Client-Build` on mutating API calls (D2 / T03). */
export const CLIENT_BUILD: string =
  typeof __FM_CLIENT_BUILD__ === 'string' && __FM_CLIENT_BUILD__.length > 0
    ? __FM_CLIENT_BUILD__
    : 'dev'
