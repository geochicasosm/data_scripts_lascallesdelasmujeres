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
.describe('c', 'City in your data folder')
.describe('r', 'OSM relation ID for that city')
.describe('lang', 'main language of the streets names')
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
	
	const getStreetsResult = await processCity(city, relationIdOSM, language);
	if(!getStreetsResult) return;

	console.log('--------------------- Start applying gender...');
	await applyGender(city, [language]);
	

}
startProcess();
