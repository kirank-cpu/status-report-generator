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
