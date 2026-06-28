// Client for the MSR archive API (server/).

import { request } from './client';

// Metadata only: [{ id, month, title, createdAt, modifiedAt, modifiedBy, modifiedByName }].
export const listReports = () => request('/reports');

// Full report: { id, month, title, data, createdAt, modifiedAt, modifiedBy, modifiedByName }.
export const getReport = (id) => request(`/reports/${id}`);

export const createReport = (data, modifiedBy) =>
  request('/reports', { method: 'POST', body: JSON.stringify({ data, modifiedBy }) });

export const updateReport = (id, data, modifiedBy) =>
  request(`/reports/${id}`, { method: 'PUT', body: JSON.stringify({ data, modifiedBy }) });

// Section-scoped save: merge `patch` into one squad (by id) without touching the
// rest of the document. Lets collaborators edit different sections concurrently.
export const patchSquad = (id, squadId, patch, modifiedBy) =>
  request(`/reports/${id}/squad/${squadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ patch, modifiedBy }),
  });

// Structure-scoped save (Report Settings): team/project/squad shape + report meta.
export const patchStructure = (id, report, teams, modifiedBy) =>
  request(`/reports/${id}/structure`, {
    method: 'PATCH',
    body: JSON.stringify({ report, teams, modifiedBy }),
  });

export const deleteReport = (id) => request(`/reports/${id}`, { method: 'DELETE' });

export const duplicateReport = (id) =>
  request(`/reports/${id}/duplicate`, { method: 'POST' });
