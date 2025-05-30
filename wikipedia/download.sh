#!/bin/bash

# Ansible managed: templates/lascallesmujeres-download-wikipedia.sh.j2 modified on 2025-05-30 by j on a2
# commit: 716f9ae

set -euo pipefail

# Ensure jq and curl are installed
if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed. Please install jq to run this script."
    exit 1
fi
if ! command -v curl &> /dev/null; then
    echo "curl is required but not installed. Please install curl to run this script."
    exit 1
fi

script_name=$(basename "$0")

# Get environment variables with default values
overwrite=${DOWNLOAD_OVERWRITE:-true}
destination_file="${DOWNLOAD_DESTINATION:-wikipedia.csv}"

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
    # Capture the name of this script
    log_message "Error executing ${script_name} on line $1"
    exit 1
}
trap 'error_exit $LINENO' ERR

# Check if the file already exists and if we should overwrite it
if [[ -f "$destination_file" && "$overwrite" != "true" ]]; then
    log_message "File ${destination_file} already exists. unset DOWNLOAD_OVERWRITE to overwrite it."
    exit 0
fi


log_message "Downloading wikipedia data for las calles de las mujeres into ${destination_file} with overwrite=${overwrite}"

# temporal file to store the downloaded data
temp_json=$(mktemp /tmp/mujeres.XXXXXX.json)

curl -s \
    https://qlever.cs.uni-freiburg.de/api/wikidata \
    -H "Accept: application/sparql-results+json" \
    -H "Content-type: application/sparql-query" \
    --data "PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wdt: <http://www.wikidata.org/prop/direct/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX schema: <http://schema.org/> PREFIX wikibase: <http://wikiba.se/ontology#> PREFIX bd: <http://www.bigdata.com/rdf#> SELECT DISTINCT ?item (sample(?itemLabel) as ?label) (MIN(?wikipediaPage) AS ?min_wikipediaPage) WHERE { ?item wdt:P31 wd:Q5 . ?item wdt:P21 wd:Q6581072 . ?wikipediaPage schema:about ?item ; schema:isPartOf ?wikipediaDomain . FILTER (?wikipediaDomain IN ( <https://es.wikipedia.org/>, <https://en.wikipedia.org/>, <https://ca.wikipedia.org/>, <https://fr.wikipedia.org/>)) ?item rdfs:label ?itemLabel } GROUP BY ?item"\
    > "${temp_json}"

# Check status code of the curl command
if [[ $? -ne 0 ]]; then
    log_message "Failed to download data from Wikipedia API"
    exit 1
fi

# Check if the file is empty
if [[ ! -s "${temp_json}" ]]; then
    log_message "Failed to download or empty response from Wikipedia API"
    exit 1
else
    log_message "Downloaded data to ${temp_json}"
fi

# Convert the temporary file into a CSV file
temp_csv=$(mktemp /tmp/mujeres.XXXXXX.csv)

log_message "Converting JSON ${temp_json} to CSV ${temp_csv}..."
jq -r '.results.bindings[] | .item?.value |= sub("http://www.wikidata.org/entity/" ; "") | [.item?.value, .label?.value, .min_wikipediaPage?.value] | @csv' "${temp_json}" > "${temp_csv}"

# Check if jq command was successful
if [[ $? -ne 0 ]]; then
    log_message "Failed to convert JSON ${temp_json} to CSV ${temp_csv}"
    exit 1
fi


# Ensure the destination directory exists
mkdir -p "$(dirname "$destination_file")"

# Move the temporary file to the final destination
mv "${temp_csv}" "${destination_file}"
chmod 644 "${destination_file}"

# Clean up the temporary JSON file
rm -f "${temp_json}"

log_message "Wikidata dump for Las Calles de Las Mujeres downloaded to ${destination_file}"
