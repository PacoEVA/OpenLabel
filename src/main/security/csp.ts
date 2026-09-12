import { Session } from 'electron';

/**
 * OpenLabels - Security Policies
 * Enforces strict Content Security Policy (CSP) and denies system permissions.
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * Attaches the Content Security Policy to all outgoing HTTP/file responses.
 */
export function setupContentSecurityPolicy(session: Session): void {
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
      },
    });
  });
}

/**
 * Denies all system and peripheral permission requests by default.
 */
export function setupPermissionHandlers(session: Session): void {
  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}
