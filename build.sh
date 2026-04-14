#!/bin/bash
set -e # Stop on error

echo "--- STARTING ANTIGRAVITY BUILD SYSTEM ---"

# 1. Setup environment
echo "Current directory: $(pwd)"
ls -la

# 2. Files check
if [ ! -f "index.html" ]; then echo "ERROR: index.html not found!"; exit 1; fi

# 3. Prepare Web Assets (Requirement for Capacitor)
echo "Preparing www folder..."
mkdir -p www
cp index.html www/
cp app.js www/ || echo "Warning: app.js missing"
cp style.css www/ || echo "Warning: style.css missing"
cp manifest.json www/ || echo "Warning: manifest.json missing"
cp sw.js www/ || echo "Warning: sw.js missing"

# 4. Install Capacitor CLI & Platforms
echo "Installing Capacitor..."
npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest

# 5. Initialize Capacitor Project
echo "Initializing Capacitor..."
rm -f capacitor.config.json || true
npx cap init Antigravity com.antigravity.mobile --web-dir www

# 6. Add Android Platform
echo "Adding Android platform..."
npx cap add android

# 7. Sync
echo "Syncing..."
npx cap sync android

echo "--- WEB TO ANDROID TRANSFORMATION COMPLETE ---"
