# คำสั่งส่งต่อเอเจนต์: AS Kling 4 Research Lab

อ่าน README.md, RESEARCH_TIMELINE_TH.md, SOURCES.json และผลตรวจล่าสุดก่อนแก้ ระบบนี้คือ client อิสระ ไม่ใช่โมเดล Kling หรือ private server ของ Runway

รักษาความปลอดภัย key ใน environment เท่านั้น ไม่ลง browser, HTML, Git, log หรือ ZIP อย่าอ้างว่ามี key อยู่แล้วเพราะปลั๊กอินล็อกอินสำเร็จ

ค่า AS เริ่มที่ 10 วินาที ใช้ภาพแรกแนวตั้ง 9:16 แล้วเลือก I2V ratio auto_720p/auto_1080p ใช้ prompt ตาม REFERENCE LOCK / ACTION TIMELINE / CAMERA / DIALOGUE / VOICE / CONSTRAINTS โดยไม่อ้างว่า LOCK เป็นการรับประกันผล

ชุดที่ตรวจแล้วรองรับ first/middle/last และ references ภาพ อย่าใส่ referenceVideos, seed, audio, cfgScale, fps หรือ field รุ่นอื่น จนกว่าจะตรวจ primary source ล่าสุดและเพิ่มการทดสอบ

ก่อนสร้างจริงต้องมีคำสั่งของผู้ใช้ key งบ และ spend flag ไม่ใช้ paid generation เพื่อทดสอบ auth โดยพลการ ส่ง POST ครั้งเดียว หากไม่ทราบผลส่งให้ตรวจประวัติก่อน เก็บ ID ก่อนรอ อ่าน GET >=5s พร้อม jitter/backoff timeout เป็น local wait ใช้ resume ไม่ใช่สร้างใหม่

ดาวน์โหลด output โดยไม่ส่ง API key ไป media host เก็บไฟล์/hash ตรวจด้วย ffprobe และดูคลิปจริง แยกเวลางานจริงกับเวลาในคลิปทุกครั้ง ทำเครื่องหมาย mock/ข้อเสนอ/ส่วนที่ไม่ทราบ ห้ามแต่ง sampling steps, progress, seed หรือผลทดสอบ

ก่อนส่งรัน node --test tests/*.test.mjs และ node scripts/check.mjs ตรวจ browser หากพร้อม หากไม่พร้อมให้ระบุว่า visual QA ยังไม่ยืนยัน อย่าใช้ HTTP check แทน screenshot

แพ็ก source โดยตัด .env, .git, runs และภาพส่วนตัว เก็บ GitHub ใน research branch ไม่ merge main โดยไม่มีคำสั่ง
