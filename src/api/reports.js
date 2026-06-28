// Client for the MSR archive API (server/).

import { request } from './client';

// Metadata only: [{ id, month, title, createdAt, modifiedAt }], newest first.
export const listReports = () => request('/reports');

// Full report: { id, month, title, data, createdAt, modifiedAt }.
export const getReport = (id) => request(`/reports/${id}`);

export const createReport = (data) =>
  request('/reports', { method: 'POST', body: JSON.stringify({ data }) });

export const updateReport = (id, data) =>
  request(`/reports/${id}`, { method: 'PUT', body: JSON.stringify({ data }) });

export const deleteReport = (id) => request(`/reports/${id}`, { method: 'DELETE' });

export const duplicateReport = (id) =>
  request(`/reports/${id}/duplicate`, { method: 'POST' });
