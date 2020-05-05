'use strict';

const LineByLineReader = require('line-by-line');
const fs = require('fs');
const  path = require('path');
const Fuse = require('fuse.js');
const wikipediaDic = require('./wikipedia_dic').wikipediaDic;

const args = require('yargs')
  .usage('WIKIPEDIA STEP: Pass a city name and the flag --keepUnknown in case you want to keep the unclassified streets. ')
  .epilog('GeoChicas OSM 2020')
  .alias('h', 'help')
  .alias('c', 'city')
  .alias('ku', 'keepUnknown')
  .describe('c', 'City in your data folder')
  .describe('ku', 'To keep unclassified streets')
  .demandOption(['c'])
  .argv;

const folder = args.city ? args.city : 'city';
const keepUnknown = args.keepUnknown ? true : false;
const streetMap = new Set();

const COL_FULL_NAME = 0;
const COL_CLEAN_NAME = 1;
/* const COL_NAME = 2;
const COL_SURNAME = 3;
const COL_FIABILIDAD = 4; */
const COL_GENDER = 5;
/* const COL_WIKIPEDIA = 8; */

const MALE = 'male';
const FEMALE = 'female';
const UNKNOWN = 'unknown';

function startProcess(){

    console.log('Starting wikipedia link search process...');

    try {
        const filtered_stream = fs.createWriteStream(path.join(__dirname, `../data/${folder}/list_genderize_wikipedia.csv`), {'flags': 'a'});
        filtered_stream.once('open', function() {
            filtered_stream.write('calle;calleClean;name;surname;fiabilidad;gender;category;typeofroad;wikipedia');
            filtered_stream.write('\n');
            initReadFile(filtered_stream);           
        });        

        } catch (err) {
        console.error(err);
        } 
}

function initReadFile(stream){

    console.log('init read file list_genderize.csv-');

    const lr = new LineByLineReader(path.join(__dirname, `../data/${folder}/list_genderize.csv`), { encoding: 'utf8', skipEmptyLines: true });

    lr.on('error', function (err) {
        console.log(err);
        throw err;
    });
    
    lr.on('line', function (line) {

        lr.pause();
    
        var splitLine = line.split(';');
    
        //Male case
        if(!streetMap.has(splitLine[COL_FULL_NAME]) && splitLine[COL_GENDER].toLowerCase() === MALE){
    
            stream.write(line);
            stream.write('\n');
            streetMap.add(splitLine[COL_FULL_NAME]);
            lr.resume();
    
        }else if(!streetMap.has(splitLine[COL_FULL_NAME]) && splitLine[COL_GENDER].toLowerCase() === FEMALE){ //Female case

            streetMap.add(splitLine[COL_FULL_NAME]);

            const result = myfuse.search(`${splitLine[COL_CLEAN_NAME]}`);
            const url = (result.length > 0 ? result[COL_FULL_NAME] : '');

            stream.write(`${line};${url}`);
            stream.write('\n');
                    
            lr.resume(); 

    
        }if(keepUnknown && !streetMap.has(splitLine[COL_FULL_NAME]) && splitLine[COL_GENDER].toLowerCase() === UNKNOWN){ //Female case
            
            stream.write(line);
            stream.write('\n');
            streetMap.add(splitLine[COL_FULL_NAME]);
            lr.resume();

        } else{
            lr.resume();
        }
            
    });
    
    lr.on('end', function () {
        stream.end();
        console.log('----FINISH----');
    });

}

var options = {
    id: 'sitelink',
    shouldSort: true,
    threshold: 0.6,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    keys: [
      'itemLabel'
    ]
  };
const myfuse = new Fuse(wikipediaDic, options);


startProcess();
