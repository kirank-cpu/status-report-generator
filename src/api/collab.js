// Client for the collaboration API (presence + section locks). All calls are
// polled/fired frequently, so they stay tiny.

import { request, requestRaw } from './client';

// Home page: { reportId: [{ username, name }] } — who currently has each open.
export const getHomePresence = () => request('/presence');

// Heartbeat into a report. Returns { presence, locks, meta } so a single poll
// covers "who's here", "what's locked", and "did the doc change".
export const heartbeat = (reportId, username, name) =>
  request(`/reports/${reportId}/presence`, {
    method: 'POST',
    body: JSON.stringify({ username, name }),
  });

// Try to take/renew a section lock. Resolves { ok, owner, locks } whether granted
// (200) or refused (409 — `owner` names who holds it), so the caller can flip the
// section to read-only immediately rather than waiting for the next heartbeat.
export const acquireLock = async (reportId, section, username, name) => {
  const { body } = await requestRaw(`/reports/${reportId}/lock`, {
    method: 'POST',
    body: JSON.stringify({ username, name, section }),
  });
  return body || { ok: false, owner: null, locks: {} };
};

export const releaseLock = (reportId, section, username) =>
  request(`/reports/${reportId}/lock`, {
    method: 'DELETE',
    body: JSON.stringify({ username, section }),
  });

// Best-effort "I'm leaving" so presence/locks free immediately (don't wait for TTL).
export const leaveReport = (reportId, username) =>
  request(`/reports/${reportId}/leave`, {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
