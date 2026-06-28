// Client for the central organisation structure (server/).

import { request } from './client';

// Returns { teams: [...], modifiedAt }.
export const getOrganisation = () => request('/organisation');

export const saveOrganisation = (data) =>
  request('/organisation', { method: 'PUT', body: JSON.stringify({ data }) });
