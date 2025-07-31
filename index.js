import express from 'express';
import path from 'path';
//import buildRouter from './dist/server.js';

async function bootstrap() {
  const app = express();
  app.use(express.json());

  //const apiRouter = await buildRouter();
  //app.use('/api', apiRouter);

  app.use(express.static(path.join(__dirname,'client')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap()