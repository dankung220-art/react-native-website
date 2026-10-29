# AS Kling 4 — วิจัยคำสั่งจากภาพเริ่มต้นจนรับคลิป

ต้นแบบอิสระ AS Research Studio v1.0 · ตรวจเอกสาร **29 ตุลาคม 2026 เวลาไทย**

## 1. เป้าหมายและขอบเขตของคำว่าโค้ดครบ

ให้ As เห็นทุกคำสั่งและผลตอบกลับตั้งแต่เตรียมภาพ ส่งงาน รอผล รับคลิป และตรวจคลิป โค้ดทุกไฟล์ของต้นแบบเปิดให้ศึกษาและแก้ได้ ส่วน private server ของ Runway, น้ำหนักโมเดล Kling, training pipeline และอัลกอริทึม inference ที่ไม่เผยแพร่ไม่ได้เปิดให้ดึงจากลิงก์หน้า endpoint จึงไม่อ้างว่าโคลนระบบภายในได้ 100%

หน้าเว็บใช้แบรนด์ AS และทำซ้ำกระบวนการสาธารณะ Input → Request → Task → Output พร้อมอธิบายคำสั่ง ไม่อ้างว่าเป็นเว็บทางการหรือเหมือนทุกพิกเซล [S1, S2, S8]

## 2. อะไรเป็นพารามิเตอร์จริง อะไรเป็นภาษากำกับ

| ความต้องการ | วิธีแทนใน request | ความหมาย |
|---|---|---|
| เลือกรุ่น | `model: kling_4` | public contract |
| คลิป 10 วินาที | `duration: 10` | ความยาวผลลัพธ์ ไม่ใช่เวลารอ |
| คุณภาพ 720p | `ratio: auto_720p` | ค่า I2V เลือกคุณภาพ |
| แนวตั้ง 9:16 | จัดกรอบภาพแรกเป็น 9:16 | I2V ตามกรอบ first frame |
| กำกับการแสดง/กล้อง/เสียง | `promptText` | คำสั่งสร้างสรรค์ที่ต้องประเมินผล |
| ภาพกลางและภาพจบ | `promptImage` array มี `position` | หมุดหมายลำดับภาพ ไม่ใช่ timestamp ที่รับประกัน |
| รักษาตัวตน | ภาพอ้างอิงและข้อความ | conditioning ไม่ใช่การล็อกหน้าแบบพิสูจน์ผลล่วงหน้า |
| จำนวน inference steps | ไม่มี field ที่ยืนยันในชุดนี้ | ห้ามแต่งตัวเลขภายใน |

สำหรับ I2V รุ่นนี้ใช้ `auto_720p` หรือ `auto_1080p` ไม่ส่ง `9:16` หรือ `720:1280` เป็น ratio ของ endpoint นี้ ภาพ first หนึ่งภาพ middle สูงสุดแปด last สูงสุดหนึ่ง เฟรมรวมกับ references ภาพไม่เกินสิบ ค่าต่าง ๆ ต้องอ่านตามรุ่น ไม่ยืม schema Kling รุ่นเก่า [S3, S8]

ต้นแบบกำหนดค่าเริ่มต้น AS เป็น 10 วินาที ค่าเริ่มต้นของบริการเองอาจเป็น 5 วินาที ไม่ควรอาศัย default ที่ไม่เคยตรวจ

## 3. ไทม์ไลน์ระบบตั้งแต่เริ่มจนจบ

T0–T10 เป็นจุดเก็บหลักฐานของโปรแกรมเรา ไม่ใช่ trace ภายในบริษัท ขั้น auth/media/moderation/queue อาจมีการทำซ้อนกันภายในที่ไม่ได้เปิดเผยลำดับแน่นอน

