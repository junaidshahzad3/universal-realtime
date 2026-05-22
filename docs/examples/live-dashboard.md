# Example: Live Metrics Dashboard

A real-time analytics dashboard using Server-Sent Events (`useSSE`) to stream live system metrics.

```tsx
import React from 'react';
import { useSSE } from 'use-realtime';

interface DashboardMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeRequests: number;
  errorRate: number;
}

export const LiveDashboard = () => {
  // Connect to SSE stream for live metrics
  const { data: metrics, connectionStatus, error } = useSSE<DashboardMetrics>(
    'https://api.example.com/metrics/stream',
    {
      eventName: 'metrics', // Custom SSE event name
      reconnect: true,
    }
  );

  if (connectionStatus === 'connecting') {
    return <div>Connecting to live analytics stream...</div>;
  }

  if (error) {
    return <div className="error">Failed to receive live metrics. Reconnecting...</div>;
  }

  return (
    <div className="dashboard">
      <header>
        <h2>System Status Dashboard</h2>
        <span className={`badge ${connectionStatus}`}>
          {connectionStatus.toUpperCase()}
        </span>
      </header>

      {metrics && (
        <div className="metrics-grid">
          <div className="card">
            <h3>CPU Usage</h3>
            <div className="value">{metrics.cpuUsage}%</div>
            <div className="bar" style={{ width: `${metrics.cpuUsage}%` }} />
          </div>

          <div className="card">
            <h3>Memory Usage</h3>
            <div className="value">{metrics.memoryUsage}%</div>
            <div className="bar" style={{ width: `${metrics.memoryUsage}%` }} />
          </div>

          <div className="card">
            <h3>Active Requests</h3>
            <div className="value">{metrics.activeRequests}/sec</div>
          </div>

          <div className="card">
            <h3>Error Rate</h3>
            <div className={`value ${metrics.errorRate > 1 ? 'critical' : 'normal'}`}>
              {metrics.errorRate}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```
