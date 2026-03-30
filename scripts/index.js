'use strict';

const processCity = require('./get-streets').processCity;
const applyGender = require('./apply_gender').applyGender;

const args = require('yargs')
.usage('INITIAL STEP: Pass a city name and its OSM relation ID')
.epilog('GeoChicas OSM 2020')
.alias('h', 'help')
.alias('c', 'city')
.alias('r', 'relation')
.alias('lang', 'language')
.alias('s', 'server')
.describe('c', 'City in your data folder')
.describe('r', 'OSM relation ID for that city')
.describe('lang', 'main language of the streets names')
.describe('s', 'Overpass server: 0=main, 1=z-level, 2=lz4 (or set OVERPASS_URL env var)')
.demandOption(['c', 'r']).argv;

function printArgs() {
for (let j = 0; j < args.length; j++) {
  console.log(j + ' -> ' + args[j]);
}
}


async function startProcess() {

	printArgs();
	const city = args.city ? args.city : 'city';
	const relationIdOSM = args.relation ? args.relation : 1;
	const language = args.language ? args.language : 'es';
	
	// Set server selection from command line argument
	if (args.server !== undefined) {
		process.env.OVERPASS_SERVER_INDEX = args.server.toString();
		console.log(`🌍 Using Overpass server index: ${args.server}`);
	}
	
	const getStreetsResult = await processCity(city, relationIdOSM, language);
	if(!getStreetsResult) return;

	console.log('--------------------- Start applying gender...');
	await applyGender(city, [language]);
	

}
startProcess();
