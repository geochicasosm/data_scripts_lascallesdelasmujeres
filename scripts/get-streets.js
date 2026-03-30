'use strict';

const path = require('path');

const overpass = require('query-overpass');
const booleanContains = require('@turf/boolean-contains').default;
const flatten = require('@turf/flatten').default;
const bbox = require('@turf/bbox').default;
const bboxPolygon = require('@turf/bbox-polygon').default;
const centerOfMass = require('@turf/center-of-mass').default;

const bboxSplit = require('boundingbox-split');
const simplify = require('@turf/simplify').default;
const area = require('@turf/area').default;
const fs = require('fs');

const writeFeatures = require('./commons').writeFeatures;

// Import Overpass server configuration (single source of truth)
const { getOverpassConfig, getNextOverpassServer } = require('./overpass-servers');

// Cache management utilities
function checkFileExists(filePath, minSizeBytes = 100) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size >= minSizeBytes;
  } catch {
    return false;
  }
}

function loadCachedGeoJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    return data.features || data; // Handle both FeatureCollection and Feature array formats
  } catch (error) {
    console.log(`❌ Failed to load cached file ${filePath}:`, error.message);
    return null;
  }
}

function getCacheStatus(city) {
  const dataDir = path.join(process.cwd(), 'data', city);
  const boundaryFile = path.join(dataDir, `${city}_boundary.geojson`);
  const streetsFile = path.join(dataDir, `${city}_streets.geojson`);
  const listFile = path.join(dataDir, 'list.csv');
  const genderizeFile = path.join(dataDir, 'list_genderize.csv');
  
  return {
    boundary: checkFileExists(boundaryFile, 500),  // Boundary should be decent size
    streets: checkFileExists(streetsFile, 1000),   // Streets file should be substantial
    list: checkFileExists(listFile, 100),          // Basic CSV
    genderize: checkFileExists(genderizeFile, 200), // Genderized CSV
    files: {
      boundary: boundaryFile,
      streets: streetsFile, 
      list: listFile,
      genderize: genderizeFile
    }
  };
}

// Grid-level caching utilities
function getGridCacheFile(city, gridIndex) {
  const dataDir = path.join(process.cwd(), 'data', city);
  return path.join(dataDir, `grid_${gridIndex}.geojson`);
}

function loadCachedGrid(city, gridIndex) {
  const gridFile = getGridCacheFile(city, gridIndex);
  if (checkFileExists(gridFile, 0)) {
    const cachedData = loadCachedGeoJSON(gridFile);
    if (cachedData !== null) {
      console.log(`📋 Grid ${gridIndex}: Using cached data (${cachedData.length} streets)`);
      return cachedData;
    }
  }
  return null;
}

function saveGridCache(city, gridIndex, features) {
  const gridFile = getGridCacheFile(city, gridIndex);
  try {
    writeFeatures(gridFile, features);
    console.log(`💾 Grid ${gridIndex}: Cached ${features.length} streets to ${gridFile}`);
  } catch (error) {
    console.log(`⚠️  Failed to cache grid ${gridIndex}:`, error.message);
  }
}

function getGridCacheStats(city, totalGrids) {
  const stats = {
    cached: 0,
    missing: [],
    total: totalGrids
  };
  
  for (let i = 0; i < totalGrids; i++) {
    const gridFile = getGridCacheFile(city, i);
    if (checkFileExists(gridFile, 0)) { // Accept even empty files
      stats.cached++;
    } else {
      stats.missing.push(i);
    }
  }
  
  return stats;
}

function clearGridCache(city) {
  const dataDir = path.join(process.cwd(), 'data', city);
  if (!fs.existsSync(dataDir)) {
    console.log(`ℹ️  No data directory found for ${city}`);
    return;
  }
  const gridFiles = fs.readdirSync(dataDir).filter(f => f.startsWith('grid_') && f.endsWith('.geojson'));
  
  gridFiles.forEach(file => {
    const fullPath = path.join(dataDir, file);
    fs.unlinkSync(fullPath);
    console.log(`🗑️  Removed cached grid: ${file}`);
  });
  
  console.log(`✅ Cleared ${gridFiles.length} cached grid files`);
}

