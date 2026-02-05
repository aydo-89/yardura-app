#!/bin/bash
cd "$(dirname "$0")"

# Fix city page
sed -i.bak \
  -e 's/InsightScoop pass or Bluetooth quick-log visit/visit/g' \
  -e 's/Bluetooth quick-log pickup/quick mid-week pickup/g' \
  -e 's/Bluetooth-logged timestamps/timestamped logs/g' \
  -e 's/Bluetooth shutter support means techs log every pickup without pulling out a phone in Minnesota winters/Every pickup is logged automatically—no fumbling with phones in Minnesota winters/g' \
  -e 's/InsightCamera overlays coach techs to capture at least three AI-ready samples per visit for actionable vet insights/Our AI captures and analyzes stool samples each visit, giving you actionable health insights to share with your vet/g' \
  -e 's/Neighborhood playbooks/Explore Neighborhoods/g' \
  -e 's/neighborhood playbook/Neighborhood Guide/g' \
  -e 's/View neighborhood playbook/Explore this area/g' \
  -e 's/Book your InsightScoop onboarding/Schedule your first visit/g' \
  -e 's/Every InsightScoop technician captures stool images in our InsightCamera/Every InsightScoop technician captures stool images/g' \
  -e 's/InsightScoop technicians log Bluetooth pickups and AI stool summaries/InsightScoop technicians log pickups and capture AI stool summaries/g' \
  -e 's/We build repeatable visit flows—Bluetooth quick logs, AI InsightCamera sessions/We build repeatable visit flows—automated logging, AI health analysis/g' \
  'src/app/city/[slug]/page.tsx'

# Fix neighborhood page
sed -i.bak \
  -e 's/Bluetooth quick-log pickup/quick mid-week pickup/g' \
  -e 's/What does the AI InsightCamera look for/What does InsightScoop.s AI look for/g' \
  -e 's/proof of gear/proof photos/g' \
  -e 's/neighborhood playbook/Neighborhood Guide/g' \
  -e 's/Neighborhood playbook/Neighborhood Guide/g' \
  -e 's/Bluetooth logging/automated logging/g' \
  'src/app/city/[slug]/[neighborhood]/page.tsx'

echo "SEO fixes applied"
