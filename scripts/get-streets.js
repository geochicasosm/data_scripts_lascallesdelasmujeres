'use strict';

const path = require('path');

const overpass = require('query-overpass');
const booleanContains = require('@turf/boolean-contains').default;
const flatten = require('@turf/flatten').default;
const bbox = require('@turf/bbox').default;
const bboxPolygon = require('@turf/bbox-polygon').default;
const centerOfMass = require('@turf/center-of-mass').default;

const bboxSplit = require('boundingbox-split');

const writeFeatures = require('./commons').writeFeatures;

// Returns a promise with the relation feature
async function getBoundary(id) {
  return new Promise((resolve, reject) => {
    const query = `relation(${id});(._;>;);out;`;
    console.log('Requestind data to the Overpass API...');
    console.log('query: ', query);

    overpass(query, (error, data) => {
      if (error) {
        console.log('Something happened', error);
        reject(error);
      }
      const relationFeatures = data.features.filter((el) => el.properties.type === 'relation');

      if (relationFeatures.length === 0) {
        reject(new Error('No features on this relation'));
      }

      resolve(relationFeatures[0]);
    });
  });
}

function getOverPassData(squareBBOX, index, city, language, generatePartialGridFile = false) {
  return new Promise((resolve, reject) => {
    const query = `
      way(${squareBBOX.minLat},${squareBBOX.minLng},${squareBBOX.maxLat},${squareBBOX.maxLng})
			[highway~"^(pedestrian|footway|residential|unclassified|trunk|service|bridge|path|living_street|primary|secondary|tertiary)$"];
			(._;>;);
      out;
    `;

    const overpassResults = overpass(query, async (error, data) => {
      if (error) {
        console.log(`Something happenned with request ${index}:${overpassResults}`, error);
        reject(error);
      } else {
        const relationFeatures = data.features.reduce((acum, feature) => {
          if (feature.geometry.type === 'LineString' || feature.geometry.type === 'Polygon') {
            acum = [
              ...acum,
              {
                ...feature,
                properties: {
                  name: feature.properties.tags[`name:${language}`] || feature.properties.tags.name,
                  id: feature.properties.id,
                  wikipedia_link: '',
                  gender: 'unknown',
                },
              },
            ];
          }
          return acum;
        }, []);

        if (generatePartialGridFile) {
          const geojsonPath = path.join(
            __dirname,
            `../data/${city}/${city}_streets_grid${index}.geojson`
          );
          writeFeatures(geojsonPath, relationFeatures);
        }
        resolve(relationFeatures);
      }
    });
  });
}

async function getGrid(bboxCity, splitFactor = 1) {
  const polygon = bboxPolygon(bboxCity);
  const center = centerOfMass(polygon);

  const boxParameters = {
    centerLat: center.geometry.coordinates[1],
    centerLng: center.geometry.coordinates[0],
    maxLat: bboxCity[3],
    minLat: bboxCity[1],
    maxLng: bboxCity[2],
    minLng: bboxCity[0],
  };

  const grid = await bboxSplit.boundingBoxCutting(boxParameters, splitFactor);
  return grid;
}

async function getStreetsByBBOX(bboxCity, city = 'city', language = 'es') {
  const grid = await getGrid(bboxCity);

  let index = 0;
  const features = [];
  for (const square of grid) {
    console.log(`Sending request number ${index}`);
    const overpassResults = await getOverPassData(square, index, city, language);
    console.log(`result ${index}: ${overpassResults.length} features`);
    index++;
    features.push(...overpassResults);
    console.log('waiting 10s before next request to overpass...');
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  return features;
}

const processCity = async function (city, relationId, language) {
  try {
    const cityBoundaries = flatten(await getBoundary(relationId)).features;
    const cityFilePath = path.join(process.cwd(), 'data', city, city + '_boundary.geojson');
    writeFeatures(cityFilePath, cityBoundaries);

    const cityBBOX = bbox({
      type: 'FeatureCollection',
      features: cityBoundaries,
    });
    const features = await getStreetsByBBOX(cityBBOX, city, language);
    console.log(`${features.length} features on your GeoJSON file`);

    // Find if a feature intersects with any of the city boundaries
    const filteredFeatures = features.filter((feature) => {
      return cityBoundaries.find((boundary) => {
        return booleanContains(boundary, feature);
      });
    });

    console.log('Filtered features: ', filteredFeatures.length);

    const filteredFeaturesPath = path.join(process.cwd(), 'data', city, city + '_streets.geojson');
    console.log('Writing the result at: ', filteredFeaturesPath);

    writeFeatures(filteredFeaturesPath, filteredFeatures);

    return true;
  } catch (err) {
    console.error('ProcessCity error', err);
    return false;
  }
};

module.exports = {
  processCity,
};
