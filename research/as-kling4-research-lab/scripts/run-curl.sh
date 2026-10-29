#!/usr/bin/env bash
set -euo pipefail
umask 077
request_path=${1:?Usage: run-curl.sh REQUEST_JSON NEW_OUTPUT_DIRECTORY CREDIT_BUDGET}
output_path=${2:?Supply a new output directory}
credit_budget=${3:?Supply a credit estimate budget}
[[ ${ALLOW_SPEND:-0} == 1 ]] || { echo 'Set ALLOW_SPEND=1 to authorize this paid submission.' >&2; exit 1; }
[[ -n ${RUNWAYML_API_SECRET:-} ]] || { echo 'Set RUNWAYML_API_SECRET in your environment.' >&2; exit 1; }
[[ $RUNWAYML_API_SECRET != *$'\n'* && $RUNWAYML_API_SECRET != *$'\r'* ]] || { echo 'Invalid key format.' >&2; exit 1; }
for required_tool in node python3 curl; do command -v "$required_tool" >/dev/null || { echo "Missing command: $required_tool" >&2; exit 1; }; done
mkdir -p -- "$output_path"
[[ ! -e $output_path/receipt.json && ! -e $output_path/create.json ]] || { echo 'This output directory already has a submission; resume it or choose a new directory.' >&2; exit 1; }
node src/cli.mjs validate --request "$request_path" > "$output_path/validation.json"
python3 - "$output_path/validation.json" "$request_path" "$credit_budget" <<'PY'
import json,math,sys,urllib.parse
v=json.load(open(sys.argv[1],encoding='utf-8'));p=json.load(open(sys.argv[2],encoding='utf-8'));budget=float(sys.argv[3])
if not math.isfinite(budget) or budget<=0 or v['estimate']['credits']>budget: raise SystemExit('Over estimate budget; no task submitted')
f=p['promptImage'];uris=[f] if isinstance(f,str) else [x['uri'] for x in f];uris += [x['uri'] for x in p.get('references',[])]
for uri in uris:
 h=urllib.parse.urlsplit(uri).hostname or ''
 if h in ('example.com','example.org','example.net','example.invalid') or h.endswith(('.invalid','.test','.localhost')): raise SystemExit('Replace example media with your actual frame')
print('Preflight passed. Local estimate budget is not a provider billing cap.')
PY
api_headers(){ printf 'Authorization: Bearer %s\nX-Runway-Version: 2024-11-06\n' "$RUNWAYML_API_SECRET"; }
echo 'POST /v1/image_to_video — one submission only'
if ! create_code=$(api_headers | curl --silent --show-error --max-time 40 --header @- \
 --header 'Content-Type: application/json' --request POST --data-binary "@$request_path" \
 --output "$output_path/create.json" --write-out '%{http_code}' 'https://api.dev.runwayml.com/v1/image_to_video'); then
 echo 'Submission outcome unknown. Inspect Runway task history before submitting again.' >&2; exit 2
fi
[[ $create_code == 200 ]] || { echo "Create HTTP $create_code. Response saved. No POST retry." >&2; exit 2; }
if ! task_id=$(python3 - "$output_path/create.json" "$output_path/receipt.json" <<'PY'
import datetime,json,sys,uuid
d=json.load(open(sys.argv[1],encoding='utf-8'));task=d['id']
if uuid.UUID(task).version!=4: raise ValueError('Expected UUID v4 task ID')
with open(sys.argv[2],'x',encoding='utf-8') as f: json.dump({'taskId':task,'mode':'live','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},f,indent=2)
print(task)
PY
); then echo 'POST responded but receipt was not saved. Inspect create.json and task history; do not resubmit blindly.' >&2; exit 2; fi
echo "Receipt saved: $task_id"
started_epoch=$(date +%s)
read_failures=0
while true; do
 elapsed_seconds=$(( $(date +%s) - started_epoch ))
 (( elapsed_seconds < 900 )) || { echo "Local timeout; task may continue. Resume $task_id with the CLI." >&2; exit 3; }
 if ! get_code=$(api_headers | curl --silent --show-error --max-time 30 --header @- \
  --dump-header "$output_path/read-headers.txt" --output "$output_path/status.json" --write-out '%{http_code}' \
  "https://api.dev.runwayml.com/v1/tasks/$task_id"); then get_code=000; fi
 case "$get_code" in
  200) read_failures=0 ;;
  000|429|500|502|503|504)
   read_failures=$((read_failures+1))
   (( read_failures <= 5 )) || { echo 'Read retries exhausted. Receipt retained; resume using the CLI.' >&2; exit 1; }
   wait_seconds=$(python3 - "$output_path/read-headers.txt" "$read_failures" <<'PY'
import datetime,email.utils,pathlib,random,sys
d=min(60,5*2**(int(sys.argv[2])-1));p=pathlib.Path(sys.argv[1])
for line in p.read_text(errors='replace').splitlines() if p.exists() else []:
 if line.lower().startswith('retry-after:'):
  raw=line.split(':',1)[1].strip()
  try: value=float(raw)
  except ValueError:
   try: value=email.utils.parsedate_to_datetime(raw).timestamp()-datetime.datetime.now(datetime.timezone.utc).timestamp()
   except (ValueError,TypeError): value=0
  d=max(d,value)
print(max(5,d)+random.random()*.5)
PY
)
   echo "Read HTTP $get_code; backoff ${wait_seconds}s. No new POST."
   sleep "$wait_seconds"; continue ;;
  *) echo "Read HTTP $get_code. Task ID retained: $task_id" >&2; exit 1 ;;
 esac
 task_status=$(python3 - "$output_path/status.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1],encoding='utf-8'))['status'])
PY
)
 echo "Observed $task_status after ${elapsed_seconds}s"
 case "$task_status" in
  SUCCEEDED) break ;;
  PENDING|THROTTLED|RUNNING) sleep 5 ;;
  FAILED|CANCELED|CANCELLED) echo "Task stopped: $task_status. No new POST." >&2; exit 1 ;;
  *) echo 'Unknown status. Receipt retained; inspect the task.' >&2; exit 1 ;;
 esac
done
node scripts/download-task.mjs "$output_path/status.json" "$output_path"
