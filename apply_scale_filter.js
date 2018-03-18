
const url_search = 'https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=3&format=json&gsrsearch=';
const url_wiki_base = 'https://es.wikipedia.org/wiki/';



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
            
                        stream.write(`${line};${encodeURI(url_wiki_base + title)}`);
                        stream.write('\n');
                        
                        lr.resume();                
                    }else{
    
                        throw {error: `No pages found for ${splitLine[1]}`};
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


