#!/usr/bin/env bash
# Update an existing canonical installation; no env/key/model/venv/firewall changes.
set -euo pipefail
set +x
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run with sudo bash.' >&2; exit 1; }
ref=main
if [[ $# == 2 && $1 == --ref ]]; then ref=$2; elif [[ $# != 0 ]]; then echo 'Usage: sudo bash update.sh [--ref COMMIT_SHA]' >&2; exit 1; fi
[[ $ref == main || $ref =~ ^[a-f0-9]{40}$ ]] || exit 1
current=/opt/ai-detector/current
[[ -L $current && -x $current/venv/bin/python && -f /etc/ai-detector/env ]] || { echo 'Existing installation layout differs; stop and ask for an adapted update. No values needed.' >&2; exit 1; }
exec_start=$(systemctl show ai-detector --property=ExecStart --value)
[[ $exec_start == *"/opt/ai-detector/current/venv/bin/python"* && $exec_start == *"/opt/ai-detector/current/serve.py"* ]] || { echo 'Service entry point differs; no changes made. Ask for an adapted update.' >&2; exit 1; }
unset exec_start
previous=$(readlink -f "$current")
venv=$(readlink -f "$current/venv")
release=$(mktemp -d /opt/ai-detector/releases/async-XXXXXXXX)
chmod 755 "$release"
switched=0
rollback() {
    status=$?
    if (( status != 0 && switched == 1 )); then
        ln -sfn "$previous" "$current.new"
        mv -Tf "$current.new" "$current"
        systemctl restart ai-detector || true
        echo 'Update check failed; previous application restored. Existing key/model/settings kept.' >&2
    fi
    exit "$status"
}
trap rollback EXIT
base="https://raw.githubusercontent.com/xredible/xredible-automation/$ref/tools/ai-detector"
for file in app.py jobs.py serve.py constants.py text.py engine.py model.py client_test.py README.md THIRD_PARTY.md; do
    curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 "$base/$file" -o "$release/$file"
    chmod 644 "$release/$file"
done
ln -s "$venv" "$release/venv"
"$release/venv/bin/python" -c 'import sys;sys.path.insert(0,sys.argv[1]);import app,jobs;assert callable(app.create_app)' "$release"
ln -sfn "$release" "$current.new"
mv -Tf "$current.new" "$current"
switched=1
systemctl restart ai-detector
ready=0
for ((attempt=0; attempt<300; attempt++)); do
    if curl --fail --silent --max-time 2 http://127.0.0.1:8099/health 2>/dev/null | "$release/venv/bin/python" -c 'import json,sys;x=json.load(sys.stdin);assert x.get("api_version")==2 and x.get("mode")=="async"' 2>/dev/null; then ready=1; break; fi
    sleep 2
done
(( ready == 1 )) || { echo 'Async API did not become ready.' >&2; exit 1; }
"$release/venv/bin/python" "$release/client_test.py"
echo 'Async API v2 ready at 127.0.0.1:8099 only. Key, model, venv, unit settings, tunnel and firewall unchanged.'
echo "Previous release retained at $previous"
