'use strict';

const LineByLineReader = require('line-by-line');
const fs = require('fs');
const args = require('yargs').argv;
const  path = require('path');

const folder = (args.city ? args.city : 'ciudad');

const MALE = "male";
const FEMALE = "female";
const COL_FULL_NAME = 0;
const COL_CLEAN_NAME = 1;
const COL_NAME = 2;
const COL_SURNAME = 3;
const COL_FIABILIDAD = 4;
const COL_GENDER = 5;
const COL_CATEGORY = 6;
const COL_TYPE_OF_ROAD = 7;
const COL_WIKIPEDIA = 8;
const DELIMITATION = ";";

const streeMap = new Map();
const lr = new LineByLineReader(path.join(__dirname, `../data/${folder}/${folder}_finalCSV.csv`), { encoding: 'utf8', skipEmptyLines: true });

lr.on('error', function (err) { });

lr.on('line', function (line) {

	lr.pause();

    var splitLine = line.split(DELIMITATION);
    
    //Male case
    if(splitLine[COL_GENDER].toLowerCase() === MALE ){
        
        streeMap.set(splitLine[COL_FULL_NAME], {
            url: '',
            gender: splitLine[COL_GENDER],
            scale: ""
        });  

        lr.resume();
        

    }else if(splitLine[COL_GENDER].toLowerCase() === FEMALE){ //Female case

        var url = '';
        if(splitLine.length > 5 && splitLine[COL_WIKIPEDIA]!== "") url = splitLine[COL_WIKIPEDIA];

        streeMap.set(splitLine[COL_FULL_NAME], {
            url: url,
            gender: splitLine[COL_GENDER],
            scale: "",
            category: splitLine[COL_CATEGORY],
            typeofroad: splitLine[COL_TYPE_OF_ROAD],
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

function readGeojson() {

    fs.readFile(path.join(__dirname, `../data/${folder}/${folder}_streets.geojson`), 'utf8', (err, data) => {

        if (err) throw err;

        const geojson = JSON.parse(data);
        
        const finalGeojson = {
            "type": "FeatureCollection",
            "features": []
        };

        for (let key in geojson.features) {

            if(streeMap.has(geojson.features[key].properties.name)){
                
                const objValues = streeMap.get(geojson.features[key].properties.name);
                
                geojson.features[key].properties.wikipedia_link = objValues.url;
                geojson.features[key].properties.gender = objValues.gender;
                geojson.features[key].properties.scale = objValues.scale;
                geojson.features[key].properties.category = objValues.category;
                geojson.features[key].properties.typeofroad = objValues.typeofroad;
                
                if(!tratadosList.has(geojson.features[key].properties.name)){

                    tratadosList.add(geojson.features[key].properties.name);

                    if (objValues.url !== ('' && null && undefined) && objValues.gender.toLowerCase() === FEMALE){
                        stats.numLink++;
                        stats.numFemale++;
                     }else if (objValues.gender.toLowerCase() === FEMALE){
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

        fs.writeFileSync( path.join(__dirname, `../data/${folder}/final_tile.geojson`), JSON.stringify(finalGeojson), 'utf8', (err) => {
            if (err) {                
                console.error(err);
                throw err;
            }
            console.log('final_tile.geojson has been saved!');
          });

          stats.totalNames = stats.numMale + stats.numFemale;
          stats.pcMale = ((stats.numMale * 100) / (stats.totalNames)).toFixed(1);
          stats.pcFemale = ((stats.numFemale * 100) / (stats.totalNames)).toFixed(1);
          const totalLinks = stats.numLink + stats.numNoLink;

          stats.pcLink = ((stats.numLink * 100) / totalLinks).toFixed(1);
          stats.pcNoLink = ((stats.numNoLink * 100) / totalLinks).toFixed(1);


          fs.writeFileSync( path.join(__dirname,`../data/${folder}/stats.txt`), JSON.stringify(stats), 'utf8', (err) => {
            if (err) {                
                console.error(err);
                throw err;
            }
            console.log('stat.txt has been saved!');
          });  
          
          fs.writeFileSync(path.join(__dirname, `../data/${folder}/noLinkList.txt`), noLinkList, 'utf8', (err) => {
            if (err) {
                console.error(err);
                throw err;                
            }
            console.log('noLinkList.txt been saved!');
          });          

      });

}

