'use strict';

const turf = require('turf');
const tilebelt = require('tilebelt');
const normalize = require('geojson-normalize');
const flatten = require('geojson-flatten');
const fs = require('fs');
const  path = require('path');
const filters = require('./scripts/constants').filters;




var mapNames = new Set();
var listStreetNames = new Set();
const currentLangs = ["es"];

module.exports = function(tileLayers, tile, writeData, done){

  const osmRoads = cleanGeoms(normalize(flatten(clip(tileLayers.osm.osm, tile))));
  //writeFileMapNames();
  done(null, osmRoads);

};


function writeFileMapNames(){
  var mapNamesString = '';
  for (let item of mapNames.keys()){
    mapNamesString += '\', \''+item;
  };
  fs.writeFile(path.join(__dirname, `data/mapNames.txt`), '['+mapNamesString+']', function(err) {});  
}


function clip(geoms, tile) {

  geoms.features = geoms.features.map(function(geom) {

    try {

      var clipped = turf.intersect(geom, turf.polygon(tilebelt.tileToGeoJSON(tile).coordinates));
      clipped.properties = geom.properties;
      return clipped;

    } catch(e){

        console.log('error: '+e.message);
        return;

    }
  });

  geoms.features = geoms.features.filter( function(geom) {

    if (geom) return true;
  
  });

  return geoms;
}

function isValidStreet(line) {

  return isLine(line.geometry.type) && isValidHighway(line.properties);

}


function isLine(geomType){
  return (geomType === 'LineString' || geomType === 'MultiLineString');
}

function isValidHighway(properties){

  if (properties.highway) {
    return (properties.highway === "pedestrian" || properties.highway === "footway" || properties.highway === "residential" || 
    properties.highway === "unclassified" || properties.highway === "trunk" || properties.highway === "service" ||
    properties.highway === "tertiary" || properties.highway === "primary" || properties.highway === "bridge" ||
    properties.highway === "secondary" || properties.highway === "path" || properties.highway === "living_street");
  }

  return false;
}

function isValidRoadname(roadName){
  return (roadName !== undefined &&  roadName !== 'undefined' && !(/\d/.test(roadName) || roadName.match(/main/i) || roadName.match(/Torrent/i) || roadName.match(/Viaducte/i) || roadName.match(/Carretera/i) || roadName.match(/Túnel/i) || roadName.match(/Ctra/i) || roadName.match(/Viaducte/i) || roadName.match(/Moll/i) || roadName.match(/Accés/i) || roadName.match(/Carril/i) || roadName.match(/Costa/i) || roadName.match(/Corriol/i) || roadName.match(/Pista/i) || roadName.match(/Autovia/i)) );
}

function isValidStreet(line) {

  return isLine(line.geometry.type) && isValidHighway(line.properties);

}

function isValidSquare(geom) {

  return (
    geom.geometry.type === 'Polygon' &&
    geom.properties.highway &&
    geom.properties.highway === 'pedestrian'&&
    geom.properties.area &&
    geom.properties.area === 'yes'
    && geom.properties.name !== undefined
  );

}


function cleanGeoms (geoms) {
  
  const logStream = fs.createWriteStream( path.join(__dirname, `data/list.csv`), {encoding: 'utf8', flags: 'a'});

  geoms.features = geoms.features.filter( function(geom) {

    if (isValidStreet(geom) || isValidSquare(geom) ) {
      
      const roadName = geom.properties.name;
     
      if (geom.properties.name && isValidRoadname(geom.properties.name)) {

        if (!listStreetNames.has(geom.properties.name)) {
          
          const cleanName = currentLangs.reduce((name, lang) =>
            cleanRoadName(name, lang)
          , roadName);
          
          logStream.write(`${geom.properties.name};${cleanName}\n`);
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

  logStream.end('\n');
  return geoms;
}


function cleanRoadName(roadName, lang = 'es'){

  const filterList = filters[lang].filter01;
  const filterList2 = filters[lang].filter02;
     
  for(var i =0; i< filterList.length; i++){

    if(roadName.indexOf(filterList[i]) !== -1){

      var name = roadName.replace(filterList[i], '').trim();

      for(var j=0; j < filterList2.length; j++){
        
        if(name.indexOf(filterList2[j]) !== -1){
          name = name.replace(filterList2[j], '').trim();
        }
      }

      return name;
    }

  }
  return roadName;
}


