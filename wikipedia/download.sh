#!/bin/bash

# Script to download Wikipedia data for Las Calles de Las Mujeres
# This script downloads data from the Wikidata API and processes it into a CSV file.
#
#
# The final ouput is a CSV with the following columns:
# - item (Wikidata ID)
# - name (name in Spanish)
# - alt_names (alternative names in all official languages in Spain)
# - professions (professions in Spanish)
# - is_human (Yes/No)
# - is_saint (Yes/No)
# - birth (birth date)
# - death (death date)
# - wiki_es (Spanish Wikipedia link, without the "https://es.wikipedia.org/wiki/" prefix)
# - wiki_ca (Catalan Wikipedia link, without the "https://ca.wikipedia.org/wiki/" prefix)
# - wiki_gl (Galician Wikipedia link, without the "https://gl.wikipedia.org/wiki/" prefix)
# - wiki_eu (Basque Wikipedia link, without the "https://eu.wikipedia.org/wiki/" prefix)
#
# see show_help() for usage information

script_name=$(basename "$0")

# Help function to display usage
function show_help {
    echo "Usage: $script_name"
    echo "Download Wikipedia data for Las Calles de Las Mujeres."
    echo ""
    echo "Use the following environment variables to configure the script:"
    printf "  DOWNLOAD_OVERWRITE=true|false\t\tOverwrite the destination file if it exists (default: true)\n"
    printf "  DOWNLOAD_DESTINATION=path/to/file\tDestination file to save the downloaded data (default: wikipedia.csv)\n"
    printf "  KEEP_TEMP=true|false\t\t\tKeep temporary files after download (default: false)\n\n"
}

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

set -euo pipefail

# Get environment variables with default values
overwrite=${DOWNLOAD_OVERWRITE:-true}
destination_file="${DOWNLOAD_DESTINATION:-wikipedia.csv}"
keep_temp=${KEEP_TEMP:-false}

# Function to echo and log messages
function log_message {
    local message="$1"
    # if logger command is available, use it to log messages
    if command -v logger &> /dev/null; then
        logger "[$script_name] $message"
    fi
    # Log to console with timestamp
    echo "$(date "+%H:%M:%S") $message"
}

# Function to capture error before exiting
function error_exit {
    local line_number="$1"
    local additional_info="${2:-}"
    log_message "🛑 An error occurred in ${script_name} at line ${line_number}. ${additional_info}"
    exit 1
}
trap 'error_exit $LINENO' ERR


# Ensure jq and curl are installed
if ! command -v sed &> /dev/null; then
    error_exit 55 "sed is required but not installed. Please install jq to run this script."
fi
if ! command -v curl &> /dev/null; then
    error_exit 58 "curl is required but not installed. Please install curl to run this script."
fi

# Check if the file already exists and if we should overwrite it
if [[ -f "$destination_file" && "$overwrite" != "true" ]]; then
    log_message "✋ File ${destination_file} already exists, skipping."
    exit 0
fi

# temporal file to store the downloaded data
temp_csv=$(mktemp /tmp/mujeres.XXXXXX.csv)

log_message "🌐 Downloading wikipedia data for las calles de las mujeres into ${temp_csv}"

