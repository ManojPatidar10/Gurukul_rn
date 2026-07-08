# Principal Dashboard — Figma Design Spec

> **Digital School** · Trustee / Principal · Full Analytical Dashboard  
> Brand primary: `#1F4E79` · Reference mockup: `assets/principal-dashboard-mockup.png`

Use this document to recreate frames in Figma. All dimensions are in **dp** (React Native logical pixels).

---

## 1. Design tokens

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#1F4E79` | Header, active nav, primary buttons |
| `primaryLight` | `#E8F0F8` | Icon tile backgrounds |
| `background` | `#F5F7FA` | Screen background |
| `surface` | `#FFFFFF` | Cards, sheets |
| `textPrimary` | `#1A1A2E` | Headings, values |
| `textSecondary` | `#555555` | Subtitles, labels |
| `textMuted` | `#999999` | Timestamps, hints |
| `success` | `#2E7D32` | Positive trends, present |
| `warning` | `#F57C00` | Pending, reminders |
| `error` | `#C62828` | Absent, overdue |
| `accent` | `#1565C0` | Links, chart bars |

### Typography

| Style | Size | Weight | Line height |
|-------|------|--------|-------------|
| H1 | 22 | 700 | 28 |
| H2 | 18 | 600 | 24 |
| Body | 14 | 400 | 20 |
| Caption | 12 | 400 | 16 |
| Stat value | 24 | 700 | 30 |
| Stat label | 12 | 500 | 16 |

### Spacing & radius

- Screen horizontal padding: **16**
- Card gap: **12**
- Section gap: **24**
- Card radius: **12**
- Icon tile radius: **16**
- Card shadow: `0 2 8 rgba(0,0,0,0.08)`

---

## 2. Frame inventory

| Frame | Size | Description |
|-------|------|-------------|
| `Principal/Dashboard` | 390×844 | Home — stats + quick actions + trend |
| `Principal/Attendance` | 390×844 | Live student & faculty attendance |
| `Principal/Payments` | 390×844 | Fees + salary overview |
| `Principal/Progress Cards` | 390×844 | Class/subject performance |
| `Principal/Notice Board` | 390×844 | Parent & teacher channels |
| `Principal/Admissions` | 390×844 | Enrollment pipeline |
| `Principal/AI Chatbot` | 390×844 | NL query interface |
| `Principal/Schedule` | 390×844 | Timetable management |
| `Principal/Inventory` | 390×844 | Supplies & assets |

---

## 3. Component library (Figma components)

### `Header/Principal`

- Height: **56** + safe area top
- Background: `primary`
- Left: back chevron (feature screens) or school logo (dashboard)
- Center: title (white, H2)
- Right: notification bell + badge (optional)

### `Card/Stat`

- Size: flex 1 in 2-column grid (~171×88)
- White surface, radius 12, padding 16
- Top: label (Caption, textSecondary)
- Middle: value (Stat value, textPrimary)
- Bottom: trend chip (optional, success/warning color)

### `Tile/FeatureAction`

- Size: **80×88** (icon area 48×48 + label)
- Icon circle: 48×48, `primaryLight` fill, icon `primary`
- Label: Caption, centered, max 2 lines

### `List/Row`

- Height: **72**
- Avatar/icon 40×40 + title + subtitle + trailing badge/chevron

### `Chart/BarMini`

- Height: **120**
- 7 bars (Mon–Sun), bar width 24, gap 8, `accent` fill

### `Chip/Status`

- Padding: 4×8, radius 8
- Variants: success, warning, error, neutral

### `Input/Chat`

- Fixed bottom bar: text field + send button (AI Chatbot screen)

---

## 4. Screen: Principal Dashboard

```
┌─────────────────────────────────┐
│ ■ Digital School        🔔      │  Header
│   Welcome, Principal Sharma     │
├─────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐      │
│ │Attendance│ │ Payments │      │  Stat grid 2×2
│ │   94%    │ │ ₹12.4L   │      │
│ └──────────┘ └──────────┘      │
│ ┌──────────┐ ┌──────────┐      │
│ │ Students │ │ Faculty  │      │
│ │   842    │ │  48/52   │      │
│ └──────────┘ └──────────┘      │
├─────────────────────────────────┤
│ Quick Actions                   │  Section H2
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐           │
│ │📋│ │💰│ │📊│ │📢│           │  4×2 feature tiles
│ └──┘ └──┘ └──┘ └──┘           │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐           │
│ │📝│ │🤖│ │📅│ │📦│           │
│ └──┘ └──┘ └──┘ └──┘           │
├─────────────────────────────────┤
│ Weekly Attendance Trend         │
│ ▁▃▅▇▅▃▁  (mini bar chart)      │
├─────────────────────────────────┤
│ Recent Alerts                   │
│ • 12 fee reminders sent today   │
│ • 3 admission forms pending     │
└─────────────────────────────────┘
```

**Quick action mapping**

| Tile | Icon | Route |
|------|------|-------|
| Attendance | calendar-check | Attendance |
| Payments | wallet | Payments |
| Progress Cards | chart-bar | Progress Cards |
| Notice Board | bullhorn | Notice Board |
| Admissions | user-plus | Admissions |
| AI Chatbot | robot | AI Chatbot |
| Schedule | calendar | Schedule |
| Inventory | boxes | Inventory |

---

## 5. Feature screen layouts (summary)

### Attendance
- Tabs: **Students** | **Faculty**
- Summary chips: Present / Absent / Late
- Class-wise breakdown list
- Live indicator (green dot + "Updated 2 min ago")

### Payments
- Tabs: **Fee Collection** | **Salary**
- Summary: Collected / Pending / Overdue
- Class-wise collection bars
- Reminder automation toggle + "Send reminders" CTA

### Progress Cards
- Class picker (horizontal scroll chips)
- Subject performance table
- Export PDF button (top-right)

### Notice Board
- Channel tabs: **Parents** | **Teachers**
- Compose FAB
- Notice cards: title, body preview, audience tag, timestamp

### Admissions
- Pipeline stages: Inquiry → Applied → Interview → Enrolled
- Kanban-style columns or stage filter chips
- Application count per stage

### AI Chatbot
- Chat bubble UI (user right, bot left)
- Suggested queries chips below header
- Input bar fixed at bottom

### Schedule
- Day selector (Mon–Sat)
- Period grid: time × class/room
- Conflict warnings (orange badge)

### Inventory
- Category filter chips
- Stock list: item, qty, threshold, status
- Low-stock alerts section at top

---

## 6. Figma build checklist

1. Create **Design System** page with color styles + text styles from §1
2. Build components from §3 with auto-layout
3. Create **Principal** page with 9 frames from §2
4. Link prototype: Dashboard tiles → feature screens; back → Dashboard
5. Export assets: icons as SVG; mockup PNG for stakeholder review

---

## 7. Implementation mapping

| Figma frame | React Native screen |
|-------------|---------------------|
| Principal/Dashboard | `PrincipalDashboardScreen` |
| Principal/Attendance | `AttendanceScreen` |
| Principal/Payments | `PaymentsScreen` |
| Principal/Progress Cards | `ProgressCardsScreen` |
| Principal/Notice Board | `NoticeBoardScreen` |
| Principal/Admissions | `AdmissionsScreen` |
| Principal/AI Chatbot | `AIChatbotScreen` |
| Principal/Schedule | `ScheduleScreen` |
| Principal/Inventory | `InventoryScreen` |
