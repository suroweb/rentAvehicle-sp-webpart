/**
 * HTTP endpoints for admin reporting.
 *
 * 4 endpoints registered under backoffice/reports:
 * - GET backoffice/reports/kpi            (KPI summary: utilization, totals, overdue)
 * - GET backoffice/reports/utilization     (utilization by location or by vehicle)
 * - GET backoffice/reports/trends          (booking count/utilization trends)
 * - GET backoffice/reports/export          (summary or raw data for CSV export)
 *
 * All endpoints require Admin or SuperAdmin role.
 */
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';
import {
  getKpiSummary,
  getUtilizationByLocation,
  getUtilizationByVehicle,
  getBookingTrends,
  getRawBookingData,
} from '../services/reportingService.js';

const isAdmin = requireRole('Admin', 'SuperAdmin');

/**
 * Parse a query parameter as a valid Date. Returns null if missing or invalid.
 */
function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * GET /api/backoffice/reports/kpi
 * Top-level KPI summary: utilization rate, total bookings, active bookings, overdue count.
 * Query params: dateFrom (required), dateTo (required).
 */
async function getKpiReport(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAdmin(user)) {
      return { status: 403, jsonBody: { error: 'Admin or SuperAdmin role required' } };
    }

    const dateFrom = parseDateParam(request.query.get('dateFrom'));
    const dateTo = parseDateParam(request.query.get('dateTo'));

    if (!dateFrom || !dateTo) {
      return { status: 400, jsonBody: { error: 'dateFrom and dateTo query parameters are required and must be valid dates' } };
    }

    const kpi = await getKpiSummary(dateFrom, dateTo);
    return { jsonBody: kpi };
  } catch (error) {
    context.error('getKpiReport failed:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

/**
 * GET /api/backoffice/reports/utilization
 * Utilization rates by location (default) or by vehicle within a location (when locationId provided).
 * Query params: dateFrom (required), dateTo (required), locationId (optional).
 */
async function getUtilizationReport(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAdmin(user)) {
      return { status: 403, jsonBody: { error: 'Admin or SuperAdmin role required' } };
    }

    const dateFrom = parseDateParam(request.query.get('dateFrom'));
    const dateTo = parseDateParam(request.query.get('dateTo'));

    if (!dateFrom || !dateTo) {
      return { status: 400, jsonBody: { error: 'dateFrom and dateTo query parameters are required and must be valid dates' } };
    }

    const locationIdParam = request.query.get('locationId');
    if (locationIdParam) {
      const locationId = parseInt(locationIdParam, 10);
      if (isNaN(locationId)) {
        return { status: 400, jsonBody: { error: 'locationId must be a valid integer' } };
      }
      const data = await getUtilizationByVehicle(dateFrom, dateTo, locationId);
      return { jsonBody: data };
    }

    const data = await getUtilizationByLocation(dateFrom, dateTo);
    return { jsonBody: data };
  } catch (error) {
    context.error('getUtilizationReport failed:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

/**
 * GET /api/backoffice/reports/trends
 * Booking count and utilization trends grouped by daily or weekly periods.
 * Query params: dateFrom (required), dateTo (required), granularity ('daily'|'weekly', required),
 *               locationId (optional), categoryId (optional).
 */
async function getTrendsReport(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAdmin(user)) {
      return { status: 403, jsonBody: { error: 'Admin or SuperAdmin role required' } };
    }

    const dateFrom = parseDateParam(request.query.get('dateFrom'));
    const dateTo = parseDateParam(request.query.get('dateTo'));
    const granularity = request.query.get('granularity');

    if (!dateFrom || !dateTo) {
      return { status: 400, jsonBody: { error: 'dateFrom and dateTo query parameters are required and must be valid dates' } };
    }

    if (granularity !== 'daily' && granularity !== 'weekly') {
      return { status: 400, jsonBody: { error: "granularity must be 'daily' or 'weekly'" } };
    }

    let locationId: number | undefined;
    const locationIdParam = request.query.get('locationId');
    if (locationIdParam) {
      locationId = parseInt(locationIdParam, 10);
      if (isNaN(locationId)) {
        return { status: 400, jsonBody: { error: 'locationId must be a valid integer' } };
      }
    }

    let categoryId: number | undefined;
    const categoryIdParam = request.query.get('categoryId');
    if (categoryIdParam) {
      categoryId = parseInt(categoryIdParam, 10);
      if (isNaN(categoryId)) {
        return { status: 400, jsonBody: { error: 'categoryId must be a valid integer' } };
      }
    }

    const data = await getBookingTrends(dateFrom, dateTo, granularity, locationId, categoryId);
    return { jsonBody: data };
  } catch (error) {
    context.error('getTrendsReport failed:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

/**
 * GET /api/backoffice/reports/export
 * Export report data as JSON for frontend CSV generation.
 * Query params: dateFrom (required), dateTo (required), type ('summary'|'raw', required).
 * - summary: returns utilization by location (same as utilization endpoint with no locationId)
 * - raw: returns anonymized raw booking data (no employee PII)
 */
async function getExportReport(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAdmin(user)) {
      return { status: 403, jsonBody: { error: 'Admin or SuperAdmin role required' } };
    }

    const dateFrom = parseDateParam(request.query.get('dateFrom'));
    const dateTo = parseDateParam(request.query.get('dateTo'));
    const exportType = request.query.get('type');

    if (!dateFrom || !dateTo) {
      return { status: 400, jsonBody: { error: 'dateFrom and dateTo query parameters are required and must be valid dates' } };
    }

    if (exportType !== 'summary' && exportType !== 'raw') {
      return { status: 400, jsonBody: { error: "type must be 'summary' or 'raw'" } };
    }

    if (exportType === 'summary') {
      const data = await getUtilizationByLocation(dateFrom, dateTo);
      return { jsonBody: data };
    }

    // type === 'raw'
    const data = await getRawBookingData(dateFrom, dateTo);
    return { jsonBody: data };
  } catch (error) {
    context.error('getExportReport failed:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

// Register admin reporting endpoints
app.http('getKpiReport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/reports/kpi',
  handler: getKpiReport,
});

app.http('getUtilizationReport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/reports/utilization',
  handler: getUtilizationReport,
});

app.http('getTrendsReport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/reports/trends',
  handler: getTrendsReport,
});

app.http('getExportReport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/reports/export',
  handler: getExportReport,
});
