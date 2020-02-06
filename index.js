'use strict';

const path = require('path');
const fs = require('fs');
let tilereduce = require('tile-reduce');
const args = require('yargs').argv;
const doClipCity = require('./scripts/commons').doClipCity;

const args = require('yargs')
  .usage('Pass a city name, its area and its OSM relation ID ')
  .epilog('GeoChicas OSM 2020')
  .alias('h', 'help')
  .alias('ciudad', 'city')
  .alias('r', 'relation')
  .alias('a', 'area')
  .describe('c', 'City in your data folder')
  .describe('r', 'OSM relation ID for that city')
  .demandOption(['c', 'r', 'a'])
  .argv;


function printArgs() {

  for (let j = 0; j < args.length; j++) {
    console.log(j + ' -> ' + (args[j]));
  }

}



function execReduce() {



  const opts = {

    bbox: [-84.12, 9.9, -84.02, 9.96], //San jose
    log: true,
    zoom: 12,
    sources: [{
      name: 'osm',
      mbtiles: path.join(__dirname, 'data/spain.mbtiles')
    }],
    maxWorkers: 4,
    map: path.join(__dirname, 'map.js')
  };

  if (args.area) opts.bbox = JSON.parse(args.area);

  const ciudad = args.ciudad ? args.ciudad : 'ciudad';
  const relationIdOSM = args.relation ? args.relation : 1;

  let num = 0;

  const finalGeojson = {
    "type": "FeatureCollection",
    "features": []
  };


  tilereduce = tilereduce(opts)

    .on('start', function () {
      console.log('starting');
    })

    .on('map', function (tile, workerId) {
      console.log('about to process ' + JSON.stringify(tile) + ' on worker ' + workerId);
    })

    .on('reduce', function (result, tile) {
      num++;
      finalGeojson.features = finalGeojson.features.concat(result.features);
    })

    .on('end', function (error) {

      const geojsonPath = path.join(__dirname, `data/${ciudad}/${ciudad}_streets_noclip.geojson`);
      fs.writeFileSync(geojsonPath, JSON.stringify(finalGeojson), function (err) {});
      console.log(`${num} tiles has been processed.`);
      console.log('--------------------- END processing mbtiles -----------------------');

      console.log('--------------------- Start clipping...')
      doClipCity(ciudad, relationIdOSM);

    });

}


printArgs();
execReduce();