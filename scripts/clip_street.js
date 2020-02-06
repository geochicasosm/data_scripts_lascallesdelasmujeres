'use strict';

const path = require('path');
const fs = require('fs');

const overpass = require('query-overpass');

const booleanContains = require('@turf/boolean-contains').default;
const flatten = require('@turf/flatten').default;

// Returns the city features using the project convention file naming
function getFeatures(city) {
    const geojsonFilePath = path.join(process.cwd(), 'data', city, city + '_streets_noclip.geojson');
    console.log('Reading ', geojsonFilePath);

    const originalGeojson = fs.readFileSync(geojsonFilePath);

    const originalData = JSON.parse(originalGeojson);
    if (!originalData || !'features' in originalData) {
        throw new Error('File does not look as a GeoJSON')
    }
    return originalData.features;
}

// Returns a promise with the relation feature
async function getBoundary(id) {
    return new Promise((resolve, reject) => {
        const query = `relation(${id});(._;>;);out;`;
        console.log('Requestind data to the Overpass API...')
        console.log('query: ', query);

        overpass(query, (error, data) => {
            if (error) {
                console.log('Something happened', error);
                reject(error);
            }
            const relationFeatures = data.features.filter(el => el.properties.type == 'relation');

            if (relationFeatures.length == 0) {
                reject(new Error('No features on this relation'));
            }

            resolve(relationFeatures[0]);
        })
    });
}

// Writes a GeoJSON into the passed file path
function writeFeatures(outputPath, features) {
    const jsonString = JSON.stringify({
        type: "FeatureCollection",
        features: features
    });

    fs.writeFileSync(outputPath, jsonString);
}

// main function
const processCity = async function (city, relationId) {
    // Get the original (square) geojson data
    const features = getFeatures(city);
    console.log(`${features.length} features on you GeoJSON file`);

    // Get the OSM relation and flatten it to generate different geometries
    const cityBoundaries = flatten(await getBoundary(relationId)).features;

    const cityFilePath = path.join(process.cwd(), 'data', city, city + '_boundary.geojson');
    writeFeatures(cityFilePath, cityBoundaries);
    console.log('City boundary: ', cityFilePath);

    // Find if a feature intersects with any of the city boundaries
    const filteredFeatures = features.filter(feature => {
        return cityBoundaries.find(boundary => {
            return booleanContains(boundary, feature);
        });
    });

    console.log('Filtered features: ', filteredFeatures.length);

    const filteredFeaturesPath = path.join(process.cwd(), 'data', city, city + '_streets.geojson');
    console.log('Writing the result at: ', filteredFeaturesPath)

    writeFeatures(filteredFeaturesPath, filteredFeatures);
}

module.exports = {
    processCity
}