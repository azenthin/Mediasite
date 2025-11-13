/*
  GET /api/ingest/status — Exposes ingestion pipeline metrics and status.
  
  Returns:
  {
    success: true,
    timestamp: ISO-string,
    metrics: {
      processed_count: number,
      accepted_count: number,
      queued_count: number,
      skipped_count: number,
      error_count: number,
      by_reason: { reason: count, ... },
      acceptance_rate: percentage,
      skip_rate: percentage,
    },
    alerts: [ { level, message, threshold } ],
    staging_records: number,
    last_updated: ISO-string,
  }
*/

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Load metrics from scripts/ingest/metrics.json
    const metricsFile = path.join(process.cwd(), 'scripts', 'ingest', 'metrics.json');
    const metricsData = fs.existsSync(metricsFile)
      ? JSON.parse(fs.readFileSync(metricsFile, 'utf8'))
      : { processed: 0, accepted: 0, queued: 0, skipped: 0, errors: 0, byReason: {} };

    // Load staging records count
    const stagingFile = path.join(process.cwd(), 'scripts', 'ingest', 'staging-db.json');
    let stagingRecords = 0;
    let lastUpdated = null;
    if (fs.existsSync(stagingFile)) {
      const staging = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));
      stagingRecords = (staging.records || []).length;
      lastUpdated = staging.lastUpdated || staging.generatedAt;
    }

    // Load alerts if available
    const alertsFile = path.join(process.cwd(), 'scripts', 'ingest', 'alerts.json');
    let alerts = [];
    if (fs.existsSync(alertsFile)) {
      const alertsData = JSON.parse(fs.readFileSync(alertsFile, 'utf8'));
      alerts = alertsData.alerts || [];
    }

    // Calculate rates
    const acceptanceRate = metricsData.processed > 0
      ? Math.round((metricsData.accepted / metricsData.processed) * 100)
      : 0;
    const skipRate = metricsData.processed > 0
      ? Math.round((metricsData.skipped / metricsData.processed) * 100)
      : 0;

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        processed_count: metricsData.processed,
        accepted_count: metricsData.accepted,
        queued_count: metricsData.queued,
        skipped_count: metricsData.skipped,
        error_count: metricsData.errors,
        by_reason: metricsData.byReason || {},
        acceptance_rate: `${acceptanceRate}%`,
        skip_rate: `${skipRate}%`,
      },
      alerts,
      staging_records: stagingRecords,
      last_updated: lastUpdated || new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching ingestion status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ingestion status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
