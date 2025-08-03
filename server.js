import express from 'express';

export default async function buildRouter(routes = {}, middlewares = {}) {
  const router = express.Router();
  
  await Promise.all(
    Object.entries(middlewares).map(async ([path, file]) => {
      try {
        const mod = await import(/* @vite-ignore */ file);

        if (typeof mod.Middleware !== 'function') {
          console.error(`Middleware handler not found in ${file}`);
          return;
        }

        router.use(path, (req, res, next) => {
          try {
            mod.Middleware(req, res, next);
          } catch (err) {
            console.error(`Error in middleware ${path}:`, err);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Internal Server Error in middleware' });
            }
          }
        });
      } catch (err) {
        console.error('Error importing middleware', path, file, err);
      }
    })
  );

  await Promise.all(
    Object.entries(routes).map(async ([path, file]) => {
      try {
        const mod = await import(/* @vite-ignore */ file);

        router.all(path, async (req, res) => {
          try {
            if (typeof mod.Rest !== 'function') throw new Error(`Rest handler not found in ${file}`);
            
            const result = await mod.Rest(req, res);
            if (result && !res.headersSent) res.json(result);
          } catch (err) {
            console.error(`Error in route ${path}:`, err);
            if (!res.headersSent) {
              res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
            }
          }
        });
      } catch (err) {
        console.error('Error importing route', path, file, err);
      }
    })
  );

  router.use('*', (req, res) => {
    res.status(404).json({ error: true, message: `API route not found: ${req.originalUrl}` });
  });

  return { router, express };
}
