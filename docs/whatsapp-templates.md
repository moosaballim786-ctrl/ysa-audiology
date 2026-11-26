# WhatsApp message templates — Yusuf Suder Audiology

Submit these four templates in **Meta Business Manager → WhatsApp Manager → Message templates → Create template**.
Messages sent outside the 24-hour customer-service window **must** use an approved template.

> ⚠️ "hear" in **"We're hear for you"** is deliberate (a hearing pun). Do not let anyone "correct" it to "here".

| Setting | Value |
|---|---|
| Language | **English** (`en`). If you choose *English (US)* instead, change **Settings → WhatsApp → Template language code** in the app to `en_US`. |
| Variables | Use the "Number" variable type (`{{1}}`, `{{2}}` …). |
| Header / footer / buttons | None (body only). |

---

## 1. `booking_confirmation`

- **Category:** Utility
- **Sent:** when staff approve an online booking request, or book/reschedule an appointment with "Send WhatsApp confirmation" ticked.
- **Body:**

```
Hi {{1}}, your {{2}} appointment at Yusuf Suder Audiology is confirmed for {{3}} at {{4}}. We're hear for you.
```

| Variable | Meaning | Sample value (Meta asks for one) |
|---|---|---|
| `{{1}}` | Patient's first name | Sarah |
| `{{2}}` | Appointment reason | hearing assessment |
| `{{3}}` | Date | Monday 1 December |
| `{{4}}` | Time (24-hour) | 09:30 |

---

## 2. `appointment_reminder`

- **Category:** Utility
- **Sent:** automatically about **24 hours before** each approved appointment (hourly job, only between 08:00 and 20:00 SAST).
- **Body:**

```
Hi {{1}}, a reminder of your {{2}} appointment tomorrow, {{3}} at {{4}}, at Yusuf Suder Audiology.
```

| Variable | Meaning | Sample |
|---|---|---|
| `{{1}}` | First name | Sarah |
| `{{2}}` | Appointment reason | wax removal or cleaning |
| `{{3}}` | Date | Tuesday 2 December |
| `{{4}}` | Time | 14:20 |

---

## 3. `recall_reminder`

- **Category:** Utility
- **Sent:** automatically **7 days before** a patient's recall due date (daily job, 08:00 SAST). Once per due cycle.
- **Body:**

```
Hi {{1}}, you're due for {{2}} on {{3}}. Please book your visit here: {{4}}. We're hear for you — Yusuf Suder Audiology.
```

| Variable | Meaning | Sample |
|---|---|---|
| `{{1}}` | First name | Sarah |
| `{{2}}` | Recall reason (from the patient's recall plan) | your annual hearing test |
| `{{3}}` | Due date | 12 March 2027 |
| `{{4}}` | Booking link | https://ysa-audiology.netlify.app/book |

---

## 4. `birthday_greeting`

- **Category:** Marketing
- **Sent:** automatically on the patient's birthday (daily job, 08:00 SAST), at most once per year, only with WhatsApp consent. 29 February birthdays are sent on 28 February in non-leap years.
- **Body (exact wording — keep "hear"):**

```
Happy birthday, may you be blessed with many more. Just know we're always hear for you.
```

No variables.

---

## Connecting the practice number (when it's decided)

1. In **Meta for Developers → your app → WhatsApp → API Setup**, note the **Phone number ID** and create a **permanent access token** (System User token with `whatsapp_business_messaging` permission).
2. In **Supabase → Project `ysa-audiology` → Edge Functions → Secrets**, add:
   - `WHATSAPP_TOKEN` = the permanent access token
   - `WHATSAPP_PHONE_NUMBER_ID` = the phone number ID
3. Optional — delivery receipts ("Delivered" status in the app):
   - Add secrets `WHATSAPP_VERIFY_TOKEN` (any long random string you choose) and `WHATSAPP_APP_SECRET` (Meta app → Settings → Basic → App secret).
   - In Meta → WhatsApp → Configuration → Webhook, set the callback URL to
     `https://hhqnsqvikywagddoisza.supabase.co/functions/v1/whatsapp-webhook`, the verify token to the same `WHATSAPP_VERIFY_TOKEN`, and subscribe to **messages**.
4. In the app: **Settings → WhatsApp → Send test message** (uses Meta's built-in `hello_world` template).

Until the secrets exist, nothing breaks: notifications are still created and every message is logged as
**not sent — WhatsApp not configured**, with an amber banner in Settings.

Only patients with **WhatsApp consent = on** are ever messaged.
