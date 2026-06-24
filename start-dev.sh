#!/bin/bash
cd /home/mayanksharma/Desktop/flowmind
kill $(lsof -t -i:3000) 2>/dev/null
sleep 1
pnpm --filter @flowmind/web dev --port 3000 > /tmp/flowmind-dev.log 2>&1