# Test values to put after the WHERE to run this against just a few values
# VALUES ?item { wd:Q345 wd:Q164294 wd:Q174880 wd:Q3321142 wd:Q35500 wd:Q50634772 wd:Q20666410 wd:Q7186}
# URL to debug the query in the browser:
# https://qlever.cs.uni-freiburg.de/wikidata/?query=PREFIX+wd%3A+%3Chttp%3A%2F%2Fwww.wikidata.org%2Fentity%2F%3E%0APREFIX+wdt%3A+%3Chttp%3A%2F%2Fwww.wikidata.org%2Fprop%2Fdirect%2F%3E%0APREFIX+rdfs%3A+%3Chttp%3A%2F%2Fwww.w3.org%2F2000%2F01%2Frdf-schema%23%3E%0APREFIX+schema%3A+%3Chttp%3A%2F%2Fschema.org%2F%3E%0APREFIX+wikibase%3A+%3Chttp%3A%2F%2Fwikiba.se%2Fontology%23%3E%0APREFIX+bd%3A+%3Chttp%3A%2F%2Fwww.bigdata.com%2Frdf%23%3E%0ASELECT+%0A++%3Fitem+%0A++%28SAMPLE%28%3FitemLabelEs%29+AS+%3Fname%29%0A++%28GROUP_CONCAT%28DISTINCT+STR%28%3FitemLabelsAll%29%3B+SEPARATOR%3D%22+%7C+%22%29+AS+%3Falt_names%29%0A++%28GROUP_CONCAT%28DISTINCT+%3Fprofession%3B+SEPARATOR%3D%22%2C+%22%29+AS+%3Fprofessions%29%0A++%28SAMPLE%28%3FisHuman_%29+AS+%3Fis_human%29+%0A++%28SAMPLE%28%3FisSaint_%29+AS+%3Fis_saint%29+%0A++%28SAMPLE%28%3FbirthDate_%29+AS+%3Fbirth%29%0A++%28SAMPLE%28%3FdeathDate_%29+AS+%3Fdeath%29%0A++%28SAMPLE%28%3FlinkEs%29+AS+%3Fwiki_es%29%0A++%28SAMPLE%28%3FlinkCa%29+AS+%3Fwiki_ca%29%0A++%28SAMPLE%28%3FlinkGl%29+AS+%3Fwiki_gl%29%0A++%28SAMPLE%28%3FlinkEu%29+AS+%3Fwiki_eu%29%0A++%28COUNT%28DISTINCT+%3Foutgoing%29+AS+%3Fout%29%0AWHERE+%7B%0A++%23+TEST+VALUES%0A++%23+Santa+Mary%2C+Anne%2C+St+Teresa%2C+Clara+Campoamor%2C+Aprhodite%2C+DIA%2C+Catherine+Fournier%2C+Marie+Curie%2C+Maria+Xirau%2C+Hunter+Schafer%0A++%23+VALUES+%3Fitem+%7B+wd%3AQ345+wd%3AQ164294+wd%3AQ174880+wd%3AQ3321142+wd%3AQ35500+wd%3AQ50634772+wd%3AQ20666410+wd%3AQ7186+wd%3AQ100154039+wd%3AQ59248250+%7D%0A++%0A++%23+Main+filter%3A+female+and+transgender+woman+characters%0A++%7B+%3Fitem+wdt%3AP21+wd%3AQ6581072+.%0A+%7D+UNION+%7B+%3Fitem+wdt%3AP21+wd%3AQ1052281+.%0A+%7D%0A++%0A++%23+Get+the+Wikipedia+entry+in+Spanish%2C+Catalan%2C+or+Galician%2C+Euskara+%28at+least+one+is+required%29%0A++OPTIONAL+%7B+%3FlinkEs+schema%3Aabout+%3Fitem+%3B%0A++++++++++++schema%3AisPartOf+%3Chttps%3A%2F%2Fes.wikipedia.org%2F%3E+.%0A++++%3FlinkEs+%3Chttp%3A%2F%2Fschema.org%2Fname%3E+%3FesLabel+.%0A+%7D+%0A++OPTIONAL+%7B+%3FlinkCa+schema%3Aabout+%3Fitem+%3B%0A++++++++++++schema%3AisPartOf+%3Chttps%3A%2F%2Fca.wikipedia.org%2F%3E+.%0A++++%3FlinkCa+%3Chttp%3A%2F%2Fschema.org%2Fname%3E+%3FcaLabel+.%0A+%7D%0A++OPTIONAL+%7B+%3FlinkGl+schema%3Aabout+%3Fitem+%3B%0A++++++++++++schema%3AisPartOf+%3Chttps%3A%2F%2Fgl.wikipedia.org%2F%3E+.%0A++++%3FlinkGl+%3Chttp%3A%2F%2Fschema.org%2Fname%3E+%3FglLabel+.%0A+%7D%0A++OPTIONAL+%7B+%3FlinkEu+schema%3Aabout+%3Fitem+%3B%0A++++++++++++schema%3AisPartOf+%3Chttps%3A%2F%2Feu.wikipedia.org%2F%3E+.%0A++++%3FlinkEu+%3Chttp%3A%2F%2Fschema.org%2Fname%3E+%3FeuLabel+.%0A+%7D%0A++FILTER%28+%3FlinkEs+%7C%7C+%3FlinkGl+%7C%7C+%3FlinkCa+%7C%7C+%3FlinkEu+%29.%0A++%23+Labels%0A++OPTIONAL+%7B+%3Fitem+rdfs%3Alabel+%3FitemLabelEs.+%0A++++FILTER+%28LANG%28%3FitemLabelEs%29+%3D+%22es%22%29.%0A+%7D%0A++%23+Try+to+get+labels+from+official+languages%0A++OPTIONAL+%7B+%7B+%3Fitem+rdfs%3Alabel+%3FitemLabelAll.%0A++++++FILTER+%28LANG%28%3FitemLabelAll%29+%3D+%22es%22%29.%0A+%7D+UNION+%7B+%3Fitem+rdfs%3Alabel+%3FitemLabelAll.%0A++++++FILTER+%28LANG%28%3FitemLabelAll%29+%3D+%22ca%22%29.%0A+%7D+UNION+%7B+%3Fitem+rdfs%3Alabel+%3FitemLabelAll.%0A++++++FILTER+%28LANG%28%3FitemLabelAll%29+%3D+%22gl%22%29.%0A+%7D+UNION+%7B+%3Fitem+rdfs%3Alabel+%3FitemLabelAll.%0A++++++FILTER+%28LANG%28%3FitemLabelAll%29+%3D+%22eu%22%29.%0A+%7D%0A+%7D%0A++%23+Fallback+to+the+labels+from+URLs%0A++BIND%28COALESCE%28%3FitemLabelAll%2C+%3FesLabel%2C+%3FcaLabel%2C+%3FglLabel%2C+%3FeuLabel%2C+%22%3F%22%29+AS+%3FitemLabelsAll%29%0A++%23+Professions+%28to+aggregate%29%0A++OPTIONAL+%7B+%3Fitem+wdt%3AP106+%3Fprofession_id+.%0A++++%3Fprofession_id+rdfs%3Alabel+%3Fprofession+.%0A++++FILTER+%28LANG%28%3Fprofession%29+%3D+%22es%22%29+.%0A+%7D%0A++%23+Human+check%0A++OPTIONAL+%7B+%3Fitem+wdt%3AP31%2Fwdt%3AP279%2A+wd%3AQ7048977.+%0A++++BIND%28%22No%22+AS+%3FhumanStatus%29%0A+%7D%0A++BIND%28COALESCE%28%3FhumanStatus%2C+%22Yes%22%29+AS+%3FisHuman_%29%0A++%23+Saint+check%0A++OPTIONAL+%7B+%3Fitem+wdt%3AP411%2Fwdt%3AP279%2A+wd%3AQ43115.%0A++++BIND%28%22Yes%22+AS+%3FsaintStatus%29%0A+%7D%0A++BIND%28COALESCE%28%3FsaintStatus%2C+%22No%22%29+AS+%3FisSaint_%29%0A++%23+Birth+date%0A++OPTIONAL+%7B+%3Fitem+wdt%3AP569+%3FbirthDate_+.+%7D%0A++%23+Death+date%0A++OPTIONAL+%7B+%3Fitem+wdt%3AP570+%3FdeathDate_+.+%7D%0A++%23+Count+outgoing+links%0A++OPTIONAL+%7B+%3Foutgoing+schema%3Aabout+%3Fitem+.+%7D%0A%7D%0AGROUP+BY+%3Fitem%0A
curl -s\
    https://qlever.cs.uni-freiburg.de/api/wikidata?action=csv_export \
    -H "Content-type: application/sparql-query" \
    --data "PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wdt: <http://www.wikidata.org/prop/direct/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX schema: <http://schema.org/> PREFIX wikibase: <http://wikiba.se/ontology#> PREFIX bd: <http://www.bigdata.com/rdf#> SELECT ?item (SAMPLE(?itemLabelEs) AS ?name) (GROUP_CONCAT(DISTINCT STR(?itemLabelsAll); SEPARATOR=\" | \") AS ?alt_names) (GROUP_CONCAT(DISTINCT ?profession; SEPARATOR=\", \") AS ?professions) (SAMPLE(?isHuman_) AS ?is_human) (SAMPLE(?isSaint_) AS ?is_saint) (SAMPLE(?birthDate_) AS ?birth) (SAMPLE(?deathDate_) AS ?death) (SAMPLE(?linkEs) AS ?wiki_es) (SAMPLE(?linkCa) AS ?wiki_ca) (SAMPLE(?linkGl) AS ?wiki_gl) (SAMPLE(?linkEu) AS ?wiki_eu) (COUNT(DISTINCT ?outgoing) AS ?out) WHERE { { ?item wdt:P21 wd:Q6581072 } UNION { ?item wdt:P21 wd:Q1052281 } OPTIONAL { ?linkEs schema:about ?item ; schema:isPartOf <https://es.wikipedia.org/> . ?linkEs <http://schema.org/name> ?esLabel } OPTIONAL { ?linkCa schema:about ?item ; schema:isPartOf <https://ca.wikipedia.org/> . ?linkCa <http://schema.org/name> ?caLabel } OPTIONAL { ?linkGl schema:about ?item ; schema:isPartOf <https://gl.wikipedia.org/> . ?linkGl <http://schema.org/name> ?glLabel } OPTIONAL { ?linkEu schema:about ?item ; schema:isPartOf <https://eu.wikipedia.org/> . ?linkEu <http://schema.org/name> ?euLabel } FILTER( ?linkEs || ?linkGl || ?linkCa || ?linkEu ). OPTIONAL { ?item rdfs:label ?itemLabelEs. FILTER (LANG(?itemLabelEs) = \"es\") } OPTIONAL { { ?item rdfs:label ?itemLabelAll. FILTER (LANG(?itemLabelAll) = \"es\") } UNION { ?item rdfs:label ?itemLabelAll. FILTER (LANG(?itemLabelAll) = \"ca\") } UNION { ?item rdfs:label ?itemLabelAll. FILTER (LANG(?itemLabelAll) = \"gl\") } UNION { ?item rdfs:label ?itemLabelAll. FILTER (LANG(?itemLabelAll) = \"eu\") } } BIND(COALESCE(?itemLabelAll, ?esLabel, ?caLabel, ?glLabel, ?euLabel, \"?\") AS ?itemLabelsAll) OPTIONAL { ?item wdt:P106 ?profession_id . ?profession_id rdfs:label ?profession . FILTER (LANG(?profession) = \"es\") } OPTIONAL { ?item wdt:P31/wdt:P279* wd:Q7048977. BIND(\"No\" AS ?humanStatus) } BIND(COALESCE(?humanStatus, \"Yes\") AS ?isHuman_) OPTIONAL { ?item wdt:P411/wdt:P279* wd:Q43115. BIND(\"Yes\" AS ?saintStatus) } BIND(COALESCE(?saintStatus, \"No\") AS ?isSaint_) OPTIONAL { ?item wdt:P569 ?birthDate_ } OPTIONAL { ?item wdt:P570 ?deathDate_ } OPTIONAL { ?outgoing schema:about ?item } } GROUP BY ?item" \
    > "${temp_csv}"


