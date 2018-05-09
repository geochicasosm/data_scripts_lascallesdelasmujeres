'use strict';

const url_search = 'https://api.idescat.cat/onomastica/v1/noms/';//silla.json?lang=ca';

const LineByLineReader = require('line-by-line');
const axios = require('axios');
const fs = require('fs');
const  path = require('path');
const args = require('yargs').argv;

const folder = (args.ciudad ? args.ciudad : 'ciudad');
const gender_stream = fs.createWriteStream(path.join(__dirname, `data/${folder}/list_genderize.csv`), {'flags': 'a'});


function startProcess(){

    try {
  
        gender_stream.once('open', function(fd) {
            initReadFile(gender_stream);           
        });        

      } catch (err) {
        console.error(err);
      } 
}

function initReadFile(stream){

    var lr = new LineByLineReader(path.join(__dirname, `data/${folder}/list.csv`), { encoding: 'utf8', skipEmptyLines: true });

    lr.on('error', function (err) {
        console.log(err);
        throw err;
    });
    
    lr.on('line', function (line) {

        lr.pause();
    
        var splitLine = line.split(';');

        var name_surname = splitLine[1].split(' ');
        var name = name_surname[0];
        var surname = (name_surname.length > 1 ? name_surname[1] : '' );


        axios.get(`${url_search}/${name}/${surname}/es`)
        
        .then(function (response) {

            var scale = response.data.scale;
            var gender = response.data.gender;
            
            stream.write(`${splitLine[0]};${name};${surname};${scale};${gender}`);
            stream.write('\n');
            lr.resume();

        })
        .catch(function (error) {            
            //console.log('line error', line);
            //console.log(error);
            stream.write(`${splitLine[0]};${name};${surname};0;Unknown`);
            stream.write('\n');
            lr.resume();
        }); 

    });
    
    lr.on('end', function () {
        stream.end();
        console.log('----FINISH----');
    });

}

startProcess();
