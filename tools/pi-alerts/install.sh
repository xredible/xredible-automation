#!/bin/bash
# Pi alerts installer: Telegram messages for SSH logins, fail2ban bans and a daily 08:00 summary.
# Needs /etc/pi-alerts/env (root, 600) with TOKEN=<bot token> and CHAT_ID=<your chat id>. No secrets in this file.
set -e
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
[ -f /etc/pi-alerts/env ] || { echo "Missing /etc/pi-alerts/env (TOKEN and CHAT_ID)"; exit 1; }

cat > /usr/local/bin/pi-alert <<'EOF'
#!/bin/bash
. /etc/pi-alerts/env
curl -s --max-time 10 -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" -d chat_id="$CHAT_ID" --data-urlencode text="$*" -d disable_web_page_preview=true >/dev/null
EOF

cat > /usr/local/bin/pi-ssh-alert <<'EOF'
#!/bin/bash
[ "$PAM_TYPE" = "open_session" ] || exit 0
/usr/local/bin/pi-alert "🔐 SSH login on Pi: $PAM_USER from ${PAM_RHOST:-unknown} at $(date '+%d %b %H:%M')" &
exit 0
EOF

cat > /usr/local/bin/pi-daily <<'EOF'
#!/bin/bash
temp=$(vcgencmd measure_temp 2>/dev/null | cut -d= -f2)
disk=$(df -h / | awk 'NR==2{print $5" used, "$4" free"}')
bans=$(fail2ban-client status sshd 2>/dev/null | awk -F'\t' '/Total banned/{print $2}')
upd=$(grep -h "Packages that will be upgraded" /var/log/unattended-upgrades/unattended-upgrades.log 2>/dev/null | awk -v d="$(date -d yesterday +%F)" '$1>=d' | sed 's/.*upgraded: //' | tr '\n' ' ')
down=$(docker ps -a --filter status=exited --format '{{.Names}}' | tr '\n' ' ')
rb=""; [ -f /var/run/reboot-required ] && rb="⚠️ Reboot needed to finish updates"
/usr/local/bin/pi-alert "🌅 Pi morning check
🌡 ${temp:-?} · 💾 $disk
⏱ $(uptime -p)
🚫 SSH bans since last restart: ${bans:-0}
📦 Updates (24h): ${upd:-none}
🐳 Stopped containers: ${down:-none}
$rb"
EOF

chmod 755 /usr/local/bin/pi-alert /usr/local/bin/pi-ssh-alert /usr/local/bin/pi-daily

grep -q pi-ssh-alert /etc/pam.d/sshd || echo 'session optional pam_exec.so /usr/local/bin/pi-ssh-alert' >> /etc/pam.d/sshd

cat > /etc/fail2ban/action.d/telegram.conf <<'EOF'
[Definition]
actionban = /usr/local/bin/pi-alert "🚫 Pi banned <ip> after repeated failed logins (<name>)"
actionunban =
EOF

cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1 192.168.0.0/16 100.64.0.0/10
backend = systemd

[sshd]
enabled = true
action = %(action_)s
         telegram
EOF
systemctl restart fail2ban

echo '0 8 * * * root /usr/local/bin/pi-daily' > /etc/cron.d/pi-alerts
chmod 644 /etc/cron.d/pi-alerts
echo "Installed. Test: sudo /usr/local/bin/pi-alert test && sudo /usr/local/bin/pi-daily"
