'use strict';

const url_search = 'http://api.namsor.com/onomastics/api/json/gendre';
const womenDic = new Set();
const menDic = new Set();

const LineByLineReader = require('line-by-line');
const axios = require('axios');
const fs = require('fs');
const  path = require('path');
const args = require('yargs').argv;

const folder = (args.ciudad ? args.ciudad : 'ciudad');
const gender_stream = fs.createWriteStream(path.join(__dirname, `data/${folder}/list_genderize.csv`), {'flags': 'a'});


let numFindWomen = 0;
let numFindMen = 0;
let numNamesor = 0;

//const nombres_stream = fs.createWriteStream(path.join(__dirname, `namesDB/list_mujeres.csv`), {'flags': 'a'});
//const nombres_stream = fs.createWriteStream(path.join(__dirname, `namesDB/list_hombres.csv`), {'flags': 'a'});

function initDictionaryObjects(){

    initWomenDic();    

}

function initWomenDic(){

    var lr = new LineByLineReader(path.join(__dirname, `namesDB/list_mujeres.csv`), { encoding: 'utf8', skipEmptyLines: true });

    lr.on('error', function (err) {
        console.log(err);
        throw err;
    });
    
    lr.on('line', function (line) {
        lr.pause();
        //console.log(line);
        womenDic.add(line);    
        lr.resume();
    });
    
    lr.on('end', function () {
        initMenDic();
        console.log('Diccionario de nombres de mujer init: OK');
    }); 
}

function initMenDic(){

    var lr = new LineByLineReader(path.join(__dirname, `namesDB/list_hombres.csv`), { encoding: 'utf8', skipEmptyLines: true });

    lr.on('error', function (err) {
        console.log(err);
        throw err;
    });
    
    lr.on('line', function (line) {
        lr.pause();
        //console.log(line);
        menDic.add(line);    
        lr.resume();
    });
    
    lr.on('end', function () {
        
        console.log('Diccionario de nombres de hombre init: OK');
        startProcess();
    }); 
}


function startProcess(){

    console.log('Starting process...');

    try {
  
        const gender_stream2 = fs.createWriteStream(path.join(__dirname, `data/${folder}/list_genderize.csv`), {'flags': 'a'});
        gender_stream2.once('open', function(fd) {
            initReadFile(gender_stream2);           
        });        

      } catch (err) {
        console.error(err);
      } 
}

function initReadFile(stream){

    console.log('Procesando listado de calles....');
    var lr = new LineByLineReader(path.join(__dirname, `data/${folder}/list.csv`), { encoding: 'utf8', skipEmptyLines: true });

    lr.on('error', function (err) {
        console.log(err);
        throw err;
    });
    
    lr.on('line', function (line) {

        lr.pause();
        //console.log('line...', line);
    
        var splitLine = line.split(';');

        var name_surname = splitLine[1].split(' ');
        var name = name_surname[0];
        var surname = (name_surname.length > 1 ? name_surname[1] : '' );


        if(womenDic.has(name.toUpperCase())){
            //console.log("iswomen");
            var scale = 2;
            var gender = "female";
            stream.write(`${splitLine[0]};${name};${surname};${scale};${gender}`);
            stream.write('\n');
            numFindWomen++;
            lr.resume();

        } else if(menDic.has(name.toUpperCase())) {
            //console.log('ismen');
            var scale = -2;
            var gender = "male";
            stream.write(`${splitLine[0]};${name};${surname};${scale};${gender}`);
            stream.write('\n');
            numFindMen++;
            lr.resume();

        } else {

            //console.log('axios');
            axios.get(`${url_search}/${name}/${surname}/es`)
        
            .then(function (response) {
    
                var scale = response.data.scale;
                var gender = response.data.gender;
                stream.write(`${splitLine[0]};${name};${surname};${scale};${gender}`);
                stream.write('\n');
                numNamesor++;
                lr.resume();
    
            })
            .catch(function (error) {            
                //console.log('line error', line);
                //console.log(error);
                stream.write(`${splitLine[0]};${name};${surname};0;Unknown`);
                stream.write('\n');
                numNamesor++;
                lr.resume();
            }); 
        }


    });
    
    lr.on('end', function () {
        stream.end();
        console.log('--------------');
        console.log('Nombres de mujer encontrados en el diccionario: ', numFindWomen);
        console.log('Nombres de hombre encontrados en el diccionario: ', numFindMen);
        console.log('Nombre enviados a namesor: ', numNamesor);
        console.log('----FINISH----');
    });

}

//startProcess();
//initDictionaryObjects();
initWomenDic();


function paserDBnames(){

    nombres_stream.once('open', function(fd) {

            initCleanListNames(nombres_stream);               
    });
}

function initCleanListNames(){

    var lr = new LineByLineReader(path.join(__dirname, `namesDB/mujeres.csv`), { encoding: 'utf8', skipEmptyLines: true });

    lr.on('error', function (err) {
        console.log(err);
        throw err;
    });
    
    lr.on('line', function (line) {

        lr.pause();
    
        var splitLine = line.split(',');

        nombres_stream.write(`${splitLine[0]}`);
        nombres_stream.write('\n');
        
        lr.resume();

    });
    
    lr.on('end', function () {
        nombres_stream.end();
        console.log('----FINISH----');
    });    
}
//paserDBnames();
