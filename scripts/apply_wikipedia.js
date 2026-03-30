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
        const filtered_stream = fs.createWriteStream(path.join(__dirname, `../data/${folder}/list_genderize_wikipedia.csv`), {'flags': 'w'});
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
    
    const inputFilePath = path.join(__dirname, `../data/${folder}/list_genderize.csv`);
    
    // Check if the input file exists
    if (!fs.existsSync(inputFilePath)) {
        const error = new Error(`Input file not found: ${inputFilePath}. Make sure the initial data processing step completed successfully.`);
        console.error('ERROR:', error.message);
        throw error;
    }
    
    // Check if the file has content (more than just headers)
    const stats = fs.statSync(inputFilePath);
    if (stats.size < 100) { // Arbitrary threshold - a file with just headers would be very small
        const error = new Error(`Input file appears to be empty or contains only headers: ${inputFilePath}. This suggests the data extraction step failed.`);
        console.error('ERROR:', error.message);
        throw error;
    }
    
    console.log(`Input file validated: ${inputFilePath} (${stats.size} bytes)`);

    const lr = new LineByLineReader(inputFilePath, { encoding: 'utf8', skipEmptyLines: true });

    lr.on('error', function (err) {
        console.log('LineByLineReader error:', err);
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
            const url = result.length > 0  && result[0]?.item?.sitelink 
                ? result[0].item.sitelink 
                : '';
            stream.write(`${line};${url}`);
            stream.write('\n');
            lr.resume(); 

    
        } else if(keepUnknown && !streetMap.has(splitLine[COL_FULL_NAME]) && splitLine[COL_GENDER].toLowerCase() === UNKNOWN){
            
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

// https://www.fusejs.io/api/options.html#includematches
var options = {
    // Basic options
    id: 'sitelink',
    ignoreDiacritics: true,
    shouldSort: true,
    minMatchCharLength: 3,
    keys: [
      'itemLabel'
    ],
    // Fuzzy matching options 
    location: 0,
    threshold: 0.6,
    distance: 100,
  };
const myfuse = new Fuse(wikipediaDic, options);


startProcess();
