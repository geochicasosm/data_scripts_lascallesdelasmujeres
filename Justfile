# Creates the data directory
create_dir city:
    @echo "📂 Create city directory at data/{{ city }}"
    mkdir -p data/{{ city }}

# List available Overpass API servers
list-servers:
    @echo "📡 Available Overpass API servers:"
    npm run list-servers

# Clear cached data for a city (forces re-download)
clear_cache city:
    @echo "🗑️  Clearing cached data for {{ city }}"
    @if [ -d "data/{{ city }}" ]; then \
        echo "Removing data/{{ city }}/"; \
        rm -rf data/{{ city }}; \
        echo "✅ Cache cleared for {{ city }}"; \
    else \
        echo "ℹ️  No cached data found for {{ city }}"; \
    fi

# Clear only grid cache for a city (preserves boundary and final outputs)
clear_grid_cache city:
    @echo "🗑️  Clearing intermediate grid cache for {{ city }}"
    @if [ -d "data/{{ city }}" ]; then \
        find data/{{ city }} -name "grid_*.geojson" -delete 2>/dev/null || true; \
        echo "✅ Grid cache cleared for {{ city }} (boundary and final outputs preserved)"; \
        echo "💡 Final streets.geojson preserved - use 'just clear_cache {{ city }}' to remove everything"; \
    else \
        echo "ℹ️  No data directory found for {{ city }}"; \
    fi

# Show cache status for a city  
cache_status city:
    @echo "📊 Cache status for {{ city }}:"
    @if [ -d "data/{{ city }}" ]; then \
        echo "📁 Data directory: data/{{ city }}/"; \
        ls -la "data/{{ city }}/" | grep -E "\.(geojson|csv)$$" || echo "   (no cache files found)"; \
    else \
        echo "❌ No data directory found for {{ city }}"; \
    fi

# Downloads the city data from the Overpass API (creating the directory first)
# The script uses internal caching: existing boundary/streets/grid files are reused automatically.
# To force a full re-download, run: just clear_cache city
download_data city relationID: (create_dir city)
    @echo "🌏 Downloading data for {{ city }} and relation {{relationID}}"
    npm run initial-step -- --city={{ city }} --relation={{ relationID }}
    @if [ ! -f "data/{{ city }}/list_genderize.csv" ]; then \
        echo "❌ ERROR: Data download failed - list_genderize.csv not created"; \
        exit 1; \
    fi
    @echo "OSM data ready 🎉"

# Enriches the CSV with wikipedia details
wikipedia city:
    @if [ ! -f "data/{{ city }}/list_genderize.csv" ]; then \
        echo "❌ ERROR: Cannot run wikipedia step - data/{{ city }}/list_genderize.csv not found"; \
        echo "Please run the download_data step first: just download_data {{ city }} <relationID>"; \
        exit 1; \
    fi
    @echo "📚 Getting wikipedia details for {{ city }}"
    npm run wikipedia-step -- --city={{ city }} --keepUnknown
    @echo "CSV is ready for manual review 👀 at data/{{ city }}/list_genderize_wikipedia.csv 🎉"

# Run download_data and wikipedia recipe
process city relationID: (download_data city relationID) (wikipedia city)
    @echo "📦 Compressing the data for {{ city }} to send it to the volunteers"
    tar czf data/{{ city }}.for_review.tar.gz data/{{ city }}

# Finish the process
postprocess city:
    @echo "⚙ Finishing the processing of {{ city }}"
    npm run final-step -- --city={{ city }}
    tar czf data/{{ city }}.for_publishing.tar.gz data/{{ city }}
    @echo "File ready for submission.\n\n👉 data/{{ city }}.tar.gz 👈\n\n 🌈 Thanks!! 🌈"
