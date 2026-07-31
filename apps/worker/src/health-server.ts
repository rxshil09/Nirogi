import http from 'http';

export function startWorkerHealthServer(getWorkerStatus: () => { isRunning: boolean }) {
  const port = Number(process.env.HEALTH_PORT) || Number(process.env.PORT) || 4001;

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/v1/health' || req.url === '/') {
      const status = getWorkerStatus();
      const statusCode = status.isRunning ? 200 : 503;

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          service: 'nirogi-worker',
          status: status.isRunning ? 'ok' : 'unhealthy',
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.listen(port, '0.0.0.0', () => {
    process.stdout.write(`[worker-health] Health check server listening on http://0.0.0.0:${port}/health\n`);
  });

  return server;
}
