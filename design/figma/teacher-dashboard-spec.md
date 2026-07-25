# Teacher Dashboard Design Specification

## Overview
A unified dashboard for teachers to manage student attendance, academic progress, AI-assisted content generation, and personal schedules.

## Visual Language
- **Theme**: Academic & Soft
- **Primary Color**: `#4A90E2` (Soft Blue)
- **Secondary Color**: `#50E3C2` (Teal)
- **Neutral Surface**: `#FFFFFF`
- **Background**: `#F5F7FA`

## Component Specifications

### 1. Dashboard Overview
- **Welcome Header**: Large title with school name, subtitle with teacher name.
- **Next Class Widget**:
    - Elevation: 2
    - Background: `#FFFFFF`
    - Content: Subject, Class-Section, Time, Countdown Badge.
- **Quick Action Tiles**:
    - Circular icons with soft backgrounds.
    - Labels: Attendance, Quiz Assistant, Schedule, Digital Library.

### 2. Student Attendance
- **List View**: Each student in a card.
- **Status Toggles**: Circular buttons for P (Present), A (Absent), L (Late).
- **CTA**: Fixed bottom "Submit Attendance" button in Primary Blue.

### 3. AI Quiz Assistant
- **Chat Interface**: Threaded bubbles.
- **Bot Bubble**: Surface white, text secondary.
- **User Bubble**: Primary blue, text white.
- **Prompt Chips**: Scrollable list of suggested AI tasks.

### 4. Personal Schedule
- **Timeline View**: Hour-based vertical slots.
- **Class Card**: Subject title, Duration subtext, Room number.
- **Banner**: "Pre-class Reminders" status.

### 5. Digital Library
- **Book Cards**: Icon, Title, Author, Category.
- **Action**: Tap to download/view subtext.

## User Flow
1. Dashboard → Quick Action → Specific Tool.
2. Attendance → Select Students → Submit → Toast Confirmation.
3. AI Assistant → Select Prompt → Generate Content → Copy/Export.
