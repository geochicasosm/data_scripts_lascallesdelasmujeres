'use strict';

const womenDic = new Set();
const menDic = new Set();

const LineByLineReader = require('line-by-line');
const axios = require('axios');
const fs = require('fs');
const  path = require('path');
const args = require('yargs').argv;

const folder = (args.ciudad ? args.ciudad : 'ciudad');

let numFindWomen = 0;
let numFindMen = 0;
let numNamesor = 0;

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
    
        var splitLine = line.split(';');

        var name_surname = splitLine[1].split(' ');
        
        var name = name_surname[0];
        var surname = (name_surname.length > 1 ? name_surname[1] : '' );

        var isWoman = false;
        var isMan = false; 

        for (var word of name_surname) {
            
            var w = prepareWord(word);

            if(womenDic.has(w.toUpperCase())){
                isWoman = true;
                break;
            } else if(menDic.has(w.toUpperCase())) {
                isMan = true;
                break;
            }
        }


        if(isWoman){
            
            //console.log("FEMALE", `${splitLine[0]}`);
            stream.write(`${splitLine[0]};${splitLine[1]};${name};${surname};2;Female`);
            stream.write('\n');
            numFindWomen++;
            lr.resume();

        } else if(isMan){
            
            //console.log("MALE", `${splitLine[0]}`);
            stream.write(`${splitLine[0]};${splitLine[1]};${name};${surname};-2;Male`);
            stream.write('\n');
            numFindMen++;
            lr.resume();

        } else {

            //console.log("UNKNOWN", `${splitLine[0]}`);
            stream.write(`${splitLine[0]};${splitLine[1]};${name};${surname};0;Unknown`);
            stream.write('\n');
            numNamesor++;
            lr.resume();
        }

    });
    
    lr.on('end', function () {
        stream.end();
        console.log('--------------');
        console.log('Nombres de mujer encontrados en el diccionario: ', numFindWomen);
        console.log('Nombres de hombre encontrados en el diccionario: ', numFindMen);
        console.log('Nombre desconocidos: ', numNamesor);
        console.log('----FINISH----');
    });

}

function prepareWord(str) {

    let accents = 'ÀÁÂÃÄÅàáâãäåßÒÓÔÕÕÖØòóôõöøÈÉÊËèéêëðÇçÐÌÍÎÏìíîïÙÚÛÜùúûüÑñŠšŸÿýŽž';
    let accentsOut = "AAAAAAaaaaaaBOOOOOOOooooooEEEEeeeeeCcDIIIIiiiiUUUUuuuuNnSsYyyZz";
    str = str.split('');
    str.forEach((letter, index) => {
      let i = accents.indexOf(letter);
      if (i != -1) {
        str[index] = accentsOut[i];
      }
    })
    
    return str.join('');  
}


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