// Utility function to implement retry logic with exponential backoff and server failover
async function retryWithBackoff(queryFn, maxRetries = 3, baseDelay = 1000, useFailover = true) {
  let currentServer = getOverpassConfig();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn(currentServer);
    } catch (error) {
      console.log(`Attempt ${attempt}/${maxRetries} with ${currentServer.name} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`All ${maxRetries} attempts failed. Last error: ${error.message}`);
      }
      
      // Decide whether to switch servers or just retry
      const isServerError = error.message.includes('504') || error.message.includes('502') || error.message.includes('503');
      const isRateLimit = error.message.includes('429') || error.message.includes('Too Many Requests');
      
      let delay;
      
      if (isRateLimit) {
        // For rate limiting: try different server first, then longer delays
        if (useFailover && attempt === 1) {
          currentServer = getNextOverpassServer();
          delay = 5000; // Short delay when switching servers
          console.log(`⚠️  Rate limited. Trying different server after ${delay/1000}s...`);
        } else {
          delay = 30000 * Math.pow(2, attempt - 1);
          console.log(`⚠️  Rate limited. Waiting ${delay/1000}s before retry...`);
        }
      } else if (isServerError && useFailover && attempt <= 2) {
        // Switch server for server errors (but not on last attempt)
        currentServer = getNextOverpassServer();
        delay = baseDelay * attempt; // Moderate delay when switching servers
        console.log(`🔄 Server error. Trying different server after ${delay/1000}s...`);
      } else {
        // For other errors: exponential backoff
        delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying with ${currentServer.name} in ${delay/1000}s...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Enhanced function to call Overpass API with a single query and failover support
async function callOverpassAPI(query, serverConfig = null) {
  const server = serverConfig || getOverpassConfig();
  
  return new Promise((resolve, reject) => {
    console.log(`Requesting data from ${server.name}...`);
    console.log('Query:', query.split('\n')[0] + '...');

    const options = {
      overpassUrl: server.url,
      flatProperties: false
    };

    overpass(query, (error, data) => {
      if (error) {
        console.log(`${server.name} error:`, error);
        return reject(error);
      }
      
      if (!data) {
        return reject(new Error(`Received empty response from ${server.name}`));
      }
      
      if (!data.features || !Array.isArray(data.features)) {
        return reject(new Error(`Invalid response format from ${server.name} - missing or invalid features array`));
      }
      
      console.log(`✅ ${server.name}: ${data.features.length} features received`);
      resolve(data);
    }, options);
  });
}

// Returns a promise with the relation feature
async function getBoundary(id) {
  const query = `relation(${id});(._;>;);out;`;
  
  try {
    const data = await retryWithBackoff((server) => callOverpassAPI(query, server));
    const relationFeatures = data.features.filter((el) => el.properties.type === 'relation');
    
    if (relationFeatures.length === 0) {
      throw new Error(`No relation features found for ID ${id}. Check if the relation ID is correct.`);
    }
    
    console.log(`Found relation feature for ID ${id}`);
    return relationFeatures[0];
    
  } catch (error) {
    console.error(`Failed to get boundary for relation ${id}:`, error.message);
    throw error;
  }
}

async function getOverPassData(squareBBOX, index, city, language, generatePartialGridFile = false) {
  // Check if this grid is already cached
  const cachedGrid = loadCachedGrid(city, index);
  if (cachedGrid !== null) {
    return cachedGrid;
  }

  const query = `
    way(${squareBBOX.minLat},${squareBBOX.minLng},${squareBBOX.maxLat},${squareBBOX.maxLng})
		[highway~"^(pedestrian|footway|residential|unclassified|trunk|service|bridge|path|living_street|primary|secondary|tertiary)$"];
		(._;>;);
    out;
  `;

  try {
    console.log(`Processing grid ${index}...`);
    const data = await retryWithBackoff((server) => callOverpassAPI(query, server));
    
    if (!data.features || data.features.length === 0) {
      console.log(`No street features found in grid ${index}`);
      const emptyResult = [];
      // Cache even empty results to avoid re-querying
      saveGridCache(city, index, emptyResult);
      return emptyResult;
    }
    
    const relationFeatures = data.features.reduce((acum, feature) => {
      if (feature.geometry && (feature.geometry.type === 'LineString' || feature.geometry.type === 'Polygon')) {
        // Validate that we have proper properties and tags
        const tags = feature.properties?.tags || {};
        const name = tags[`name:${language}`] || tags.name;
        
        // Only include features with names
        if (name) {
          acum.push({
            ...feature,
            properties: {
              name: name,
              id: feature.properties?.id || `unnamed_${index}_${acum.length}`,
              wikipedia_link: '',
              gender: 'unknown',
            },
          });
        }
      }
      return acum;
    }, []);

    console.log(`Grid ${index}: Found ${relationFeatures.length} named streets`);

    // Cache the processed results
    saveGridCache(city, index, relationFeatures);

    if (generatePartialGridFile && relationFeatures.length > 0) {
      const geojsonPath = path.join(
        __dirname,
        `../data/${city}/${city}_streets_grid${index}.geojson`
      );
      writeFeatures(geojsonPath, relationFeatures);
    }
    
    return relationFeatures;
    
  } catch (error) {
    console.error(`Failed to get data for grid ${index}:`, error.message);
    throw error;
  }
}

// Optimize complex geometries for better API performance
function optimizeGeometry(featureCollection) {
  console.log(`Original geometry: ${featureCollection.features.length} polygons`);
  
  let totalVertices = 0;
  featureCollection.features.forEach(feature => {
    if (feature.geometry.type === 'Polygon') {
      totalVertices += feature.geometry.coordinates[0].length;
    }
  });
  
  console.log(`Total vertices: ${totalVertices}`);
  
  // Simplify if geometry is very complex (>100 vertices total)
  if (totalVertices > 100) {
    console.log('⚡ Simplifying complex geometry...');
    const simplified = {
      ...featureCollection,
      features: featureCollection.features.map(feature => {
        try {
          // Use conservative tolerance to maintain shape accuracy
          const tolerance = 0.0001; // ~10 meters at this scale
          return simplify(feature, { tolerance, highQuality: true });
        } catch {
          console.log('Warning: Could not simplify feature, using original');
          return feature;
        }
      })
    };
    
    let simplifiedVertices = 0;
    simplified.features.forEach(feature => {
      if (feature.geometry.type === 'Polygon') {
        simplifiedVertices += feature.geometry.coordinates[0].length;
      }
    });
    
    console.log(`Simplified to ${simplifiedVertices} vertices (${((totalVertices - simplifiedVertices) / totalVertices * 100).toFixed(1)}% reduction)`);
    return simplified;
  }
  
  return featureCollection;
}

// Calculate adaptive grid size based on city area and complexity
function calculateOptimalGridSize(bboxCity, featureCollection) {
  const cityAreaM2 = area(featureCollection);
  const cityAreaKm2 = cityAreaM2 / 1_000_000;
  const polygonCount = featureCollection.features.length;
  
  console.log(`City area: ${cityAreaKm2.toFixed(1)} km²`);
  console.log(`Polygon count: ${polygonCount}`);
  
  let splitFactor = 1;
  
  if (cityAreaKm2 > 100) {
    splitFactor = 3;
    console.log(`🔧 Large city detected (${cityAreaKm2.toFixed(0)} km²), using ${splitFactor}x${splitFactor} grid`);
  } else if (cityAreaKm2 > 30 || polygonCount > 2) {
    splitFactor = 2;
    console.log(`🔧 Medium city detected, using ${splitFactor}x${splitFactor} grid`);
  } else {
    console.log(`🔧 Compact city, using single grid`);
  }
  
  return splitFactor;
}

async function getGrid(bboxCity, featureCollection = null, customSplitFactor = null) {
  const polygon = bboxPolygon(bboxCity);
  const center = centerOfMass(polygon);
  
  // Use custom split factor or calculate optimal one
  const splitFactor = customSplitFactor || (featureCollection ? calculateOptimalGridSize(bboxCity, featureCollection) : 1);

  const boxParameters = {
    centerLat: center.geometry.coordinates[1],
    centerLng: center.geometry.coordinates[0],
    maxLat: bboxCity[3],
    minLat: bboxCity[1],
    maxLng: bboxCity[2],
    minLng: bboxCity[0],
  };

  const grid = await bboxSplit.boundingBoxCutting(boxParameters, splitFactor);
  console.log(`📊 Generated ${grid.length} grid squares for processing`);
  return grid;
}

async function getStreetsByBBOX(bboxCity, city = 'city', language = 'es', cityBoundaries = null) {
  // Generate optimized grid based on city complexity
  const grid = await getGrid(bboxCity, cityBoundaries);
  
  // Check grid cache status
  const cacheStats = getGridCacheStats(city, grid.length);
  console.log(`📊 Grid cache status: ${cacheStats.cached}/${cacheStats.total} grids cached`);
  
  if (cacheStats.cached > 0) {
    console.log(`💾 Found cached grids, will skip: [${cacheStats.cached} grids]`);
    console.log(`🔄 Need to process: [${cacheStats.missing.join(', ')}]`);
  }

  let index = 0;
  const features = [];
  let rateLimitEncountered = false;
  let successfulGrids = 0;
  let cachedGrids = 0;
  
  for (const square of grid) {
    console.log(`🔄 Processing grid ${index + 1}/${grid.length}`);
    
    const wasAlreadyCached = checkFileExists(getGridCacheFile(city, index), 0);
    
    try {
      const overpassResults = await getOverPassData(square, index, city, language);
      
      features.push(...overpassResults);
      successfulGrids++;
      
      if (wasAlreadyCached) {
        cachedGrids++;
      }
      
      rateLimitEncountered = false;
    } catch (error) {
      if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        rateLimitEncountered = true;
        console.log(`⚠️  Grid ${index} failed due to rate limiting. Continuing with next grid...`);
      } else {
        console.error(`❌ Grid ${index} failed with error:`, error.message);
        console.log(`🔄 Continuing with remaining grids...`);
      }
    }
    
    index++;
    
    if (!wasAlreadyCached && index < grid.length) {
      const delay = rateLimitEncountered ? 30000 : (grid.length > 4 ? 15000 : 10000);
      console.log(`⏱️  Waiting ${delay/1000}s before next request to overpass...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.log(`🎯 Processing completed: ${successfulGrids}/${grid.length} grids successful, ${features.length} total streets found`);
  if (cachedGrids > 0) {
    console.log(`⚡ Performance: ${cachedGrids} grids loaded from cache, ${successfulGrids - cachedGrids} downloaded fresh`);
  }
  
  // Warn if we got very few results compared to grid count
  if (successfulGrids < grid.length * 0.5 && grid.length > 1) {
    console.log(`⚠️  Warning: Only ${successfulGrids}/${grid.length} grids returned data. This may indicate rate limiting issues.`);
    console.log(`💡 Consider running the process during off-peak hours for better results.`);
  }

  // Deduplicate streets that span multiple grid cells
  const seen = new Set();
  const uniqueFeatures = features.filter(feature => {
    const key = feature.properties.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (uniqueFeatures.length < features.length) {
    console.log(`🔀 Deduplicated: ${features.length} → ${uniqueFeatures.length} streets (${features.length - uniqueFeatures.length} duplicates removed)`);
  }

  return uniqueFeatures;
}

const processCity = async function (city, relationId, language) {
  try {
    const server = getOverpassConfig();
    console.log(`🏙️  Processing city: ${city} (relation: ${relationId})`);
    console.log(`🌍 Using Overpass server: ${server.name} (${server.url})`);
    
    // Check cache status
    const cache = getCacheStatus(city);
    console.log(`📂 Cache status - boundary: ${cache.boundary ? '✅' : '❌'}, streets: ${cache.streets ? '✅' : '❌'}`);
    
    let optimizedBoundaries, cityBBOX, cityFilePath;
    
    // STEP 1: Get city boundaries (with caching)
    cityFilePath = cache.files.boundary;
    if (cache.boundary) {
      console.log(`📋 Using cached boundary data: ${cityFilePath}`);
      const cachedBoundaries = loadCachedGeoJSON(cityFilePath);
      if (cachedBoundaries && cachedBoundaries.length > 0) {
        optimizedBoundaries = { type: 'FeatureCollection', features: cachedBoundaries };
        cityBBOX = bbox(optimizedBoundaries);
        console.log(`📐 City bounding box from cache: [${cityBBOX.map(x => x.toFixed(4)).join(', ')}]`);
      } else {
        console.log(`⚠️  Cached boundary file is invalid, will re-download`);
        cache.boundary = false;
      }
    }
    
    if (!cache.boundary) {
      console.log(`🌍 Downloading boundary data from Overpass API...`);
      const rawBoundaries = flatten(await getBoundary(relationId)).features;
      console.log(`📍 Retrieved boundary data: ${rawBoundaries.length} features`);
      
      // Optimize geometry for complex cities
      const boundariesCollection = { type: 'FeatureCollection', features: rawBoundaries };
      optimizedBoundaries = optimizeGeometry(boundariesCollection);
      
      writeFeatures(cityFilePath, optimizedBoundaries.features);
      console.log(`💾 Saved boundary to: ${cityFilePath}`);
      
      // Calculate bounding box from optimized geometry
      cityBBOX = bbox(optimizedBoundaries);
      console.log(`📐 City bounding box: [${cityBBOX.map(x => x.toFixed(4)).join(', ')}]`);
    }

    // STEP 2: Get street data (with caching)
    let filteredFeatures;
    if (cache.streets) {
      console.log(`📋 Using cached streets data: ${cache.files.streets}`);
      const cachedStreets = loadCachedGeoJSON(cache.files.streets);
      if (cachedStreets && cachedStreets.length > 0) {
        filteredFeatures = cachedStreets;
        console.log(`✅ Loaded ${filteredFeatures.length} streets from cache`);
      } else {
        console.log(`⚠️  Cached streets file is invalid, will re-download`);
        cache.streets = false;
      }
    }
    
    if (!cache.streets) {
      console.log(`🛣️  Downloading street data from Overpass API...`);
      // Process streets with optimized parameters
      const features = await getStreetsByBBOX(cityBBOX, city, language, optimizedBoundaries);
      console.log(`🔍 ${features.length} features retrieved from Overpass API`);

      if (features.length === 0) {
        console.log('⚠️ No streets found. This could be due to:');
        console.log('   - Incorrect relation ID');
        console.log('   - City boundary issue'); 
        console.log('   - All API requests failed due to rate limiting');
        console.log('   - Try running during off-peak hours');
        throw new Error('No street data was successfully retrieved');
      }

      // Find if a feature intersects with any of the city boundaries
      console.log('🎯 Filtering streets within city boundaries...');
      filteredFeatures = features.filter((feature) => {
        return optimizedBoundaries.features.find((boundary) => {
          try {
            return booleanContains(boundary, feature);
          } catch {
            return false;
          }
        });
      });

      console.log(`✅ Filtered to ${filteredFeatures.length} streets within city boundaries`);

      const filteredFeaturesPath = cache.files.streets;
      console.log(`💾 Writing streets result to: ${filteredFeaturesPath}`);
      writeFeatures(filteredFeaturesPath, filteredFeatures);
    }
    
    // Update cache status after processing
    const finalCache = getCacheStatus(city);
    console.log(`🎉 Processing completed! Files ready:`);
    console.log(`   📍 Boundary: ${finalCache.boundary ? '✅' : '❌'} (${finalCache.files.boundary})`);
    console.log(`   🛣️  Streets: ${finalCache.streets ? '✅' : '❌'} (${finalCache.files.streets})`);
    console.log(`   📄 Total streets: ${filteredFeatures.length}`);

    return true;
  } catch (err) {
    console.error('❌ ProcessCity error:', err.message);
    return false;
  }
};

module.exports = {
  processCity,
  clearGridCache,
  getGridCacheStats,
};
