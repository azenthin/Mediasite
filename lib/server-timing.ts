// Lightweight helper for Server-Timing headers and perf logging
import { performance } from 'node:perf_hooks';

type Mark = { name: string; start: number; duration?: number };

export class ServerTimer {
  private marks: Mark[] = [];
  private startTime = performance.now();

  start(name: string) {
    this.marks.push({ name, start: performance.now() });
  }

  end(name: string) {
    const mark = [...this.marks].reverse().find((m) => m.name === name && m.duration === undefined);
    if (mark) {
      mark.duration = performance.now() - mark.start;
    }
  }

  measure(name: string, fn: () => Promise<any>) {
    this.start(name);
    return fn().finally(() => this.end(name));
  }

  header(): string {
    // Include total
    const total = performance.now() - this.startTime;
    const parts: string[] = [
      `total;dur=${total.toFixed(1)}`,
      ...this.marks
        .filter((m) => typeof m.duration === 'number')
        .map((m) => `${sanitize(m.name)};dur=${(m.duration || 0).toFixed(1)}`),
    ];
    return parts.join(', ');
  }

  elapsed(): number {
    return performance.now() - this.startTime;
  }
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'step';
}

export function withServerTiming<T>(headers: Headers | undefined, timer: ServerTimer): Headers {
  const h = new Headers(headers);
  h.set('Server-Timing', timer.header());
  return h;
}

export default ServerTimer;
