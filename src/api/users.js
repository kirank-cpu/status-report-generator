// Client for the user/account + auth API (server/).

import { request } from './client';

// Returns the safe user record, or throws on bad credentials.
export const login = (username, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

// [{ username, name, role, squads, createdAt, modifiedAt }]
export const listUsers = () => request('/users');

export const createUser = (user) =>
  request('/users', { method: 'POST', body: JSON.stringify(user) });

export const updateUser = (originalUsername, user) =>
  request(`/users/${encodeURIComponent(originalUsername)}`, {
    method: 'PUT',
    body: JSON.stringify(user),
  });

export const deleteUser = (username) =>
  request(`/users/${encodeURIComponent(username)}`, { method: 'DELETE' });

// ── Self-service account actions ──────────────────────────────────────────

// Change password while signed in (verifies the current password).
export const changePassword = (username, currentPassword, newPassword) =>
  request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ username, currentPassword, newPassword }),
  });

// Set/clear the signed-in user's own email. Returns the updated safe user.
export const updateEmail = (username, email) =>
  request('/account/email', { method: 'PUT', body: JSON.stringify({ username, email }) });

// ── Forgot / reset (pre-login) ────────────────────────────────────────────

// Request a reset link. Always resolves with a generic message (no enumeration).
export const forgotPassword = (email) =>
  request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });

// Redeem a reset token from the emailed link and set a new password.
export const resetPassword = (token, newPassword) =>
  request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
