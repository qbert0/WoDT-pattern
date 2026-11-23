import { describe, expect, it } from 'vitest';
import {
  getTwinStatus,
  getTwinMetrics,
  formatMetric,
} from './twinPresentation';

const now = Date.parse('2026-11-12T03:00:00Z');
describe('twin presentation from device data', () => {
  it('uses a reported offline status even when telemetry is fresh', () => {
    expect(
      getTwinStatus(
        {
          _modified: new Date(now).toISOString(),
          features: { ConnectionStatus: { properties: { status: 'OFFLINE' } } },
        },
        now,
      ),
    ).toBe('offline');
  });
  it('does not present an unrecognised device status as online', () => {
    expect(
      getTwinStatus(
        {
          _modified: new Date(now).toISOString(),
          features: {
            ConnectionStatus: { properties: { status: 'starting' } },
          },
        },
        now,
      ),
    ).toBe('unknown');
  });
  it('uses a five-minute freshness window when a device does not report status', () => {
    expect(
      getTwinStatus({ _modified: new Date(now - 299_000).toISOString() }, now),
    ).toBe('online');
    expect(
      getTwinStatus({ _modified: new Date(now - 300_000).toISOString() }, now),
    ).toBe('offline');
  });
  it('keeps missing, invalid and implausible future timestamps unknown', () => {
    for (const timestamp of [
      undefined,
      'invalid',
      new Date(now + 3_600_000).toISOString(),
    ]) {
      expect(getTwinStatus({ _modified: timestamp }, now)).toBe('unknown');
    }
  });
  it('preserves zero readings and distinguishes missing readings', () => {
    const metrics = getTwinMetrics({
      features: { water: { properties: { temperature: 0 } } },
    });
    expect(formatMetric(metrics[0].value)).toBe('0');
    expect(formatMetric(metrics[1].value)).toBe('—');
    expect(metrics[1].unit).toBe('%');
  });
  it('shows grinder telemetry and real composition membership', () => {
    const grinder = getTwinMetrics({
      features: {
        beans: { properties: { beanAmount: 42 } },
        grinder: { properties: { grindDurationSeconds: 8 } },
      },
    });
    expect(grinder.map((metric) => metric.value)).toEqual([42, 8]);
    const system = getTwinMetrics({
      features: {
        components: { properties: { thingIds: ['a:kettle', 'a:grinder'] } },
      },
    });
    expect(system[0].value).toBe(2);
  });
  it('handles arbitrary numeric features without inventing units', () => {
    const metrics = getTwinMetrics({
      features: {
        motor: { properties: { rpm: 800, label: 'motor', active: true } },
      },
    });
    expect(metrics).toEqual([{ label: 'motor / rpm', value: 800 }]);
  });
});
