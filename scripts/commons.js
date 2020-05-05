'use strict';

const fs = require('fs');


// Writes a GeoJSON into the passed file path
function writeFeatures(outputPath, features) {
	const jsonString = JSON.stringify({
	  type: 'FeatureCollection',
	  features: features,
	});
  
	fs.writeFileSync(outputPath, jsonString);
}



module.exports = {
	writeFeatures
};