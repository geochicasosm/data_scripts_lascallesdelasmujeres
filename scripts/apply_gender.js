'use strict';

const filters = require('./filters').filters;
const LineByLineReader = require('line-by-line');
const fs = require('fs');
const path = require('path');

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

function applyGender(folder, currentLangs = ['es']) {
  const womenDic = new Set();
  const menDic = new Set();

  let numFindWomen = 0;
  let numFindMen = 0;
  let numUnknown = 0;
  let numNoName = 0;

  const INDEX_FULL_NAME = 0;
  const INDEX_CLEAN_NAME = 1;

  function initDictionaryObjects() {
    initWomenDic();
  }

  function initWomenDic() {
    const lr = new LineByLineReader(path.join(__dirname, '../namesDB/list_mujeres.csv'), {
      encoding: 'utf8',
      skipEmptyLines: true,
    });

    lr.on('error', function (err) {
      console.log(err);
      throw err;
    });

    lr.on('line', function (line) {
      lr.pause();
      womenDic.add(line);
      lr.resume();
    });

    lr.on('end', function () {
      initMenDic();
      console.log('Diccionario de nombres de mujer init: OK');
    });
  }

  function initMenDic() {
    const lr = new LineByLineReader(path.join(__dirname, '../namesDB/list_hombres.csv'), {
      encoding: 'utf8',
      skipEmptyLines: true,
    });

    lr.on('error', function (err) {
      console.log(err);
      throw err;
    });

    lr.on('line', function (line) {
      lr.pause();
      menDic.add(line);
      lr.resume();
    });

    lr.on('end', function () {
      console.log('Diccionario de nombres de hombre init: OK');
      startProcess();
    });
  }

  function startProcess() {
    console.log('Starting process...');
    new Promise((resolve, reject) => {
      try {
        const gender_stream2 = fs.createWriteStream(
          path.join(__dirname, `../data/${folder}/list_genderize.csv`),
          {
            flags: 'a',
          }
        );
        gender_stream2.once('open', async function () {
          await initReadFile(gender_stream2);
          resolve();
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  }

  async function initReadFile(stream) {
    console.log('Procesando listado de calles....');

    const lr = new LineByLineReader(path.join(__dirname, `../data/${folder}/list.csv`), {
      encoding: 'utf8',
      skipEmptyLines: true,
    });

    lr.on('error', function (err) {
      console.log(err);
      throw err;
    });

    lr.on('line', function (line) {
      lr.pause();

      const splitLine = line.split(';');

      const name_surname = splitLine[INDEX_CLEAN_NAME].split(' ');

      const name = name_surname[0];
      const surname = name_surname.length > 1 ? name_surname[1] : '';

      let isWoman = false;
      let isMan = false;

      for (let word of name_surname) {
        const w = prepareWord(word);

        if (womenDic.has(w.toUpperCase())) {
          isWoman = true;
          break;
        } else if (menDic.has(w.toUpperCase())) {
          isMan = true;
          break;
        }
      }

      if (isWoman) {
        stream.write(
          `${splitLine[INDEX_FULL_NAME]};${splitLine[INDEX_CLEAN_NAME]};${name};${surname};2;Female;-;-`
        );
        stream.write('\n');
        numFindWomen++;
        lr.resume();
      } else if (isMan) {
        stream.write(
          `${splitLine[INDEX_FULL_NAME]};${splitLine[INDEX_CLEAN_NAME]};${name};${surname};-2;Male;-;-`
        );
        stream.write('\n');
        numFindMen++;
        lr.resume();
      } else {
        stream.write(
          `${splitLine[INDEX_FULL_NAME]};${splitLine[INDEX_CLEAN_NAME]};${name};${surname};0;Unknown;-;-`
        );
        stream.write('\n');
        numUnknown++;
        lr.resume();
      }
    });

    lr.on('end', function () {
      stream.end();
      console.log('--------------');
      console.log('Calles sin nombre: ', numNoName);
      console.log('Nombres de mujer encontrados en el diccionario: ', numFindWomen);
      console.log('Nombres de hombre encontrados en el diccionario: ', numFindMen);
      console.log('Nombre desconocidos: ', numUnknown);
      console.log('----FINISH----');
      return;
    });
  }

  function prepareWord(str) {
    let accents = 'ÀÁÂÃÄÅàáâãäåßÒÓÔÕÕÖØòóôõöøÈÉÊËèéêëðÇçÐÌÍÎÏìíîïÙÚÛÜùúûüÑñŠšŸÿýŽž';
    let accentsOut = 'AAAAAAaaaaaaBOOOOOOOooooooEEEEeeeeeCcDIIIIiiiiUUUUuuuuNnSsYyyZz';
    str = str.split('');
    str.forEach((letter, index) => {
      let i = accents.indexOf(letter);
      if (i != -1) {
        str[index] = accentsOut[i];
      }
    });

    return str.join('');
  }

  function prepareListCSV() {
    fs.open(path.join(__dirname, `/../data/${folder}/list.csv`), 'w', function (err, file) {
      if (err) {
        console.error(`Error opening file ${file}`, err);
        throw err;
      }

      const logStream = fs.createWriteStream(path.join(__dirname, `/../data/${folder}/list.csv`), {
        encoding: 'utf8',
        flags: 'a',
      });
      fs.readFile(
        path.join(__dirname, `../data/${folder}/${folder}_streets.geojson`),
        'utf8',
        (err, data) => {
          if (err) {
            console.error('read file');
            throw err;
          }

          const geojson = JSON.parse(data);

          for (const feature of geojson.features) {
            if (feature.properties && feature.properties.name) {
              const roadName = feature.properties.name;
              const cleanName = currentLangs.reduce(
                (name, lang) => cleanRoadName(name, lang),
                roadName
              );

              logStream.write(`${feature.properties.name};${cleanName}\n`);
            } else {
              numNoName++;
            }
          }

          logStream.end('\n');

          initDictionaryObjects();
        }
      );
    });
  }

  prepareListCSV();
}

module.exports = {
  applyGender,
};
