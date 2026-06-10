import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { nowPlayingRouter } from './routes/now-playing.js';
import { setupRouter } from './routes/setup.js';
import { healthRouter } from './routes/health.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(cors());
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api', nowPlayingRouter);
app.use('/api', setupRouter);

app.listen(PORT, () => {
  console.log(`rpc-bridge server running on port ${PORT}`);
});
