/**
 * CSV export utilities for the reporting dashboard.
 *
 * All exports are anonymized -- no employee PII is included.
 * CSV files include BOM prefix for Excel UTF-8 compatibility.
 */

import { IUtilizationData, IRawBookingRecord } from '../../models/IReport';

/** Pad number to two digits. */
function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

/** Get current date formatted as YYYY-MM-DD. */
function getDateStamp(): string {
  const d = new Date();
  return String(d.getFullYear()) + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/**
 * Escape a value for CSV output.
 * Handles commas, quotes, and newlines by wrapping in double quotes.
 */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // If value contains comma, double quote, or newline, wrap in quotes
  if (str.indexOf(',') >= 0 || str.indexOf('"') >= 0 || str.indexOf('\n') >= 0 || str.indexOf('\r') >= 0) {
    // Escape double quotes by doubling them
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Generate a CSV file and trigger browser download.
 * Includes UTF-8 BOM prefix for Excel compatibility.
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csvLines: string[] = [];

  // Header row
  csvLines.push(headers.map(function escapeHeader(h: string): string {
    return escapeCSV(h);
  }).join(','));

  // Data rows
  for (let i = 0; i < rows.length; i++) {
    csvLines.push(rows[i].map(function escapeCell(cell: string | number): string {
      return escapeCSV(cell);
    }).join(','));
  }

  const csvContent = csvLines.join('\r\n');

  // BOM prefix for Excel UTF-8 recognition
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up object URL
  URL.revokeObjectURL(url);
}

/**
 * Export location-level utilization summary to CSV.
 * Columns: Location, Vehicle Count, Booking Hours, Available Hours, Utilization Rate (%).
 */
export function exportSummaryCSV(data: IUtilizationData[]): void {
  const headers = ['Location', 'Vehicle Count', 'Booking Hours', 'Available Hours', 'Utilization Rate (%)'];
  const rows: (string | number)[][] = data.map(function mapRow(item: IUtilizationData): (string | number)[] {
    return [
      item.locationName,
      item.vehicleCount,
      Math.round(item.totalBookingHours * 100) / 100,
      Math.round(item.totalAvailableHours * 100) / 100,
      item.utilizationRate,
    ];
  });

  const filename = 'fleet-utilization-summary-' + getDateStamp() + '.csv';
  downloadCSV(filename, headers, rows);
}

/**
 * Export raw booking records to CSV (anonymized -- no employee data columns).
 * Columns: Booking ID, Vehicle (Make Model), License Plate, Location, Start Time, End Time, Duration (Hours), Status.
 */
export function exportRawDataCSV(data: IRawBookingRecord[]): void {
  const headers = ['Booking ID', 'Vehicle (Make Model)', 'License Plate', 'Location', 'Start Time', 'End Time', 'Duration (Hours)', 'Status'];
  const rows: (string | number)[][] = data.map(function mapRow(item: IRawBookingRecord): (string | number)[] {
    return [
      item.bookingId,
      item.vehicleMake + ' ' + item.vehicleModel,
      item.vehicleLicensePlate,
      item.locationName,
      item.startTime,
      item.endTime,
      Math.round(item.durationHours * 100) / 100,
      item.status,
    ];
  });

  const filename = 'booking-records-' + getDateStamp() + '.csv';
  downloadCSV(filename, headers, rows);
}