| จุดวัด | ผู้ทำ | คำสั่งหรือเหตุการณ์ | หลักฐานที่เก็บ | เงื่อนไขไปต่อ |
|---|---|---|---|---|
| T0 | ผู้ใช้ / client | เลือกภาพและเขียน prompt | request ส่วนตัว | ใช้ภาพจริง |
| T1 | client | `validatePayload()` | model, URI, frame count, duration, ratio | โครงสร้างผ่าน |
| T2 | client | `estimateCost()` | snapshot ราคา งบ request hash | ผ่านงบประมาณ และมี spend flag |
| T3 | client → Runway | `POST /v1/image_to_video` ครั้งเดียว | เวลาเริ่มส่งและ HTTP response | ได้ task ID ที่อ่านได้ |
| T4 | client | บันทึก `receipt.json` | task ID และ mode/hash | บันทึกก่อนรอ |
| T5 | client → Runway | `GET /v1/tasks/{id}` | สถานะและเวลาอ่านพบ | ยังไม่จบให้รอและอ่านต่อ |
| T6 | ระบบบริการ | งานทำเบื้องหลัง | เห็นได้ผ่านสถานะสาธารณะ | สำเร็จ/ล้มเหลว/ยกเลิก |
| T7 | client | อ่านพบ `SUCCEEDED` และ `output[]` | เวลา output พร้อมที่สังเกตได้ | URL ผลลัพธ์มีอยู่ |
| T8 | client → media host | ดาวน์โหลด HTTPS output | content type จำนวนไบต์ | ไม่ส่ง API Authorization ตามไป |
| T9 | client | ตรวจหัว MP4 เปลี่ยนชื่อ `.part` และ hash | MP4, SHA-256, result.json | ไม่เขียนทับไฟล์สำเร็จเดิม |
| T10 | ผู้วิจัย | ffprobe และดูคลิป/เสียง | duration/fps/ขนาดจริง และคะแนน | ตัดสินใช้หรือปรับการทดลอง |

POST เริ่มงานแบบ asynchronous ผลตอบกลับแรกเป็น ID ไม่ใช่ไฟล์วิดีโอ การรอคือการอ่าน task เดิมด้วย GET ไม่ใช่ส่ง prompt ซ้ำ [S2, S4] URL ผลลัพธ์มีอายุชั่วคราว จึงต้องเก็บไฟล์ของตัวเอง [S5]

สูตรที่วัดได้จาก log จริง:

- submission latency = เวลารับ ID − เวลาเริ่ม POST
- observed time to output = เวลาอ่านพบ output − เวลาเริ่ม POST
- download latency = เวลาเก็บไฟล์เสร็จ − เวลาเริ่มดาวน์โหลด
- end-to-end latency = เวลาเก็บไฟล์เสร็จ − เวลาเริ่ม POST

`first_running_observed_at` คือเวลา GET ที่อ่านพบ RUNNING ครั้งแรก ไม่ใช่เวลาเริ่ม inference ที่ server รับรอง การอ่านเป็นช่วงทำให้ข้ามบางสถานะได้ ห้ามเติมสถานะหรือเวลาในช่องว่างโดยไม่มีหลักฐาน

## 4. สถานะและนโยบายรอ

| สิ่งที่ได้รับ | client ทำอะไร | สิ่งที่ไม่ควรสรุป |
|---|---|---|
| PENDING | รอ task เดิม | ยังไม่ทราบเวลาเสร็จ |
| THROTTLED | รอข้อจำกัดการประมวลผล | ไม่ได้ถูกปฏิเสธหรือจำเป็นต้องสร้างใหม่ |
| RUNNING | อ่านต่อภายหลัง | ไม่รู้ว่าสร้างแล้วกี่เฟรม |
| SUCCEEDED | ตรวจ output และดาวน์โหลด | ยังต้องดูคุณภาพคลิป |
| FAILED | เก็บเหตุล้มเหลวและหยุด | ไม่ retry แบบเสียเครดิตเอง |
| CANCELED / CANCELLED | หยุดรอ | เอกสารต่างหน้าสะกดต่างกัน client รองรับทั้งคู่ |
| HTTP 429 ระหว่าง GET | backoff เคารพ Retry-After | ไม่เท่ากับ clip task ล้มเหลว |
| HTTP 404 | ตรวจ ID/ประวัติ | อาจเป็นหลังลบหรือยกเลิก ไม่ POST แทน |

เว้นการอ่านอย่างน้อยห้าวินาที ใช้ sequential await เพิ่ม jitter และ backoff สำหรับ GET ชั่วคราว หลีกเลี่ยง setInterval ที่ส่งคำขอซ้อน [S4] การไม่ retry POST อัตโนมัติเป็นนโยบายของต้นแบบเพื่อหลีกเลี่ยงค่าบริการซ้ำเมื่อไม่รู้ผลส่งเดิม

Timeout 900 วินาทีของ CLI หมายถึง client หยุดรอ task อาจทำต่ออยู่ จบด้วย exit code 3 แล้วใช้ resume หาก POST ขาดการตอบกลับและไม่มี ID ให้ตรวจประวัติงานใน Runway ไม่สมมติว่าผู้ให้บริการรับงานไม่สำเร็จ

