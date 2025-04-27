# Creates the data directory
create_dir target:
    @echo "Step 1: Create target directory at data/{{target}}"
    mkdir -p data/{{target}}

# Downloads the city data from the Overpass API
download_data target relationID: (create_dir target)
    @echo "Downloading data for {{target}} and relation {{relationID}}"
    npm run initial-step -- --city={{ target }} --relation={{ relationID }}

# Enriches the CSV with wikipedia details
wikipedia target relationID: (download_data target relationID)
    @echo "Getting wikipedia details for {{target}}"
    npm run wikipedia-step -- --city={{target}} --keepUnknown

# Finish the process
process target relationID: (wikipedia target relationID)
    @echo "Finishing the processing of {{target}}"
    npm run final-step -- --city={{ target }}
