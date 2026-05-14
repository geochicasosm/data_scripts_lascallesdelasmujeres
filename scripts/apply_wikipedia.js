'use strict';

const readline = require('readline');
const fs = require('fs');
const path = require('path');
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

const COL_FULL_NAME = 0;
const COL_CLEAN_NAME = 1;
const COL_GENDER = 5;

const MALE = 'male';
const FEMALE = 'female';
const UNKNOWN = 'unknown';

const fuseOptions = {
  id: 'sitelink',
  ignoreDiacritics: true,
  shouldSort: true,
  minMatchCharLength: 3,
  keys: ['itemLabel'],
  location: 0,
  threshold: 0.6,
  distance: 100,
};
const myfuse = new Fuse(wikipediaDic, fuseOptions);

async function startProcess() {
  console.log('Starting wikipedia link search process...');

  const inputFilePath = path.join(__dirname, `../data/${folder}/list_genderize.csv`);

  if (!fs.existsSync(inputFilePath)) {
    throw new Error(`Input file not found: ${inputFilePath}. Make sure the initial data processing step completed successfully.`);
  }

  const stats = fs.statSync(inputFilePath);
  if (stats.size < 100) {
    throw new Error(`Input file appears to be empty or contains only headers: ${inputFilePath}. This suggests the data extraction step failed.`);
  }

  console.log(`Input file validated: ${inputFilePath} (${stats.size} bytes)`);

  const outputPath = path.join(__dirname, `../data/${folder}/list_genderize_wikipedia.csv`);
  const outputStream = fs.createWriteStream(outputPath, { flags: 'w' });

  await new Promise((resolve, reject) => {
    outputStream.once('open', resolve);
    outputStream.once('error', reject);
  });

  outputStream.write('calle;calleClean;name;surname;fiabilidad;gender;category;typeofroad;wikipedia\n');

  const rl = readline.createInterface({
    input: fs.createReadStream(inputFilePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const streetMap = new Set();

  for await (const line of rl) {
    if (!line.trim()) continue;

    const splitLine = line.split(';');

    if (streetMap.has(splitLine[COL_FULL_NAME])) continue;

    const gender = splitLine[COL_GENDER].toLowerCase();
    streetMap.add(splitLine[COL_FULL_NAME]);

    if (gender === MALE) {
      outputStream.write(line + '\n');
    } else if (gender === FEMALE) {
      const result = myfuse.search(splitLine[COL_CLEAN_NAME]);
      const url = result.length > 0 && result[0]?.item?.sitelink
        ? result[0].item.sitelink
        : '';
      outputStream.write(`${line};${url}\n`);
    } else if (keepUnknown && gender === UNKNOWN) {
      outputStream.write(line + '\n');
    }
  }

  await new Promise((resolve, reject) => {
    outputStream.end();
    outputStream.once('finish', resolve);
    outputStream.once('error', reject);
  });

  console.log('----FINISH----');
}

startProcess().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
