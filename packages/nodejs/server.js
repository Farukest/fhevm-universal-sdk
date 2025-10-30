import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Serve static files from dist directory
app.use(express.static(join(__dirname, 'dist')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Node.js FHEVM Demo Server' });
});

app.listen(PORT, () => {
  console.log(`\nNode.js FHEVM Demo Server running at http://localhost:${PORT}\n`);
});
