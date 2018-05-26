'use strict';

const LineByLineReader = require('line-by-line');
const fs = require('fs');
const args = require('yargs').argv;
const  path = require('path');

const folder = (args.ciudad ? args.ciudad : 'ciudad');
const streeMap = new Map();
const lr = new LineByLineReader(path.join(__dirname, `data/${folder}/${folder}_finalCSV.csv`), { encoding: 'utf8', skipEmptyLines: true });

lr.on('error', function (err) { });

lr.on('line', function (line) {

	lr.pause();

    //LINE EXAMPLE:
    //calle;calleClean;name;surname;fiabilidad;gender;wikipedia

    var splitLine = line.split(';');

    //Male case
    if(splitLine[5].toLowerCase() === "male" ){

        streeMap.set(splitLine[0], {
            url: '',
            gender: splitLine[5],
            scale: splitLine[4]
        });  
        
        lr.resume();

    }else if(splitLine[5].toLowerCase() === "female"){ //Female case

        var url = '';
        if(splitLine.length > 6) url = splitLine[6];

        streeMap.set(splitLine[0], {
            url: url,
            gender: splitLine[5],
            scale: splitLine[4]
        });
        lr.resume();   

    }else{
        lr.resume();
    }

});

lr.on('end', function () {

    readGeojson();
    
});


/* stats vars*/
const stats = {
    numLink: 0,
    pcLink: 0,
    numNoLink: 0,
    pcNoLink: 0,
    numMale: 0,
    numFemale: 0,
    pcMale: 0,
    pcFemale: 0,
    totalNames: 0
};


let noLinkList = '';
const tratadosList = new Set();

function readGeojson(file, tilecount){

    fs.readFile(path.join(__dirname, `data/${folder}/${folder}_streets.geojson`), 'utf8', (err, data) => {

        if (err) throw err;

        var geojson = JSON.parse(data);
        
        var finalGeojson = {
            "type": "FeatureCollection",
            "features": []
        };

        for (var key in geojson.features) {

            if(streeMap.has(geojson.features[key].properties.name)){
                var objValues = streeMap.get(geojson.features[key].properties.name);
                geojson.features[key].properties.wikipedia_link = objValues.url;
                geojson.features[key].properties.gender = objValues.gender;
                geojson.features[key].properties.scale = objValues.scale;
                
                if(!tratadosList.has(geojson.features[key].properties.name)){

                    tratadosList.add(geojson.features[key].properties.name);

                    if (objValues.url !== ('' && null && undefined) && objValues.gender.toLowerCase() === 'female'){
                        stats.numLink++;
                        stats.numFemale++;
                     }else if (objValues.gender.toLowerCase() === 'female'){
                        stats.numFemale++;
                        stats.numNoLink++;                 
                        noLinkList += `\n${geojson.features[key].properties.name}`;                                                             
                     }else{
                        stats.numMale++;
                     }                    
                }

                finalGeojson.features.push(geojson.features[key]);
            }

        }

        fs.writeFileSync( path.join(__dirname, `data/${folder}/final_tile.geojson`), JSON.stringify(finalGeojson), 'utf8', (err) => {
            if (err) {
                throw err;
                console.error(err);
            }
            console.log('final_tile.geojson has been saved!');
          });

          stats.totalNames = stats.numMale + stats.numFemale;
          stats.pcMale = ((stats.numMale * 100) / (stats.totalNames)).toFixed(1);
          stats.pcFemale = ((stats.numFemale * 100) / (stats.totalNames)).toFixed(1);
          const totalLinks = stats.numLink + stats.numNoLink;

          stats.pcLink = ((stats.numLink * 100) / totalLinks).toFixed(1);
          stats.pcNoLink = ((stats.numNoLink * 100) / totalLinks).toFixed(1);


          fs.writeFileSync( path.join(__dirname,`data/${folder}/stats.txt`), JSON.stringify(stats), 'utf8', (err) => {
            if (err) {
                throw err;
                console.error(err);
            }
            console.log('stat.txt has been saved!');
          });  
          
          fs.writeFileSync(path.join(__dirname, `data/${folder}/noLinkList.txt`), noLinkList, 'utf8', (err) => {
            if (err) {
                throw err;
                console.error(err);
            }
            console.log('noLinkList.txt been saved!');
          });          

      });

}

