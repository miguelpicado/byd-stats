#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Checking for 'any' types in src/ directory...${NC}"

# Count 'any' occurrences (excluding node_modules, dist, and this script)
# grep options:
# -r: recursive
# -n: line numbers
# --include: only .ts and .tsx files
COUNT=$(grep -r ": any" src --include="*.ts" --include="*.tsx" | grep -v "eslint-disable" | wc -l)

echo -e "Total explicit 'any' types found: ${RED}$COUNT${NC}"

if [ "$COUNT" -gt 0 ]; then
    echo -e "\n${YELLOW}Top 10 files with most 'any' usage:${NC}"
    grep -r ": any" src --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort | uniq -c | sort -nr | head -n 10
else
    echo -e "${GREEN}🎉 No 'any' types found! Great job!${NC}"
fi

# Optional: Fail if count is above a threshold (uncomment to enforce)
# if [ "$COUNT" -gt 50 ]; then
#     echo -e "${RED}Error: Too many 'any' types (Threshold: 50)${NC}"
#     exit 1
# fi
