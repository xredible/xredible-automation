#!/usr/bin/env bash
# Native Debian arm64 install. Does not change ufw, Docker, cloudflared or n8n.
set -euo pipefail
set +x  # Never trace a key, even if invoked with bash -x.
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run with sudo bash.' >&2; exit 1; }
[[ $(uname -m) == aarch64 || $(uname -m) == arm64 ]] || { echo 'Requires 64-bit Debian arm64 on the Pi.' >&2; exit 1; }
[[ -r /dev/tty ]] || { echo 'Run from an interactive terminal; a hidden key prompt is required.' >&2; exit 1; }
command -v systemctl >/dev/null || { echo 'systemd is required.' >&2; exit 1; }
ref=main
if [[ $# == 2 && $1 == --ref ]]; then ref=$2; elif [[ $# != 0 ]]; then echo 'Usage: sudo bash install.sh [--ref COMMIT_SHA]' >&2; exit 1; fi
[[ $ref == main || $ref =~ ^[a-f0-9]{40}$ ]] || { echo 'Use main or an immutable 40-character commit SHA.' >&2; exit 1; }
available_kb=$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)
(( available_kb >= 4 * 1024 * 1024 )) || { echo 'Need at least 4 GiB currently available RAM; an 8/16 GiB Pi is recommended. Free memory before retrying.' >&2; exit 1; }
free_kb=$(df -Pk /opt | awk 'NR==2{print $4}')
(( free_kb >= 8 * 1024 * 1024 )) || { echo 'Need at least 8 GiB free disk space on the /opt filesystem.' >&2; exit 1; }
if command -v ss >/dev/null && ss -H -ltn 'sport = :8099' | read -r _; then
    systemctl is-active --quiet ai-detector || { echo 'Port 8099 is already used by another service.' >&2; exit 1; }
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip curl ca-certificates libgomp1
python3 -c 'import sys; assert sys.version_info >= (3,11), "Python 3.11+ required"'
id ai-detector >/dev/null 2>&1 || useradd --system --home-dir /var/lib/ai-detector --create-home --shell /usr/sbin/nologin ai-detector
install -d -m 755 /opt/ai-detector/releases /var/lib/ai-detector
install -d -m 700 /etc/ai-detector
install -d -m 700 -o ai-detector -g ai-detector /var/lib/ai-detector/cache
release=$(mktemp -d /opt/ai-detector/releases/install-XXXXXXXX)
chmod 755 "$release"
cleanup() { unset detector_key; }
trap cleanup EXIT
base="https://raw.githubusercontent.com/xredible/xredible-automation/$ref/tools/ai-detector"
for file in app.py jobs.py serve.py constants.py text.py engine.py model.py download_model.py client_test.py requirements.txt ai-detector.service README.md THIRD_PARTY.md; do
    curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 "$base/$file" -o "$release/$file"
    chmod 644 "$release/$file"
done
python3 -m venv "$release/venv"
# On aarch64 the PyPI torch wheel is CPU-only. Never install a CUDA index or build PyTorch on the Pi.
"$release/venv/bin/pip" install --disable-pip-version-check --no-cache-dir --only-binary=:all: -r "$release/requirements.txt"
chmod -R a+rX "$release"
model_revision=$(/usr/bin/python3 -c 'import sys;sys.path.insert(0,sys.argv[1]);from constants import MODEL_REVISION;print(MODEL_REVISION)' "$release")
if [[ ! -f /var/lib/ai-detector/model/REVISION ]] || [[ $(cat /var/lib/ai-detector/model/REVISION) != "$model_revision" ]]; then
    staging=$(mktemp -d /var/lib/ai-detector/model-install-XXXXXXXX)
    chown ai-detector:ai-detector "$staging"
    runuser -u ai-detector -- env HF_HOME=/var/lib/ai-detector/cache HF_HUB_DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 \
        "$release/venv/bin/python" "$release/download_model.py" "$staging"
    chown -R root:root "$staging"
    chmod -R a+rX "$staging"
    if [[ -d /var/lib/ai-detector/model ]]; then
        systemctl stop ai-detector
        mv /var/lib/ai-detector/model "/var/lib/ai-detector/model-backup-$(date +%s)"
    fi
    mv "$staging" /var/lib/ai-detector/model
fi
if [[ ! -f /etc/ai-detector/env ]]; then
    printf 'Choose the same key you will save in n8n (32–256 letters/digits/_/-).\n' >/dev/tty
    IFS= read -rsp 'X-Detect-Key (hidden): ' detector_key </dev/tty
    printf '\n' >/dev/tty
    [[ $detector_key =~ ^[A-Za-z0-9_-]{32,256}$ ]] || { echo 'Key format invalid; nothing was printed or saved.' >&2; exit 1; }
    printf 'DETECT_KEY=%s\n' "$detector_key" > /etc/ai-detector/env
    unset detector_key
else
    echo 'Keeping the existing detector key.'
fi
chown root:root /etc/ai-detector/env
chmod 600 /etc/ai-detector/env
ln -sfn "$release" /opt/ai-detector/current.new
mv -Tf /opt/ai-detector/current.new /opt/ai-detector/current
install -m 644 "$release/ai-detector.service" /etc/systemd/system/ai-detector.service
systemctl daemon-reload
systemctl enable ai-detector >/dev/null
systemctl restart ai-detector
echo 'Loading the CPU model; waiting for readiness (up to 10 minutes)...'
ready=0
for ((attempt=0; attempt<300; attempt++)); do
    if curl --fail --silent --max-time 2 http://127.0.0.1:8099/health >/dev/null; then ready=1; break; fi
    sleep 2
done
(( ready == 1 )) || { echo 'Not ready. Inspect: sudo journalctl -u ai-detector -n 50 --no-pager (do not share the key file).' >&2; exit 1; }
curl --fail --silent http://127.0.0.1:8099/health
printf '\nRunning an authenticated sample (key is read privately from its file)...\n'
"$release/venv/bin/python" "$release/client_test.py"
echo 'Installed: 127.0.0.1:8099 only. Add the tunnel hostname and n8n credential next. Firewall unchanged.'
