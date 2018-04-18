'use strict';

const url_search = 'https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=3&format=json&gsrsearch=';
const url_wiki_base = 'https://es.wikipedia.org/wiki/';
const endpointUrl = 'https://query.wikidata.org/sparql';


const LineByLineReader = require('line-by-line');
const axios = require('axios');

const fs = require('fs');
const  path = require('path');
const args = require('yargs').argv;

const folder = (args.ciudad ? args.ciudad : 'ciudad');
const searchWikipedia = (args.wikipedia ? true : false);

const streetMap = new Set();
const filtered_stream = fs.createWriteStream(path.join(__dirname, `data/${folder}/list_genderize_filtered${(searchWikipedia? '_w': '')}.csv`), {'flags': 'a'});
const descarte_stream = fs.createWriteStream(path.join(__dirname, `data/${folder}/list_genderize_descarte.csv`), {'flags': 'a'});


function startProcess(){

    try {
  
        filtered_stream.once('open', function(fd) {
            filtered_stream.write(`calle;name;surname;fiabilidad;gender;wikipedia`);
            filtered_stream.write('\n');
            initReadFile(filtered_stream);           
        });        

      } catch (err) {
        console.error(err);
      } 
}

function initReadFile(stream){

    var lr = new LineByLineReader(path.join(__dirname, `data/${folder}/list_genderize.csv`), { encoding: 'utf8', skipEmptyLines: true });

    lr.on('error', function (err) {
        console.log(err);
        throw err;
    });
    
    lr.on('line', function (line) {

        lr.pause();
    
        var splitLine = line.split(';');
    
        //Male case
        if(!streetMap.has(splitLine[0]) && splitLine[4].toLowerCase() === "male" && splitLine[3] <= -0.25 ){
    
            stream.write(line);
            stream.write('\n');
            streetMap.add(splitLine[0]);
            lr.resume();
    
        }else if(!streetMap.has(splitLine[0]) && splitLine[4].toLowerCase() === "female" && splitLine[3] >= 0.25 ){ //Female case

            streetMap.add(splitLine[0]);

            if(searchWikipedia){

                const searchTitle = encodeURI(`${splitLine[1]} ${splitLine[2]}`);
                axios.get(`${url_search}${searchTitle}`).then(function (response) {
                            
                    var title = '';
                    var index = 100;
                    if(response && response.data && response.data.query && response.data.query.pages){
                        for (var key in response.data.query.pages) {
        
                            if(response.data.query.pages[key].index < index){
                                index = response.data.query.pages[key].index;
                                title = response.data.query.pages[key].title;
                            }            
                        }
            
                        stream.write(`${line};${encodeURI(url_wiki_base + title)}`);
                        stream.write('\n');
                        
                        lr.resume();                
                    }else{
    
                        throw {error: `No pages found for ${searchTitle}`};
                    }
        
                })
                .catch(function (error) {            
                    //console.log('line error', line);
                    //console.log(error);
                    stream.write(line);
                    stream.write('\n');
                    lr.resume();
                }); 

            }else{
                stream.write(line);
                stream.write('\n');
                lr.resume();
            }
           
    
        }else{
            lr.resume();
        }
            
    });
    
    lr.on('end', function () {
        stream.end();
        console.log('----FINISH----');
    });

}

startProcess();


/*snippet using wikidata*/
/*

    const searchTitle = encodeURI(`${splitLine[1]} ${splitLine[2]}`);
    const sparqlQuery = `PREFIX%20schema%3A%20%3Chttp%3A%2F%2Fschema.org%2F%3E%0A%0ASELECT%20%3Fperson%20%3Fsitelink%20%3Flabel%20(LANG(%3Flabel)%20AS%20%3Flang)%0AWHERE%0A%7B%0A%20%20%3Fperson%20wdt%3AP21%20wd%3AQ6581072.%0A%20%20%3Fperson%20wdt%3AP31%20wd%3AQ5%3B%20%20%20%20%20%20%20%20%20%20%0A%20%20%20%20%20%20%20%20%20%20rdfs%3Alabel%20%3Flabel.%0A%20%20FILTER(LANG(%3Flabel)%20IN%20(%22es%22)).%20%23%20tweak%20to%20taste%0A%20%20FILTER(CONTAINS(%3Flabel%2C%20%22${searchTitle}%22)).%0A%20%3Fsitelink%20schema%3Aabout%20%3Fperson.%0A%20%20%3Fsitelink%20schema%3AinLanguage%20%22es%22.%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22es%22.%20%7D%20%20%0A%7D%0ALIMIT%201`;                

    myAxios.get(endpointUrl + '?format=json&query=' + sparqlQuery)
    .then(function (response) {
        
        if(response.data && response.data.results && response.data.results.bindings && response.data.results.bindings.sitelink){
        console.log(response.data.results.bindings.sitelink.value);
        stream.write(`${line};${response.data.results.bindings.sitelink.value}`);
        stream.write('\n');
        
        lr.resume();                
        }else{
            
            throw {error: `No pages found for ${decodeURI(searchTitle)}`};
        }                                      
    })
    .catch(function (error) {
        console.log(error);
        stream.write(line);
        stream.write('\n');
        lr.resume();
    });

*/