'use strict';

// Single source of truth for Overpass server configuration
const OVERPASS_SERVERS = [
  {
    name: 'Main Overpass API',
    url: 'https://overpass-api.de/api/interpreter',
    description: 'Official Overpass API server (default)'
  },
  {
    name: 'Z-Level Overpass',
    url: 'https://z.overpass-api.de/api/interpreter',
    description: 'Z-Level Overpass server (lighter load)'
  },
  {
    name: 'LZ4 Overpass',
    url: 'https://lz4.overpass-api.de/api/interpreter',
    description: 'LZ4 compressed Overpass server'
  }
];

// Get server configuration from environment or default
function getOverpassConfig() {
  const serverIndex = parseInt(process.env.OVERPASS_SERVER_INDEX) || 0;
  const customUrl = process.env.OVERPASS_URL;
  
  if (customUrl) {
    return {
      name: 'Custom Server',
      url: customUrl,
      description: `Custom server: ${customUrl}`
    };
  }
  
  return OVERPASS_SERVERS[serverIndex] || OVERPASS_SERVERS[0];
}

let currentServerIndex = 0;

// Get next available server (for failover)
function getNextOverpassServer() {
  currentServerIndex = (currentServerIndex + 1) % OVERPASS_SERVERS.length;
  const server = OVERPASS_SERVERS[currentServerIndex];
  console.log(`🔄 Switching to Overpass server: ${server.name} (${server.url})`);
  return server;
}

module.exports = {
  OVERPASS_SERVERS,
  getOverpassConfig,
  getNextOverpassServer
};