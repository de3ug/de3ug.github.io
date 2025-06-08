const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const root = path.join(__dirname, 'site');
const port = 8123;

function findBrowser() {
  const candidates = ['chromium-browser', 'chromium', 'google-chrome'];
  for (const c of candidates) {
    try {
      execSync(`command -v ${c}`, { stdio: 'ignore' });
      return c;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

const browser = findBrowser();
if (!browser) {
  console.log('No headless browser found, skipping smoke test');
  process.exit(0);
}

const server = http.createServer((req, res) => {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(root, reqPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(404);
    return res.end();
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end();
    }
    if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html');
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    res.end(data);
  });
});

server.listen(port, () => {
  const chrome = spawn(browser, [
    '--headless',
    '--no-sandbox',
    '--dump-dom',
    `http://localhost:${port}/`,
  ]);
  let stderr = '';
  const timeout = setTimeout(() => {
    chrome.kill('SIGKILL');
  }, 10000);
  chrome.stderr.on('data', d => {
    stderr += d.toString();
  });
  chrome.on('close', () => {
    clearTimeout(timeout);
    server.close(() => {
      if (/Uncaught|Error/i.test(stderr)) {
        console.error(stderr);
        process.exit(1);
      } else {
        console.log('Smoke test passed');
      }
    });
  });
});
