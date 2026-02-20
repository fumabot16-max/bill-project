const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8003;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// Check if setup is needed (vault.json has all zeros or doesn't exist)
function needsSetup() {
  try {
    const vaultPath = path.join(__dirname, 'vault.json');
    if (!fs.existsSync(vaultPath)) return true;
    
    const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
    const balances = ['openai', 'claude', 'kimi', 'deepseek', 'grok'];
    return balances.every(key => !vault[key] || vault[key] === 0);
  } catch (e) {
    return true;
  }
}

// Main billing page (redirect to setup if needed)
app.get('/', (req, res) => {
  if (needsSetup()) {
    return res.redirect('/setup');
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Setup page
app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// API: Save setup
app.post('/api/setup', (req, res) => {
  try {
    const vaultPath = path.join(__dirname, 'vault.json');
    const data = {
      openai: parseFloat(req.body.openai) || 0,
      claude: parseFloat(req.body.claude) || 0,
      kimi: parseFloat(req.body.kimi) || 0,
      deepseek: parseFloat(req.body.deepseek) || 0,
      grok: parseFloat(req.body.grok) || 0,
      gemini: 0
    };
    
    fs.writeFileSync(vaultPath, JSON.stringify(data, null, 2));
    res.json({ status: 'success', message: 'Configuration saved' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// API endpoint for usage data
app.get('/api/usage', (req, res) => {
  try {
    const usageData = JSON.parse(fs.readFileSync(path.join(__dirname, 'dist', 'usage.json'), 'utf8'));
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: usageData
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: 'Usage data not available',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'ai-bill',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Direct file paths
app.get('/usage.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'usage.json'));
});

// Redirect from old path
app.get('/usage_live.json', (req, res) => {
  res.redirect('/usage.json?' + Date.now());
});

app.listen(PORT, () => {
  console.log(`AI Billing System running on port ${PORT}.`);
  if (needsSetup()) {
    console.log('⚠️  First time setup required. Visit http://localhost:8003/setup');
  }
});