## 5. สายคำสั่งที่เริ่มทำงานจริง

ตั้ง API key เป็น environment variable ตาม README ไม่วางในหน้าเว็บ จากนั้น:

```bash
node src/cli.mjs prepare --image first.jpg --request my-request.json --duration 10
node src/cli.mjs validate --request my-request.json
node src/cli.mjs run --live --allow-spend --budget 150 --request my-request.json --out runs/test-01
```

คำสั่ง run ส่ง HTTP แบบนี้หนึ่งครั้ง:

```http
POST https://api.dev.runwayml.com/v1/image_to_video
Authorization: Bearer [value from RUNWAYML_API_SECRET]
X-Runway-Version: 2024-11-06
Content-Type: application/json
```

```json
{
  "model": "kling_4",
  "promptImage": "https://YOUR-HOST/first.jpg",
  "duration": 10,
  "ratio": "auto_720p",
  "promptText": "One continuous locked-off live-action performance. Hold, glance, then hold the ending. Quiet ambience."
}
```

เมื่อได้ ID โปรแกรมบันทึก receipt แล้วอ่าน `GET /v1/tasks/{id}` จนสำเร็จ ส่ง GET กี่ครั้งก็ยังเป็น task เดิม แต่ POST เพิ่มอาจสร้าง task ใหม่ ไม่วาง POST ใน polling loop [S2; วิธีบันทึก/กู้ต่อเป็นการออกแบบต้นแบบ]

การใช้ data URI ช่วยบรรจุภาพใน request โดยไม่ต้องมี image host แต่ request ส่วนตัวมีภาพอยู่ด้วย จึงตัด `runs/` ออกจาก Git และ ZIP การล็อกอินหรือ source code ไม่ได้ทำให้สิทธิ API หรือเครดิตเกิดขึ้นเอง

## 6. ไทม์ไลน์ภายในคลิป 0–10 วินาที

เป็นบทการเคลื่อนไหวเสนอใหม่เพื่อวัด visual continuity ไม่ใช่เนื้อหาของคลิปที่ไม่เคยได้รับ ใช้ผู้แสดงจากภาพที่แนบ ไม่เพิ่มตัวละครเรื่องอื่น

| เวลาในคลิป | การแสดง | เหตุผลกำกับ | เกณฑ์ตรวจ |
|---|---|---|---|
| 0–2 s | นิ่ง หายใจเบา สายตาทิศเดิม | อ่านตัวละครและตั้งภาพก่อนเคลื่อนไหว | หน้า ชุด มือ พรอพ ตรงภาพต้น |
| 2–7 s | ค่อย ๆ มองซ้ายของกล้องแล้วนำสายตากลับ | หนึ่งการกระทำ อ่านเหตุและผลทัน | ทิศไม่กลับด้าน คอต่อเนื่อง ไม่มี face drift |
| 7–10 s | ค้างสีหน้า deadpan | มี editing handle และท่าจบ | ไม่เพิ่มคน/พรอพ หรือเคลื่อนกล้องเอง |

กล้องหนึ่งช็อตต่อเนื่อง locked-off คงแกน เสียง ambience เพื่อแยกทดสอบภาพก่อนบทพูด หากเพิ่ม dialogue ไทย ให้เป็นอีกเงื่อนไขทดลองเพื่อแยกสาเหตุของปัญหาปากหรือการเคลื่อนไหว

เลข 2 และ 7 วินาทีเป็นคำขอจังหวะในภาษา prompt ไม่มี public field ที่ยืนยันว่าใช้บังคับทุก beat ตรงเวลา ภาพ middle เป็นภาพชี้ลำดับ ไม่ได้ผูกกับ 5.000 วินาทีโดยอัตโนมัติ แถบเลื่อนในเว็บอธิบาย score เท่านั้น ไม่ได้เล่นคลิปจาก Kling

เมื่อความยาวเป็น d แม่แบบ AS แบ่ง 20% ตั้งต้น / 50% การกระทำ / 30% ค้างท้าย เป็นกฎที่เราออกแบบเอง ถ้าคุณแก้ prompt ให้ประเมินตามบทที่แก้ ไม่ถือว่าแถบตัวอย่างเป็นผลจริง

## 7. Keyframes และ references ต่างหน้าที่กัน

