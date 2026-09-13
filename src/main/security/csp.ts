import { Session, app } from 'electron';

/**
 * OpenLabels - Security Policies
 * Enforces strict Content Security Policy (CSP) and denies system permissions.
 */

export const PROD_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export const DEV_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: http://localhost:5173",
  "font-src 'self'",
  "connect-src 'self' ws://localhost:5173 http://localhost:5173",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export const CONTENT_SECURITY_POLICY = PROD_CONTENT_SECURITY_POLICY;

/**
 * Attaches the Content Security Policy to all outgoing HTTP/file responses.
 */
export function setupContentSecurityPolicy(session: Session): void {
  const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged;
  const policy = isDev ? DEV_CONTENT_SECURITY_POLICY : PROD_CONTENT_SECURITY_POLICY;

  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
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