# Check status code of the curl command
# shellcheck disable=SC2181
if [[ $? -ne 0 ]]; then
    error_exit 84 "Failed to download data from Wikipedia API"
fi

# Check if the file is empty
if [[ ! -s "${temp_csv}" ]]; then
    error_exit 89 "Empty response from Wikipedia API"
else
    log_message "✅ Downloaded data to ${temp_csv}"
fi

temp_csv2=$(mktemp /tmp/mujeres.XXXXXX.csv)

log_message "⚙ Processing output into ${temp_csv2}..."

sed  -e 's/http:\/\/www\.wikidata\.org\/entity\///g' \
     -e 's/https:\/\/..\.wikipedia\.org\/wiki\///g' \
    > "${temp_csv2}" < "${temp_csv}"

# Ensure the destination directory exists
mkdir -p "$(dirname "$destination_file")"

# Move the temporary file to the final destination
cp "${temp_csv2}" "${destination_file}"
chmod 644 "${destination_file}"

# Clean up files
if [[ ${keep_temp} == false ]]; then
  log_message "⚠ Removing temporal files"
  rm -f "${temp_csv}"
  rm -f "${temp_csv2}"
else
  log_message "⚠ Temporal files preserved"
  printf "  - %s\n" "${temp_csv}" "${temp_csv2}"
fi

log_message "✅ Wikidata dump for Las Calles de Las Mujeres downloaded to ${destination_file}"
