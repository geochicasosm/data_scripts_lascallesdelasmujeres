#!/usr/bin/env node
'use strict';

// Import server configuration (single source of truth)
const { OVERPASS_SERVERS } = require('./overpass-servers');

console.log('📡 Available Overpass API servers:\n');

OVERPASS_SERVERS.forEach((server, index) => {
  console.log(`${index}: ${server.name}`);
  console.log(`   URL: ${server.url}`);
  console.log(`   ${server.description}\n`);
});

console.log('Usage examples:');
console.log('  # Use default server (0)');
console.log('  npm run initial-step -- --city=madrid --relation=347950');
console.log('');
console.log('  # Use Z-Level server (1)');
console.log('  npm run initial-step -- --city=madrid --relation=347950 --server=1');
console.log('');
console.log('  # Use LYR server (2)');
console.log('  npm run initial-step -- --city=madrid --relation=347950 --server=2');
console.log('');
console.log('  # Use custom server via environment variable');
console.log('  OVERPASS_URL=https://custom-server.com/api/interpreter npm run initial-step -- --city=madrid --relation=347950');
console.log('');
console.log('  # Use server with just command');
console.log('  just download_data madrid 347950  # uses default server');
console.log('  OVERPASS_SERVER_INDEX=1 just download_data madrid 347950  # uses Z-Level server');
console.log('  OVERPASS_SERVER_INDEX=2 just download_data madrid 347950  # uses LYR server');