`promptImage` แบบ string ใช้เป็น first frame หรือส่ง array ของ `{uri, position}` เพื่อระบุ first/middle/last ภาพแรกจัดองค์ประกอบเริ่มคลิป ส่วน `references: [{uri}]` เป็นภาพให้ข้อมูลบุคคล/วัตถุ/สไตล์ และต้องมี prompt [S3, S8]

การเพิ่มภาพอาจช่วยวัดความต่อเนื่องได้ แต่ไม่รับรอง face lock แบบ 100% เปรียบเทียบ A/B หลายรอบและเก็บผลเสียด้วย บริการจริงมี `referenceVideos` แต่ prototype นี้ไม่ส่งเพราะ nested schema/media validation/ราคายังไม่ได้ยืนยันครบเป็นชุดรัน จึงแจ้งข้อจำกัดและปฏิเสธอย่างชัดเจน

## 8. กลไกที่อธิบายได้ กับส่วนที่ไม่เปิดเผย

| ชั้นอธิบาย | หลักฐาน | ข้อสรุป |
|---|---|---|
| Request, ID, status, output | public API / SDK | สร้าง client ตรวจสอบได้ |
| ภาพ/ข้อความกำหนดเงื่อนไขผล | อนุมานเชิงหน้าที่จาก contract | เรียก conditioning ในความหมายการใช้งานได้ |
| ลำดับ auth/moderation/media/queue ภายใน | ไม่เปิดเผยทั้งหมด | ใช้แผนภาพชั้นตรรกะ ไม่อ้าง internal trace |
| backbone, latent, denoising schedule, steps | ไม่ยืนยันในชุดหลักฐาน | ไม่แต่งจำนวนขั้นหรือวินาที |
| ลำดับสร้างภาพและเสียง | เอกสารระบุมีเสียง ไม่แจกแจง schedule | ไม่สมมติว่าเรนเดอร์ภาพเสร็จแล้วค่อยสร้างเสียง |
| ผลเหมือนเดิมทุกบิต | ไม่พบ seed field ของ Kling4 ใน schema ที่อ่าน | request hash เดียวกันไม่รับรองคลิปเหมือนกัน |

ไม่ทำ progress จำลอง 0–100% เพื่อให้ดูเหมือนรู้การสร้างเฟรมจริง เก็บ provider progress เฉพาะเมื่อได้รับโดยไม่เปลี่ยนความหมายเป็น sampling progress

## 9. เครดิต ณ วันที่ตรวจ

ใช้เฉพาะ I2V ที่ไม่มีวิดีโอ input/reference หน้า Pricing ระบุส่วนลดและการปัดละเอียดกว่าบางหน้าที่แสดง list price จึงใช้ Pricing เป็นฐาน snapshot [S6]

| ตัวอย่างภาพล้วน | คิด list และปัดขึ้น | ช่วงลดถึง 30 พ.ย. 2026 UTC |
|---|---:|---:|
| 5 s / 720p | ceil(5×15.7)=79 | ceil(79×0.8)=64 เครดิต |
| 10 s / 720p | ceil(10×15.7)=157 | ceil(157×0.8)=126 เครดิต |
| 10 s / 1080p | ceil(10×23.5)=235 | ceil(235×0.8)=188 เครดิต |

ต้องปัด list charge ขึ้นก่อนลด แล้วปัดอีกครั้ง ไม่คูณอัตราที่ลดแล้วตรง ๆ ทุกกรณี โปรโมชันสิ้นสุดก่อน 1 ธ.ค. 2026 เวลา 00:00 UTC โค้ดเลือกตามวันที่ แต่ snapshot rate อาจเปลี่ยน ต้องตรวจหน้า Pricing ก่อนใช้

งบ client เป็นเพียงประตูตรวจ estimate ไม่ใช่ hard cap ของผู้ให้บริการ ถ้า response มี estimatedCost ให้เก็บเทียบกับยอดจริง ไม่สมมติว่าต้องมี field นี้เสมอ

## 10. แผนทดลองที่แยกสาเหตุ

เริ่ม mock ตรวจโปรแกรม แล้ว live smoke test 5 วินาทีหนึ่งงานเมื่อมี key และงบ ไม่ใช้ smoke test นี้ตัดสินบท 10 วินาที

| ทดลอง | คงที่ | เปลี่ยน | วัด |
|---|---|---|---|
| A | ภาพแรก/duration/quality | prompt สั้น baseline | continuity และ latency ตั้งต้น |
| B | ภาพเดียวกับ A | เพิ่ม timeline prompt | beat timing |
| C | เงื่อนไข B | เพิ่ม last frame | ท่าจบและ drift |
| D | เงื่อนไข C | เพิ่ม middle frame | ลำดับ/ความลื่น |
| E | การเคลื่อนไหวเดิม | เพิ่ม dialogue ไทยสั้น | คำพูด ปาก และผลต่อภาพ |

