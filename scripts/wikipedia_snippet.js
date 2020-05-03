/*snippet using wikidata*/
//https://query.wikidata.org/#PREFIX%20schema%3A%20%3Chttp%3A%2F%2Fschema.org%2F%3E%0A%0ASELECT%20%3Fperson%20%3Fsitelink%20%3Flabel%20%28LANG%28%3Flabel%29%20AS%20%3Flang%29%0AWHERE%0A%7B%0A%20%20%3Fperson%20wdt%3AP21%20wd%3AQ6581072.%0A%20%20%3Fperson%20wdt%3AP31%20wd%3AQ5%3B%20%20%20%20%20%20%20%20%20%20%0A%20%20%20%20%20%20%20%20%20%20rdfs%3Alabel%20%3Flabel.%0A%20%20FILTER%28LANG%28%3Flabel%29%20IN%20%28%22es%22%29%29.%20%23%20tweak%20to%20taste%0A%20%20FILTER%28CONTAINS%28%3Flabel%2C%20%22Concepci%C3%B3n%20Arenal%22%29%29.%0A%20%3Fsitelink%20schema%3Aabout%20%3Fperson.%0A%20%20%3Fsitelink%20schema%3AinLanguage%20%22es%22.%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22es%22.%20%7D%20%20%0A%7D%0ALIMIT%201

const searchTitle = encodeURI(`${splitLine[COL_CLEAN_NAME]} ${splitLine[2]}`);
const sparqlQuery = `PREFIX%20schema%3A%20%3Chttp%3A%2F%2Fschema.org%2F%3E%0A%0ASELECT%20%3Fperson%20%3Fsitelink%20%3Flabel%20(LANG(%3Flabel)%20AS%20%3Flang)%0AWHERE%0A%7B%0A%20%20%3Fperson%20wdt%3AP21%20wd%3AQ6581072.%0A%20%20%3Fperson%20wdt%3AP31%20wd%3AQ5%3B%20%20%20%20%20%20%20%20%20%20%0A%20%20%20%20%20%20%20%20%20%20rdfs%3Alabel%20%3Flabel.%0A%20%20FILTER(LANG(%3Flabel)%20IN%20(%22es%22)).%20%23%20tweak%20to%20taste%0A%20%20FILTER(CONTAINS(%3Flabel%2C%20%22${searchTitle}%22)).%0A%20%3Fsitelink%20schema%3Aabout%20%3Fperson.%0A%20%20%3Fsitelink%20schema%3AinLanguage%20%22es%22.%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22es%22.%20%7D%20%20%0A%7D%0ALIMIT%201`;

myAxios
  .get(endpointUrl + '?format=json&query=' + sparqlQuery)
  .then(function (response) {
    if (
      response.data &&
      response.data.results &&
      response.data.results.bindings &&
      response.data.results.bindings.sitelink
    ) {
      console.log(response.data.results.bindings.sitelink.value);
      stream.write(`${line};${response.data.results.bindings.sitelink.value}`);
      stream.write('\n');

      lr.resume();
    } else {
      throw { error: `No pages found for ${decodeURI(searchTitle)}` };
    }
  })
  .catch(function (error) {
    console.log(error);
    stream.write(line);
    stream.write('\n');
    lr.resume();
  });
