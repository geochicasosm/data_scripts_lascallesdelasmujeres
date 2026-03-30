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

  function checkGenderizeCache() {
    const listFile = path.join(__dirname, `../data/${folder}/list.csv`);
    const genderizeFile = path.join(__dirname, `../data/${folder}/list_genderize.csv`);

    try {
      const listStats = fs.statSync(listFile);
      const genderizeStats = fs.statSync(genderizeFile);

      if (genderizeStats.size > 200 && genderizeStats.mtime > listStats.mtime) {
        console.log(`📋 Found existing genderize data: ${genderizeFile}`);
        console.log(`   File size: ${genderizeStats.size} bytes`);
        console.log(`   Modified: ${genderizeStats.mtime.toISOString()}`);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  if (checkGenderizeCache()) {
    console.log('✅ Gender classification already completed, skipping');
    console.log('💡 Delete list_genderize.csv if you want to re-run gender classification');
    return Promise.resolve();
  }

  console.log('🔄 Starting gender classification process...');

  // Return a Promise that resolves when the entire callback chain completes
  return new Promise((resolve, reject) => {
    function loadDictionary(filePath, targetSet) {
      return new Promise((res, rej) => {
        const lr = new LineByLineReader(filePath, {
          encoding: 'utf8',
          skipEmptyLines: true,
        });
        lr.on('error', rej);
        lr.on('line', function (line) {
          lr.pause();
          targetSet.add(line);
          lr.resume();
        });
        lr.on('end', res);
      });
    }

    function classifyStreets(stream) {
      return new Promise((res, rej) => {
        const lr = new LineByLineReader(path.join(__dirname, `../data/${folder}/list.csv`), {
          encoding: 'utf8',
          skipEmptyLines: true,
        });

        lr.on('error', rej);

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
              `${splitLine[INDEX_FULL_NAME]};${splitLine[INDEX_CLEAN_NAME]};${name};${surname};2;Female;-;-\n`
            );
            numFindWomen++;
          } else if (isMan) {
            stream.write(
              `${splitLine[INDEX_FULL_NAME]};${splitLine[INDEX_CLEAN_NAME]};${name};${surname};-2;Male;-;-\n`
            );
            numFindMen++;
          } else {
            stream.write(
              `${splitLine[INDEX_FULL_NAME]};${splitLine[INDEX_CLEAN_NAME]};${name};${surname};0;Unknown;-;-\n`
            );
            numUnknown++;
          }

          lr.resume();
        });

        lr.on('end', function () {
          stream.end();
          console.log('--------------');
          console.log('Calles sin nombre: ', numNoName);
          console.log('Nombres de mujer encontrados en el diccionario: ', numFindWomen);
          console.log('Nombres de hombre encontrados en el diccionario: ', numFindMen);
          console.log('Nombre desconocidos: ', numUnknown);
          console.log('----FINISH----');
          res();
        });
      });
    }

    function prepareListCSV() {
      const streetsPath = path.join(__dirname, `../data/${folder}/${folder}_streets.geojson`);
      const listPath = path.join(__dirname, `../data/${folder}/list.csv`);

      fs.readFile(streetsPath, 'utf8', (err, data) => {
        if (err) {
          return reject(err);
        }

        const geojson = JSON.parse(data);
        const logStream = fs.createWriteStream(listPath, { encoding: 'utf8', flags: 'w' });

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

        logStream.end();
        logStream.once('finish', () => {
          runClassification().then(resolve, reject);
        });
      });
    }

    async function runClassification() {
      await loadDictionary(path.join(__dirname, '../namesDB/list_mujeres.csv'), womenDic);
      console.log('Diccionario de nombres de mujer init: OK');

      await loadDictionary(path.join(__dirname, '../namesDB/list_hombres.csv'), menDic);
      console.log('Diccionario de nombres de hombre init: OK');

      const genderStream = fs.createWriteStream(
        path.join(__dirname, `../data/${folder}/list_genderize.csv`),
        { flags: 'w' }
      );

      await new Promise((res, rej) => {
        genderStream.once('open', () => res());
        genderStream.once('error', rej);
      });

      await classifyStreets(genderStream);
    }

    prepareListCSV();
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

module.exports = {
  applyGender,
};
