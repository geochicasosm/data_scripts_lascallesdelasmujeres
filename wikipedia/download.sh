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
curl -s\
    https://qlever.cs.uni-freiburg.de/api/wikidata?action=csv_export \
    -H "Content-type: application/sparql-query" \
    --data "PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wdt: <http://www.wikidata.org/prop/direct/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX schema: <http://schema.org/> PREFIX wikibase: <http://wikiba.se/ontology#> PREFIX bd: <http://www.bigdata.com/rdf#> SELECT ?item (SAMPLE(?itemLabelEs) AS ?name) (GROUP_CONCAT(DISTINCT STR(?itemLabelsAll); SEPARATOR=\" | \") AS ?alt_names) (GROUP_CONCAT(DISTINCT ?profession; SEPARATOR=\", \") AS ?professions) (SAMPLE(?isHuman_) AS ?is_human) (SAMPLE(?isSaint_) AS ?is_saint) (SAMPLE(?birthDate_) AS ?birth) (SAMPLE(?deathDate_) AS ?death) (SAMPLE(?linkEs) AS ?wiki_es) (SAMPLE(?linkCa) AS ?wiki_ca) (SAMPLE(?linkGl) AS ?wiki_gl) (SAMPLE(?linkEu) AS ?wiki_eu) WHERE { ?item wdt:P21 wd:Q6581072 . OPTIONAL { ?linkEs schema:about ?item ; schema:isPartOf <https://es.wikipedia.org/> . ?linkEs <http://schema.org/name> ?esLabel } OPTIONAL { ?linkCa schema:about ?item ; schema:isPartOf <https://ca.wikipedia.org/> . ?linkCa <http://schema.org/name> ?caLabel } OPTIONAL { ?linkGl schema:about ?item ; schema:isPartOf <https://gl.wikipedia.org/> . ?linkGl <http://schema.org/name> ?glLabel } OPTIONAL { ?linkEu schema:about ?item ; schema:isPartOf <https://eu.wikipedia.org/> . ?linkEu <http://schema.org/name> ?euLabel } FILTER( ?linkEs || ?linkGl || ?linkCa || ?linkEu ). OPTIONAL { ?item rdfs:label ?itemLabelEs. FILTER (LANG(?itemLabelEs) = \"es\") } OPTIONAL { { ?item rdfs:label ?itemLabelAll. FILTER (LANG(?itemLabelAll) = \"es\") } UNION { ?item rdfs:label ?itemLabelAll. FILTER (LANG(?itemLabelAll) = \"ca\") } UNION { ?item rdfs:label ?itemLabelAll. FILTER (LANG(?itemLabelAll) = \"gl\") } UNION { ?item rdfs:label ?itemLabelAll. FILTER (LANG(?itemLabelAll) = \"eu\") } } BIND(COALESCE(?itemLabelAll, ?esLabel, ?caLabel, ?glLabel, ?euLabel, \"?\") AS ?itemLabelsAll) OPTIONAL { ?item wdt:P106 ?profession_id . ?profession_id rdfs:label ?profession . FILTER (LANG(?profession) = \"es\") } OPTIONAL { ?item wdt:P31/wdt:P279* wd:Q7048977. BIND(\"No\" AS ?humanStatus) } BIND(COALESCE(?humanStatus, \"Yes\") AS ?isHuman_) OPTIONAL { ?item wdt:P411/wdt:P279* wd:Q43115. BIND(\"Yes\" AS ?saintStatus) } BIND(COALESCE(?saintStatus, \"No\") AS ?isSaint_) OPTIONAL { ?item wdt:P569 ?birthDate_ } OPTIONAL { ?item wdt:P570 ?deathDate_ } } GROUP BY ?item"\
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
