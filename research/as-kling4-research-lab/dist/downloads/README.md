# AS · Kling 4 Research Lab

ต้นแบบวิจัยการเรียก Runway `kling_4` จากภาพจนรับคลิป ตรวจเอกสารวันที่ **29 ตุลาคม 2026** มีโค้ดทุกไฟล์ของต้นแบบให้เปิดศึกษา ไม่ใช่ private server ของ Runway หรือน้ำหนักโมเดล Kling

อ่าน [รายงานไทม์ไลน์ฉบับละเอียด](docs/RESEARCH_TIMELINE_TH.md) และ [หลักฐาน](docs/SOURCES.json)

## เริ่มโดยไม่ใช้เครดิต

ใช้ Node.js **22.18+** โปรแกรมไม่มี dependency เพิ่ม Python 3 ใช้เมื่อแพ็กไฟล์หรือใช้สคริปต์ cURL

```bash
node --version
npm test
npm run dev
```

บนเครื่องที่รัน เปิด `http://127.0.0.1:4173` หน้าเว็บเป็นเครื่องมือเตรียมภาพ/JSON/คำสั่งและจำลองสถานะ หน้า Site ที่ส่งมอบทำหน้าที่เดียวกัน ไม่รับ API key และไม่รัน inference เอง

```bash
node src/cli.mjs run --mock --request examples/request.first.json --out runs/demo-01
```

ผลเป็น manifest, receipt และ audit ที่ระบุ `mode: mock`, `clock: simulated` ไม่มีคลิปที่โมเดลสร้าง และห้ามใช้เวลาของ mock เป็น benchmark

## รันจริงตั้งแต่เริ่มจนได้ MP4

ต้องมี Runway Dev API key ของโปรเจกต์ที่มีเครดิต การล็อกอินเว็บหรือเชื่อมต่อปลั๊กอินไม่ได้ทำให้ key อยู่ใน environment ของเครื่องคุณอัตโนมัติ

ใส่ key โดยไม่แสดงบนหน้าจอใน Bash/Termux:

```bash
read -r -s -p "Runway Dev API key: " RUNWAYML_API_SECRET
export RUNWAYML_API_SECRET
printf '\n'
```

หรือเก็บเฉพาะบนเครื่องตัวเองใน `.env` ตาม `.env.example` แล้วใช้ `npm run lab -- ...` ห้ามอัปโหลด `.env`

เตรียมภาพจริง หากต้องการแนวตั้งให้ใช้ภาพแรก 9:16 และอย่างน้อย 300 px ทุกด้าน:

```bash
node src/cli.mjs prepare --image ./first.jpg --request ./my-request.json --duration 10
node src/cli.mjs validate --request ./my-request.json
node src/cli.mjs run --live --allow-spend --budget 150 --request ./my-request.json --out ./runs/live-01
```

ใช้ภาพ HTTPS URL จริงแทน prepare ได้ โดยแก้ตัวอย่างหรือส่งออก `request.json` จากหน้าเว็บ ภาพใน data URI มีเพดานรวม 5 MiB หลังเข้ารหัส จึงเล็กกว่าไฟล์ต้นฉบับขนาด 5 MiB

`--budget` เป็นการตรวจราคาประมาณก่อนส่ง **ไม่ใช่เพดานคิดเงินที่ Runway บังคับให้** ราคาจริงของบริการเป็นหลัก ณ snapshot ภาพล้วน 10 วินาที 720p ประมาณ 126 เครดิตช่วงส่วนลด และ 157 เครดิตอัตราปกติ

## ไฟล์ผลลัพธ์

| ไฟล์ใน output directory | หน้าที่ |
|---|---|
| `receipt.json` | task ID ที่บันทึกก่อนรอ |
| `events.jsonl` | เหตุการณ์และเวลาที่สังเกตได้ |
| `request.private.json` | อินพุตส่วนตัวสำหรับทำซ้ำ |
| `manifest.json` | request hash และราคาประมาณ |
| `task.redacted.json` | สถานะที่ลบ query ของ media URL |
| `outputs.json` | checkpoint ผูก task/index กับขนาดและ hash ของไฟล์ที่รับแล้ว |
| `clip.mp4`, `clip-2.mp4` | output ที่ดาวน์โหลดใน live mode |
| `result.json` | ขนาดไฟล์และ SHA-256 |

ตรวจชนิดไฟล์และหัว MP4 ก่อนตั้งชื่อสำเร็จ ยังไม่รับรองการ decode ทั้งคลิปหรือคุณภาพการแสดง ตรวจเพิ่มด้วย:

```bash
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,avg_frame_rate -of json runs/live-01/clip.mp4
```

## รอต่อด้วย task เดิม

```bash
node src/cli.mjs resume --live --receipt runs/live-01/receipt.json --out runs/live-01-resumed --timeout 1800
```

ใช้ `--task UUID` แทน receipt ได้ Timeout ของ client มี exit code 3 และไม่ส่ง cancel หรือสร้างงานใหม่ task อาจยังทำงานต่อระยะไกล หาก POST ขาดการตอบกลับจนไม่มี ID โปรแกรมหยุดด้วย `SubmissionUnknownError` ให้ตรวจประวัติงานใน Runway ก่อนลองใหม่

