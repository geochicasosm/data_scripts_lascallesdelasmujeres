# Creates the data directory
create_dir city:
    @echo "📂 Create city directory at data/{{ city }}"
    mkdir -p data/{{ city }}

# Downloads the city data from the Overpass API (creating the directory first)
download_data city relationID: (create_dir city)
    @echo "🌏 Downloading data for {{ city }} and relation {{relationID}}"
    npm run initial-step -- --city={{ city }} --relation={{ relationID }}
    @echo "OSM data downloaded 🎉"

# Enriches the CSV with wikipedia details
wikipedia city:
    @echo "📚 Getting wikipedia details for {{ city }}"
    npm run wikipedia-step -- --city={{ city }} --keepUnknown
    @echo "CSV is ready for manual review 👀 at data/{{ city }}/list_genderdize_wikipedia.csv 🎉"

# Run download_data and wikipedia recipe
process city relationID: (download_data city relationID) (wikipedia city)

# Finish the process
postprocess city:
    @echo "⚙ Finishing the processing of {{ city }}"
    npm run final-step -- --city={{ city }}
    tar czf data/{{ city }}.tar.gz data/{{ city }}
    @echo "File ready for submission.\n\n👉 data/{{ city }}.tar.gz 👈\n\n 🌈 Thanks!! 🌈"
