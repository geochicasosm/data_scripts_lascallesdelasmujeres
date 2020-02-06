const filters = require('./constants').filters;
const processCity = require('./clip_street').processCity;

function cleanRoadName(roadName, lang = 'es') {

	const filterList = filters[lang].filter01;
	const filterList2 = filters[lang].filter02;

	for (var i = 0; i < filterList.length; i++) {

		if (roadName.indexOf(filterList[i]) !== -1) {

			var name = roadName.replace(filterList[i], '').trim();

			for (var j = 0; j < filterList2.length; j++) {

				if (name.indexOf(filterList2[j]) !== -1) {
					name = name.replace(filterList2[j], '').trim();
				}
			}

			return name;
		}

	}
	return roadName;
}

function doClipCity(city, relationId) {

	try {
		console.log('city       : ', city);
		console.log('relation id: ', relationId);

		processCity(city, relationId)
			.then(() => {
				console.log('Done!!')
				process.exit(0);
			});

	} catch (error) {
		console.log('Something went wrong:', error.message);
		process.exit(1)
	}

}

module.exports = {
	cleanRoadName,
	doClipCity
}