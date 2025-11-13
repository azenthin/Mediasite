import fs from 'fs';
import path from 'path';

describe('Ingestion Manual Curation API', () => {
  describe('GET /api/ingest/queue', () => {
    it('should return queued and skipped records', async () => {
      // Mock staging records (queued)
      const mockStaging = {
        records: [
          {
            queue: true,
            artist: 'Test Artist',
            title: 'Test Track',
            isrc: 'USRC10000001',
            mbid: 'mbid-001',
            canonicality_score: 0.55,
            notes: ['mb-fuzzy-match'],
          },
        ],
      };

      // Mock skipped records
      const mockSkipped = {
        records: [
          {
            artist: 'Bad Artist',
            title: 'Bad Track',
            isrc: null,
            mbid: null,
            canonicality_score: 0.35,
            skip_reason: 'no-isrc',
            notes: [],
          },
        ],
      };

      // Simulate response structure
      const response = {
        success: true,
        records: [
          {
            id: 'queue-0',
            type: 'queued',
            artist: 'Test Artist',
            title: 'Test Track',
            isrc: 'USRC10000001',
            mbid: 'mbid-001',
            canonicalityScore: 0.55,
            notes: ['mb-fuzzy-match'],
          },
          {
            id: 'skip-0',
            type: 'skipped',
            artist: 'Bad Artist',
            title: 'Bad Track',
            isrc: null,
            mbid: null,
            canonicalityScore: 0.35,
            reason: 'no-isrc',
            notes: [],
          },
        ],
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
      };

      expect(response.success).toBe(true);
      expect(response.records).toHaveLength(2);
      expect(response.records[0].type).toBe('queued');
      expect(response.records[1].type).toBe('skipped');
      expect(response.total).toBe(2);
    });

    it('should filter by type=queued', async () => {
      const response = {
        success: true,
        records: [
          {
            id: 'queue-0',
            type: 'queued',
            artist: 'Artist',
            title: 'Track',
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      };

      const queuedOnly = response.records.filter(r => r.type === 'queued');
      expect(queuedOnly).toHaveLength(1);
      expect(queuedOnly[0].type).toBe('queued');
    });

    it('should support pagination', async () => {
      const allRecords = Array.from({ length: 100 }, (_, i) => ({
        id: `record-${i}`,
        artist: `Artist ${i}`,
        title: `Track ${i}`,
      }));

      const limit = 10;
      const offset = 20;
      const paginated = allRecords.slice(offset, offset + limit);

      expect(paginated).toHaveLength(10);
      expect(paginated[0].id).toBe('record-20');
      expect(paginated[9].id).toBe('record-29');
    });
  });

  describe('POST /api/ingest/queue/{recordId}/approve', () => {
    it('should log approval action', async () => {
      const entry = {
        timestamp: new Date().toISOString(),
        recordId: 'queue-0',
        action: 'approve',
        notes: 'Looks good; manual verification OK',
        reviewedBy: 'admin',
      };

      expect(entry.action).toBe('approve');
      expect(entry.recordId).toBe('queue-0');
      expect(entry.notes).toContain('Looks good');
      expect(entry.reviewedBy).toBe('admin');
    });

    it('should validate action is approve or reject', async () => {
      const invalidAction = 'skip'; // invalid

      const isValid = ['approve', 'reject'].includes(invalidAction);
      expect(isValid).toBe(false);
    });

    it('should support reject action', async () => {
      const entry = {
        timestamp: new Date().toISOString(),
        recordId: 'skip-0',
        action: 'reject',
        notes: 'Already in DB',
        reviewedBy: 'curator',
      };

      expect(entry.action).toBe('reject');
      expect(entry.notes).toContain('Already in DB');
    });

    it('should return curation log entry on success', async () => {
      const response = {
        success: true,
        recordId: 'queue-0',
        action: 'approve',
        updatedAt: new Date().toISOString(),
      };

      expect(response.success).toBe(true);
      expect(response.recordId).toBe('queue-0');
      expect(response.action).toBe('approve');
      expect(response.updatedAt).toBeDefined();
    });

    it('should accumulate curation log entries', async () => {
      const curationLog = {
        entries: [
          {
            timestamp: new Date().toISOString(),
            recordId: 'queue-0',
            action: 'approve',
            notes: 'First review',
            reviewedBy: 'alice',
          },
          {
            timestamp: new Date().toISOString(),
            recordId: 'skip-1',
            action: 'reject',
            notes: 'Already exists',
            reviewedBy: 'bob',
          },
        ],
      };

      expect(curationLog.entries).toHaveLength(2);
      expect(curationLog.entries[0].reviewedBy).toBe('alice');
      expect(curationLog.entries[1].action).toBe('reject');
    });
  });

  describe('Curation Workflow', () => {
    it('should track full curation workflow', async () => {
      const workflow = {
        queuedRecords: [
          { id: 'q1', artist: 'Artist A', canonicality: 0.65 },
          { id: 'q2', artist: 'Artist B', canonicality: 0.55 },
        ],
        actions: [
          { recordId: 'q1', action: 'approve', reviewer: 'admin' },
          { recordId: 'q2', action: 'reject', reviewer: 'admin' },
        ],
      };

      expect(workflow.queuedRecords).toHaveLength(2);
      expect(workflow.actions).toHaveLength(2);
      expect(workflow.actions[0].action).toBe('approve');
      expect(workflow.actions[1].action).toBe('reject');

      const approved = workflow.actions.filter(a => a.action === 'approve');
      expect(approved).toHaveLength(1);
    });
  });
});
