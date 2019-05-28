'use strict';

const  path = require('path');
const fs = require('fs');
let tilereduce = require('tile-reduce');
const args = require('yargs').argv;


function printArgs(){

  for (let j = 0; j < args.length; j++) {  
    console.log(j + ' -> ' + (args[j]));
  }  

}

function execReduce() {

  let ciudad = 'ciudad';

  const opts = {
  
      bbox: [-84.12, 9.9, -84.02, 9.96], //San jose
      log: true,
      zoom: 12,
      sources: [
        {
          name: 'osm',
          mbtiles: path.join(__dirname, 'data/latest.planet.mbtiles')      
        }
      ],
      maxWorkers: 4,
      map: path.join(__dirname, 'map.js')
  };
  
  if (args.area) opts.bbox = JSON.parse(args.area);
  if (args.ciudad) ciudad = args.ciudad;
  
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
    console.log('about to process ' + JSON.stringify(tile) +' on worker '+workerId);
  })
  
  .on('reduce', function(result, tile){
    num++;
    finalGeojson.features = finalGeojson.features.concat(result.features) ;
  })
  
  .on('end', function(error){

    fs.writeFile( path.join(__dirname, `data/${ciudad}/${ciudad}_streets.geojson`), JSON.stringify(finalGeojson), function(err) {}); 
    console.log(`${num} tiles has been processed.`);
    
    fs.copyFileSync(path.join(__dirname, `data/list.csv`), path.join(__dirname, `data/${ciudad}/list.csv`));
    fs.unlinkSync(path.join(__dirname, `data/list.csv`));
    
    console.log('list.csv was copied to folder destination.');
    console.log('--------------------- END RESULTS -----------------------');
    
  });

}


printArgs();
execReduce();


