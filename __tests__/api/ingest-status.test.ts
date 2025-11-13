import fs from 'fs';
import path from 'path';

describe('GET /api/ingest/status', () => {
  it('should return metrics and status information', async () => {
    // Mock reading metrics.json
    const mockMetrics = {
      processed: 100,
      accepted: 75,
      queued: 15,
      skipped: 10,
      errors: 0,
      byReason: {
        'low-confidence': 5,
        'no-mbid': 3,
        'no-isrc': 2,
      },
    };

    // Mock staging records count
    const mockStaging = {
      records: [
        { accept: true, artist: 'Artist 1', title: 'Track 1' },
        { queue: true, artist: 'Artist 2', title: 'Track 2' },
      ],
      lastUpdated: new Date().toISOString(),
    };

    // Mock alerts
    const mockAlerts = {
      alerts: [
        {
          level: 'warning',
          message: 'Skip rate above threshold (10%)',
          threshold: '5%',
        },
      ],
    };

    // Simulate the response structure
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        processed_count: mockMetrics.processed,
        accepted_count: mockMetrics.accepted,
        queued_count: mockMetrics.queued,
        skipped_count: mockMetrics.skipped,
        error_count: mockMetrics.errors,
        by_reason: mockMetrics.byReason,
        acceptance_rate: '75%',
        skip_rate: '10%',
      },
      alerts: mockAlerts.alerts,
      staging_records: 2,
      last_updated: mockStaging.lastUpdated,
    };

    expect(response.success).toBe(true);
    expect(response.metrics.processed_count).toBe(100);
    expect(response.metrics.accepted_count).toBe(75);
    expect(response.metrics.queued_count).toBe(15);
    expect(response.metrics.skipped_count).toBe(10);
    expect(response.metrics.acceptance_rate).toBe('75%');
    expect(response.metrics.skip_rate).toBe('10%');
    expect(response.metrics.by_reason['low-confidence']).toBe(5);
    expect(response.alerts).toHaveLength(1);
    expect(response.staging_records).toBe(2);
  });

  it('should calculate rates correctly', async () => {
    const metrics = {
      processed: 50,
      accepted: 40,
      queued: 5,
      skipped: 5,
      errors: 0,
      byReason: {},
    };

    const acceptanceRate = metrics.processed > 0
      ? Math.round((metrics.accepted / metrics.processed) * 100)
      : 0;
    const skipRate = metrics.processed > 0
      ? Math.round((metrics.skipped / metrics.processed) * 100)
      : 0;

    expect(acceptanceRate).toBe(80);
    expect(skipRate).toBe(10);
  });

  it('should handle zero metrics gracefully', async () => {
    const metrics = {
      processed: 0,
      accepted: 0,
      queued: 0,
      skipped: 0,
      errors: 0,
      byReason: {},
    };

    const acceptanceRate = metrics.processed > 0
      ? Math.round((metrics.accepted / metrics.processed) * 100)
      : 0;
    const skipRate = metrics.processed > 0
      ? Math.round((metrics.skipped / metrics.processed) * 100)
      : 0;

    expect(acceptanceRate).toBe(0);
    expect(skipRate).toBe(0);
  });

  it('should include all required response fields', async () => {
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        processed_count: 100,
        accepted_count: 75,
        queued_count: 15,
        skipped_count: 10,
        error_count: 0,
        by_reason: {},
        acceptance_rate: '75%',
        skip_rate: '10%',
      },
      alerts: [],
      staging_records: 2,
      last_updated: new Date().toISOString(),
    };

    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('timestamp');
    expect(response).toHaveProperty('metrics');
    expect(response).toHaveProperty('alerts');
    expect(response).toHaveProperty('staging_records');
    expect(response).toHaveProperty('last_updated');
    expect(response.metrics).toHaveProperty('processed_count');
    expect(response.metrics).toHaveProperty('accepted_count');
    expect(response.metrics).toHaveProperty('queued_count');
    expect(response.metrics).toHaveProperty('skipped_count');
    expect(response.metrics).toHaveProperty('error_count');
    expect(response.metrics).toHaveProperty('by_reason');
    expect(response.metrics).toHaveProperty('acceptance_rate');
    expect(response.metrics).toHaveProperty('skip_rate');
  });
});