หากได้เพียงบาง output ให้ resume ใน output directory เดิมได้ โปรแกรมจะคำนวณ hash ของไฟล์ที่มี checkpoint ซ้ำแล้วรับต่อเฉพาะไฟล์ที่ขาด หากไฟล์ถูกแก้/ไม่มี checkpoint หรือเกิด disk failure ระหว่างบันทึก checkpoint ให้เลือก directory ใหม่เพื่อดาวน์โหลด task เดิม โดยไม่สร้าง generation ใหม่

## ยกเลิกหรือลบงานเฉพาะรายการ

```bash
node src/cli.mjs cancel --live --confirm-cancel --task YOUR_TASK_UUID
```

DELETE endpoint ใช้ได้ทั้งยกเลิกงานที่ยังทำอยู่และลบงานที่จบแล้วตามสถานะ server ไม่มีการรับรองคืนเครดิตหรือหยุด inference ในทุกกรณี 404 หลังลบ/ยกเลิกเป็นไปได้

## cURL ครบวงจร

```bash
ALLOW_SPEND=1 bash scripts/run-curl.sh my-request.json runs/curl-01 150
```

ต้องมี `curl`, `python3`, `node` สคริปต์ใช้ Node ตรวจ schema/งบ ใช้ cURL ส่ง POST **ครั้งเดียว** และ GET เว้นช่วง/backoff เก็บ receipt แล้วใช้ตัวดาวน์โหลดเดียวกับ CLI รับ MP4 โดยไม่ส่ง key ไป media host

อย่ารันคำสั่ง cURL และ Node `run --live` สำหรับการทดลองเดียวกันซ้ำ เพราะแต่ละคำสั่งสร้าง task ใหม่ ใช้ resume หากต้องการรอหรือดาวน์โหลด task เดิม

## แผนที่ซอร์ส

| พาธ | หน้าที่ |
|---|---|
| `src/core.mjs` | ตรวจ request, ประมาณเครดิต, สร้าง prompt, redact log |
| `src/commands.mjs` | สร้างบล็อกคัดลอกที่รันงานเพียงครั้งเดียว ไม่แทรก prompt ลง shell |
| `src/input-state.mjs` | ซิงก์ภาพระหว่าง Form/JSON และป้องกันผลอ่านภาพเก่าทับรายการใหม่ |
| `src/outputs.mjs` | ตรวจ hash และกู้การรับหลาย output ใน directory เดิม |
| `src/client.mjs` | create/get/wait/cancel/download |
| `src/cli.mjs` | prepare/validate/run/resume/cancel และ audit/receipt/hash |
| `src/types.d.ts` | request/task/audit types |
| `src/server.mjs` | static local web server ไม่มี live endpoint |
| `dist/` | หน้าเว็บและโมดูล browser |
| `examples/` | request เฟรมเดียว/หลายเฟรม/reference และ scorecard |
| `scripts/` | คำสั่ง cURL, ตรวจ syntax, แพ็ก source ZIP |
| `tests/` | ทดสอบ transport/CLI/HTTP server โดยไม่ใช้เครดิต |
| `docs/` | รายงาน หลักฐาน ขอบเขต คำสั่งส่งต่อ และผลตรวจ |

## ขอบเขตจริง

รองรับภาพ first/middle/last และ references ภาพ รวมไม่เกิน 10 ภาพ พร้อม lifecycle จนรับ output, error, resume และ cancel บริการจริงมี `referenceVideos` แต่ต้นแบบนี้ยังไม่รวม nested video schema, media validation และตัวคิดราคา จึงปฏิเสธ field ดังกล่าวก่อนส่งอย่างชัดเจน

ไม่พบ seed, negativePrompt, fps, cfgScale หรือ audio toggle ใน schema `kling_4` ที่ตรวจ จึงไม่ปะปนพารามิเตอร์รุ่นอื่น ข้อความล็อกหน้า/ชุด/พรอพ/แกนกล้องเป็นเจตนากำกับ ไม่รับรอง 100% ระยะเวลาใน prompt ไม่ใช่ timecode บังคับ

ยังไม่ได้สร้างคลิปผ่าน API จริง และการตรวจภาพหน้าจอ browser ยังไม่ยืนยัน: เครื่องมือ browser timeout แล้วสภาพแวดล้อมถูกรีเซ็ต ตรวจโค้ดและ HTTP แยกต่างหากโดยไม่อ้างว่าแทน visual QA ได้

## GitHub และทำซ้ำ

งานอยู่ในสาขา `research/as-kling4-lab-20261029` ใต้ `research/as-kling4-research-lab/` ไม่ merge main ดาวน์โหลด ZIP จะเล็กกว่าการ clone repository หลักที่มีเนื้อหาอื่นด้วย

```bash
git clone --depth 1 --single-branch --branch research/as-kling4-lab-20261029 https://github.com/dankung220-art/react-native-website.git
cd react-native-website/research/as-kling4-research-lab
node --test tests/*.test.mjs
node scripts/check.mjs
```

ZIP มี `SHA256SUMS` สำหรับเทียบทุกไฟล์ ไม่รวม `.env`, `.git`, `runs/`, key, ภาพผู้ใช้ หรือ clip ส่วนตัว
