# Teacher Dashboard Design (Figma-like Specs)

This document serves as the "Figma" blueprint for the Teacher Dashboard.

## 1. Theme & Branding
- **Primary Color**: `#4A90E2` (Soft Blue - distinct from Principal's Navy)
- **Secondary Color**: `#50E3C2` (Teal for progress/success)
- **Background**: `#F5F7FA` (Light Grey/Blue tint)

## 2. Screen Layouts

### A. Dashboard Overview
- **Header**: "Hello, [Teacher Name]!" + Date + Class Teacher ID.
- **Top Section**: "Next Class" widget (Subject, Class, Time, Countdown).
- **Grid Menu**:
    - Mark Attendance (Icon: Clipboard)
    - Quiz Assistant (Icon: Sparkles/AI)
    - My Schedule (Icon: Calendar)
    - Digital Library (Icon: Book)
- **Bottom Section**: "Recent Notices" scrollable list.

### B. Student Attendance
- **Top Bar**: Date Picker + Class/Section Selector.
- **List Item**: Student Name + Roll No + [Present/Absent/Late] Toggle.
- **Footer**: "Submit Attendance" Button.

### C. AI Quiz Assistant
- **Chat Interface**: Similar to Principal's AI Chat but focused on academic content.
- **Prompt Chips**: "Generate Quiz for Ch 5", "Create Lesson Plan", "Summarize Meeting".
- **Output View**: Formatted list of questions with "Copy to Clipboard" or "Save to PDF".

### D. My Schedule
- **Vertical Timeline**: 8:00 AM to 4:00 PM.
- **Cards**: Subject Name, Room Number, Duration.
- **Reminders**: Toggle for "Notify me 5 mins before class".

## 3. User Flow
1. Login -> Dashboard.
2. Dashboard -> Tap "Mark Attendance" -> Select Class -> Log Data -> Submit.
3. Dashboard -> Tap "Quiz Assistant" -> Enter Topic -> AI Generates Questions.
