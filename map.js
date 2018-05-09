'use strict';

const turf = require('turf');
const cover = require('tile-cover');
const tilebelt = require('tilebelt');
const normalize = require('geojson-normalize');
const flatten = require('geojson-flatten');
const _ = require('underscore');
const fs = require('fs');
const  path = require('path');


const folder = 'bcn';


var mapNames = new Set();
var listStreetNames = new Set();

module.exports = function(tileLayers, tile, writeData, done){

  var osmRoads = cleanLines(normalize(flatten(clip(tileLayers.osm.osm, tile))));
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


function clip(lines, tile) {

  lines.features = lines.features.map(function(line){

    try {
      var clipped = turf.intersect(line, turf.polygon(tilebelt.tileToGeoJSON(tile).coordinates));
      clipped.properties = line.properties;
      return clipped;
    } catch(e){
        console.log('error: '+e.message);
      return;
    }
  });
  lines.features = lines.features.filter(function(line){
    if(line) return true;
  });
  return lines;
}


function cleanLines (lines) {
  
  const logStream = fs.createWriteStream( path.join(__dirname, `data/list.csv`), {encoding: 'utf8', flags: 'a'});

  lines.features = lines.features.filter(function(line){

    if( isLine(line.geometry.type) && isValidHighway(line.properties)){
      
      var roadName = line.properties.name;
      //if(line.properties.wikipedia) console.log('wikipedia', line.properties.wikipedia);
      //if(line.properties.wikidata) console.log('wikipedia', line.properties.wikidata);
     
      if(line.properties.name && isValidRoadname(line.properties.name)){


        if(!listStreetNames.has(line.properties.name)){
          
          const cleanName = cleanRoadName(roadName);          
          logStream.write(`${line.properties.name};${cleanName}\n`);
          listStreetNames.add(line.properties.name);                   
        }
        
        //var listnames = roadName.split(' ');
        //mapNames.add(listnames[0]);

        line.properties = {
          name: line.properties.name,
          id: line.properties['@id'],
          wikipedia_link: '',
          gender: 'unknown',
          scale: ''
        };
        return true;
      }
    }
  });

  logStream.end('\n');
  return lines;
}


function isLine( geomType){
  return (geomType === 'LineString' || geomType === 'MultiLineString');
}

function isValidHighway(properties){

  if(properties.highway){
    return (properties.highway == "pedestrian" || properties.highway == "footway" || properties.highway == "residential" || 
    properties.highway == "unclassified" || properties.highway == "trunk" || properties.highway == "service" ||
    properties.highway == "tertiary" || properties.highway == "primary" || properties.highway == "bridge" ||
    properties.highway == "secondary" || properties.highway == "path" || properties.highway == "living_street");
  }

  return false;
}

function isValidRoadname(roadName){
  return (roadName !== undefined &&  roadName !== 'undefined' && !(/\d/.test(roadName) || roadName.match(/main/i) || roadName.match(/Torrent/i) || roadName.match(/Viaducte/i) || roadName.match(/Carretera/i) || roadName.match(/Túnel/i) || roadName.match(/Ctra/i) || roadName.match(/Viaducte/i) || roadName.match(/Moll/i) || roadName.match(/Accés/i) || roadName.match(/Carril/i) || roadName.match(/Costa/i) || roadName.match(/Corriol/i) || roadName.match(/Pista/i) || roadName.match(/Autovia/i)) );
}


function cleanRoadName(roadName){

  /*Catalan*/
/*   var filterList = ['Avinguda', 'avinguda', 'Túnel', 'Camí', 'Carrer', 'Ctra.', 'Passatge', 'Ronda', 'Passeig', 'Viaducte', 'Via', 'carrer', 'Torrent', 'camí', 'Rotonda', 'Plaça', 'Jardins', 'Jardí', 'Parc', 'Accés', 'Baixada', 'Rambla', 'Travessera', 'travessera', 'Riera', 'plaça', 'Gran', 'Passage', 'Placeta', 'Sant', 'antiga', 'Ptge.', 'Pont', 'Travessia', 'la', 'Cerrer', 'Pla', 'Marquès', 'Av.', 'Antic', 'Cami', 'sendero', 'entrada', 'avinguda', 'cami', 'passeig', 'Nostra', 'passatge', 'Pista', 'Corriol', 'Costa'];
  var filterList2 = ['de la ', 'de l\'', 'de les ', 'dels ', 'del ', 'de ', 'd\'']; */

  /*Spanish*/
  var filterList = ['Paseo','Río', 'Avenida', 'Hacienda', 'Puerto', 'Callejón', 'Calle', 'Calzada', 'Camino', 'Av.','Paso', 'Cañada', 'Minas', 'Cerrada', 
    'Puebla', 'Principal', 'Central','Primera', 'Segunda', 'Portón', 'Lateral', 'Calz.', 'Corrido', 'Casa', 'Villa', 'Mejía', 
    'Vía', 'Via', 'Real', 'Isla', 'Avendida', 'Marisma', 'Rada', 'Raudal', 'Ribera', 'Embocadura', 'Cataratas', 'Médanos', 
    'Mirador', 'Av', 'Jardín',  'A.', 'Circuito','Gral.', 'Rincón', 'Calz', 'Rinconada', 'Periférico', 'Cda', 'Jardin', 
    'C.', 'Callejon', 'Colegio', 'Valle', 'avenida', 'camino', 'calle', 'Calle', 'Rotonda', 'Parqueo', 'Parque', 'entrada', 
    'Entrada', 'sendero', 'Sendero', 'Pasaje', 'pasaje', 'Puerto', 'Ciudad', 'Puente', 'Boulevard', 'Agrosuperior', 'Bodegas', 
    'Autobanco', 'SkyTrace', 'Plaza', 'Motel', 'C/', 'Rotonda', 'Drive', 'Residencial', 'Automac', 
    'Auto', 'Transcersal', 'Inter', 'Pasillo', 'Centro', 'Caminito', 'Arandas', 'Proveedores', 'Cajero', 'Zona', 'Primer', 'Res.'
  ];
  var filterList2 = ['de las ', 'de la ', 'de los ', 'de lo ', 'del ', 'de ', 'en '];
     
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


