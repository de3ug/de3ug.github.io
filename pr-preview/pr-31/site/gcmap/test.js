const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let fullCode = fs.readFileSync(__dirname + '/main.js', 'utf8');
const lines = fullCode.split('\n');
if (lines[0].startsWith('let airportData')) lines.shift();
fullCode = lines.join('\n');
const code = 'let airportData = globalThis.airportData;\n' + fullCode.split('setup();')[0];

const sandbox = {
  console,
  setTimeout,
  document: { createElement: () => ({ style: {}, remove() {} }), body: { appendChild() {} } }
};
sandbox.globalThis = sandbox;
sandbox.airportData = {
  SFO: { lat: 37.6188056, lon: -122.3754167 },
  LAX: { lat: 33.9425, lon: -118.408056 },
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const route = sandbox.parseRoute('SFO-LAX');
assert(Array.isArray(route), 'parseRoute returns an array');
assert(route.length === 2, 'SFO-LAX should produce two airport points');

const color = sandbox.jetColor(0.5);
assert(/^rgb\(\d+,\d+,\d+\)$/.test(color), 'jetColor returns rgb string');

console.log('All tests passed.');
