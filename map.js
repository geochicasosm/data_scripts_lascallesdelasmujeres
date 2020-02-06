'use strict';

const turf = require('turf');
const tilebelt = require('tilebelt');
const normalize = require('geojson-normalize');
const flatten = require('geojson-flatten');
const fs = require('fs');
const path = require('path');


const mapNames = new Set();
const listStreetNames = new Set();

module.exports = function (tileLayers, tile, writeData, done) {

  const osmRoads = cleanGeoms(normalize(flatten(clip(tileLayers.osm.osm, tile))));
  //writeFileMapNames();
  done(null, osmRoads);

};


function writeFileMapNames() {
  let mapNamesString = '';
  for (let item of mapNames.keys()) {
    mapNamesString += '\', \'' + item;
  };
  fs.writeFile(path.join(__dirname, `data/mapNames.txt`), '[' + mapNamesString + ']', function (err) {});
}


function clip(geoms, tile) {

  geoms.features = geoms.features.map(function (geom) {

    try {

      const clipped = turf.intersect(geom, turf.polygon(tilebelt.tileToGeoJSON(tile).coordinates));
      clipped.properties = geom.properties;
      return clipped;

    } catch (e) {

      console.log('error: ' + e.message);
      return;

    }
  });

  geoms.features = geoms.features.filter(function (geom) {

    if (geom) return true;

  });

  return geoms;
}

function isValidStreet(line) {

  return isLine(line.geometry.type) && isValidHighway(line.properties);

}


function isLine(geomType) {
  return (geomType === 'LineString' || geomType === 'MultiLineString');
}

function isValidHighway(properties) {

  if (properties.highway) {
    return (properties.highway === "pedestrian" || properties.highway === "footway" || properties.highway === "residential" ||
      properties.highway === "unclassified" || properties.highway === "trunk" || properties.highway === "service" ||
      properties.highway === "tertiary" || properties.highway === "primary" || properties.highway === "bridge" ||
      properties.highway === "secondary" || properties.highway === "path" || properties.highway === "living_street");
  }

  return false;
}

function isValidRoadname(roadName) {
  return (roadName !== undefined && roadName !== 'undefined' && !(/\d/.test(roadName) || roadName.match(/main/i) || roadName.match(/Torrent/i) || roadName.match(/Viaducte/i) || roadName.match(/Carretera/i) || roadName.match(/Túnel/i) || roadName.match(/Ctra/i) || roadName.match(/Viaducte/i) || roadName.match(/Moll/i) || roadName.match(/Accés/i) || roadName.match(/Carril/i) || roadName.match(/Costa/i) || roadName.match(/Corriol/i) || roadName.match(/Pista/i) || roadName.match(/Autovia/i)));
}

function isValidStreet(line) {

  return isLine(line.geometry.type) && isValidHighway(line.properties);

}

function isValidSquare(geom) {

  return (
    geom.geometry.type === 'Polygon' &&
    geom.properties.highway &&
    geom.properties.highway === 'pedestrian' &&
    geom.properties.area &&
    geom.properties.area === 'yes' &&
    geom.properties.name !== undefined
  );

}


function cleanGeoms(geoms) {

  geoms.features = geoms.features.filter(function (geom) {

    if (isValidStreet(geom) || isValidSquare(geom)) {

      if (geom.properties.name && isValidRoadname(geom.properties.name)) {

        if (!listStreetNames.has(geom.properties.name)) {
          listStreetNames.add(geom.properties.name);
        }

        geom.properties = {
          name: geom.properties.name,
          id: geom.properties['@id'],
          wikipedia_link: '',
          gender: 'unknown',
          scale: ''
        };

        return true;
      }
    }
  });


  return geoms;
}