นี่เป็นแผนเสนอ ยังไม่มีคลิปผลทดสอบ API จริง ไม่เติมคะแนนที่ไม่ได้วัด ควรทำซ้ำเมื่อมีงบเพราะ schema นี้ไม่มี seed ที่เปิดให้ตรึง การเปลี่ยน prompt รอบเดียวไม่พิสูจน์เหตุและผลเด็ดขาด

ใช้ scorecard แยกหน้า/ชุด/พรอพ/แกนกล้อง/จังหวะ/เสียง 0–5 พร้อม timestamp ที่ผิด เก็บทุก fail คิด median latency ค่าใช้จ่ายและจำนวนตัวอย่างร่วมกัน ไม่คัดเฉพาะคลิปดีที่สุดมาอ้าง

## 11. การตรวจสอบและข้อจำกัด

ชุดทดสอบโปรแกรมใช้ transport จำลองเพื่อพิสูจน์การส่งครั้งเดียว การรอ การกู้ และไฟล์ โดยไม่ใช้เครดิต มีการทดสอบ HTTP local server จริง แยกจากการตรวจหน้าตา browser ซึ่งยังไม่ยืนยันเนื่องจากเครื่องมือ timeout และ environment reset

ยังไม่เรียก API เพื่อสร้างคลิปจริงในงานนี้ ผู้ใช้ต้องใส่ key/เครดิตและภาพจริง การตรวจ content type และหัว container ไม่แทนการ decode ทั้งวิดีโอ ตรวจด้วย ffprobe และดูภาพ/เสียงจริงก่อนใช้งาน:

```bash
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,avg_frame_rate -of json runs/test-01/clip.mp4
```

เก็บวิดีโอของตัวเองก่อน output URL หมดอายุ เก็บภาพและ request ส่วนตัวใน runs ที่ไม่รวม Git/ZIP ไม่ส่ง API key ไป URL ของไฟล์ [S5]

## 12. แผนที่โค้ดตามขั้นตอน

| ขั้น | จุดศึกษา |
|---|---|
| ประกอบและตรวจ request | src/core.mjs → validatePayload / buildPrompt |
| ประมาณเครดิต | src/core.mjs → estimateCost |
| ส่งครั้งเดียว | src/client.mjs → create |
| บันทึก task ก่อนรอ | src/cli.mjs → receipt.json |
| poll/backoff/timeout | src/client.mjs → get / wait |
| cancel/delete | src/client.mjs → cancel |
| output ไม่ส่ง key ตาม | src/client.mjs → download |
| audit/hash/result | src/cli.mjs |
| เว็บและเวลาในคลิป | dist/app.mjs |
| cURL เต็มวงจร | scripts/run-curl.sh |

## แหล่งอ้างอิงหลัก

- [S1 — หน้า endpoint ที่ผู้ใช้ให้](https://dev.runway.com/endpoints/image_to_video?modelId=kling_4)
- [S2 — API Reference](https://docs.dev.runwayml.com/api/)
- [S3 — Inputs และข้อจำกัดรุ่น](https://docs.dev.runwayml.com/assets/inputs/)
- [S4 — SDK task polling](https://docs.dev.runwayml.com/api-details/sdks/)
- [S5 — Output และอายุ URL](https://docs.dev.runwayml.com/assets/outputs/)
- [S6 — Pricing และวิธีปัดส่วนลด](https://docs.dev.runwayml.com/guides/pricing/)
- [S7 — Changelog](https://docs.dev.runwayml.com/api-details/api_changelog/)
- [S8 — Official Python SDK request types](https://github.com/runwayml/sdk-python/blob/main/src/runwayml/types/image_to_video_create_params.py) — blob SHA ที่อ่าน: `5628f6ee039b86c2644233488673b6c0ad048028`
- [S9 — คู่มือ Kling4 ของ Runway](https://dev.runwayml.com/learn/kling-4-0-api)

การแบ่งจุดวัด T0–T10 นโยบาย POST-once แม่แบบบท และแผนทดลองเป็นการออกแบบของเรา ไม่อ้างว่าเป็นข้อเท็จจริงเรื่อง inference ภายใน
