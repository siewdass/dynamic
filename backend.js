import { Router } from 'express';

export default async function buildRouter(manifest) {
  const router = Router();

  for (const route of await manifest.routes) {
    try {
      const mod = await import(/* @vite-ignore */ route);
      const routePath = route
        .replace(/^\.{0,2}\/src/, '')
        .replace(/(?:\/index)?\.(js|ts)$/, '')
        .replace(/\[([^\]]+)]/g, ':$1')
        .replace(/\/+$/, '')
        .replace('index', '')
        .toLowerCase() || '/';

      router.all(routePath, async (req, res) => {
        try {
          const result = await mod.Request(req, res);
          if (result) res.json(result);
        } catch (err) {
          res.status(err.status || 500).json({ error: err.message || 'Error' });
        }
      });
    } catch (err) {
      console.error('Error importing', route, err);
    }
  }

  router.use('*', (req, res) => {
    res.status(404).json({ error: true, message: `API route not found: ${req.originalUrl}` });
  });

  return router;
}
