#!/usr/bin/env python3
"""
Debug test for importer
"""
import sys
print("1. Starting imports...")
sys.stdout.flush()

import os
print("2. os imported")
sys.stdout.flush()

import sqlite3
print("3. sqlite3 imported")
sys.stdout.flush()

import requests
print("4. requests imported")
sys.stdout.flush()

import time
print("5. time imported")
sys.stdout.flush()

from datetime import datetime
print("6. datetime imported")
sys.stdout.flush()

print("7. Creating session...")
sys.stdout.flush()

session = requests.Session()
session.headers.update({
    'User-Agent': 'Test'
})
print("8. Session created")
sys.stdout.flush()

print("9. Testing MusicBrainz connection...")
sys.stdout.flush()

try:
    response = session.get('https://musicbrainz.org/ws/2/recording/', params={
        'query': 'tag:IDM',
        'fmt': 'json',
        'limit': 10,
        'offset': 0
    }, timeout=5)
    print(f"10. Response: {response.status_code}")
    sys.stdout.flush()
    print(f"11. Got {len(response.json().get('recordings', []))} songs")
    sys.stdout.flush()
except Exception as e:
    print(f"ERROR: {e}")
    sys.stdout.flush()
