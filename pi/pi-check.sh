#!/bin/bash
# Read-only check of the Pi: disks, what uses space, where the nightly n8n backup lands. Changes nothing.
echo "=== DISKS ==="; lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT,LABEL,MODEL; echo; df -h -x tmpfs -x devtmpfs
echo; echo "=== FSTAB ==="; grep -v '^#' /etc/fstab
echo; echo "=== BIGGEST FOLDERS ON THE MEMORY CARD ==="; sudo du -xh --max-depth=3 / 2>/dev/null | sort -rh | head -30
echo; echo "=== HOME ==="; du -sh ~/* ~/.??* 2>/dev/null | sort -rh | head -25
echo; echo "=== SCHEDULED JOBS ==="; crontab -l 2>/dev/null; for f in /etc/cron.d/*; do echo "--- $f"; grep -v '^#' "$f"; done; systemctl list-timers --all --no-pager | head -20; systemctl --user list-timers --all --no-pager 2>/dev/null | head -10
echo; echo "=== BACKUP FILES (over 10 MB) ==="; sudo find / -xdev -type f -size +10M \( -iname '*backup*' -o -iname '*.tgz' -o -iname '*.tar*' -o -iname '*.sqlite*' -o -iname '*.db' \) -printf '%TY-%Tm-%Td %10s  %p\n' 2>/dev/null | sort | tail -40
echo; echo "=== BACKUP SCRIPTS ==="; sudo grep -rls -i -E 'n8n.*backup|backup.*n8n|scp|rsync' /etc/cron.d ~ /usr/local/bin 2>/dev/null | grep -v -E '/\.(cache|npm|local/share)/' | head -15
echo; echo "=== DOCKER ==="; docker ps -a 2>/dev/null; docker system df 2>/dev/null
echo; echo "=== LOGS / CACHES ==="; journalctl --disk-usage 2>/dev/null; sudo du -sh /var/cache/apt /var/log ~/.cache ~/.npm /tmp 2>/dev/null
