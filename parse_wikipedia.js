console.log('wikipedia');
//https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=Ramon%20y%20Cajal&format=json
//https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=Ramon%20y%20Cajal&gsrlimit=2&format=json

const url_search = 'https://ca.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=3&format=json&gsrsearch=';
const url_wiki_base = 'https://ca.wikipedia.org/wiki/';

var LineByLineReader = require('line-by-line');
var axios = require('axios');
var fs = require('fs');

var streeMap = new Set();
var lr = new LineByLineReader('barcelona/list_genderize_filtered.csv', { encoding: 'utf8', skipEmptyLines: true });

lr.on('error', function (err) { });

lr.on('line', function (line) {

	lr.pause();

    var splitLine = line.split(';');

    //Male case
    if(splitLine[4] === "Male" ){

        streeMap.set(splitLine[0], {
            url: '',
            gender: splitLine[4],
            scale: splitLine[3]
        });  
        
        lr.resume();

    }else if(splitLine[4] === "Female"){ //Female case

        var searchTitle = encodeURI(splitLine[1]);
        axios.get(`${url_search}${searchTitle}`)

        .then(function (response) {
                    
            var title = '';
            var index = 100;
            if(response && response.data && response.data.query && response.data.query.pages){
                for (var key in response.data.query.pages) {

                    if(response.data.query.pages[key].index < index){
                        index = response.data.query.pages[key].index;
                        title = response.data.query.pages[key].title;
                    }            
                }
    
                //console.log(splitLine[0], encodeURI(url_wiki_base + title));
                streeMap.set(splitLine[0], {
                    url: encodeURI(url_wiki_base + title),
                    gender: splitLine[4],
                    scale: splitLine[3]
                });
                lr.resume();                
            }else{
                console.log('repsonse', response);
                throw {error: `No pages found for ${splitLine[1]}`};
            }

        })
        .catch(function (error) {            
            console.log('line error', line);
            //console.log(error);
            lr.resume();
        });

    }else{
        lr.resume();
    }

});

lr.on('end', function () {
    

    fs.readdirSync('./barcelona/tiles').forEach(file => {
        //console.log(file);
        readGeojson(file);
    });
    
    

});


function readGeojson(file){

    fs.readFile(`./barcelona/tiles/${file}`, 'utf8', (err, data) => {

        if (err) throw err;
        //console.log(data);

        var geojson = JSON.parse(data);
        var newGeojson = {
            "type": "FeatureCollection",
            "features": []
        };

        for (var key in geojson.features) {

            if(streeMap.has(geojson.features[key].properties.name)){
                var objValues = streeMap.get(geojson.features[key].properties.name);
                geojson.features[key].properties.wikipedia_link = objValues.url;
                geojson.features[key].properties.gender = objValues.gender;
                geojson.features[key].properties.scale = objValues.scale;
                newGeojson.features.push(geojson.features[key]);
            }

        }

        fs.writeFile( `./barcelona/tiles_finals/final_${file}`, JSON.stringify(newGeojson), 'utf8', (err) => {
            if (err) throw err;
            console.log('The file has been saved!');
          });

      });

}

