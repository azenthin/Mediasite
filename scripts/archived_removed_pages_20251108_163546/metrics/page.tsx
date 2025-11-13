'use client';

import React, { useEffect, useState } from 'react';

type Row = {
  id: string;
  createdAt: string;
  sessionId: string;
  userId?: string | null;
  mediaId?: string | null;
  eventType: string;
};

export default function MetricsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/metrics');
        if (!res.ok) throw new Error('Failed to load metrics');
        const data = await res.json();
        setRows(data.rows || []);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    fetchData();
  }, []);

  if (error) {
    return <div className="p-6 text-red-400">{error}</div>;
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-semibold mb-4">Metrics (latest 200 events)</h1>
      <div className="text-sm text-gray-300 mb-4">For tuning only; not production.</div>
      <div className="overflow-auto border border-white/10 rounded-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Media</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="odd:bg-white/0 even:bg-white/[0.03]">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{r.eventType}</td>
                <td className="px-3 py-2">{r.sessionId.slice(0, 12)}…</td>
                <td className="px-3 py-2">{r.userId || '-'}</td>
                <td className="px-3 py-2">{r.mediaId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


