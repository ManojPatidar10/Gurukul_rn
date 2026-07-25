# Teacher Dashboard Implementation Plan

This plan outlines the creation of a comprehensive Teacher Dashboard for the Gurukul RN application, based on the specifications in the Digital School Feature Roadmap.

## Features to Implement (Phase 1)
- **Attendance Logging**: Quick entry for student attendance.
- **Academic Progress**: Tools for managing student progress cards.
- **AI Assistant**: Quiz & paper-setting assistant, class summary generator.
- **Schedule Management**: Personal class timetable and pre-class reminders.
- **Communication**: Direct parent connect and notice board access.
- **Digital Library**: Reference books access.

## Proposed Changes

### 1. Type Definitions
Add new types for Teacher-specific data structures.
- [NEW] `src/types/teacher.ts`

### 2. Mock Data
Create mock data for teacher profiles, schedules, and student lists.
- [NEW] `src/data/mockTeacherDashboard.ts`

### 3. Navigation
Integrate the Teacher Navigator into the main app structure.
- [NEW] `src/navigation/TeacherNavigator.tsx`
- `App.tsx`: Logic to switch between Principal and Teacher views (for demo purposes).

### 4. Screens
Implement the following screens in `src/screens/teacher/`:
- [NEW] `TeacherDashboardScreen.tsx`: Overview with schedule and alerts.
- [NEW] `StudentAttendanceScreen.tsx`: Grid/List for marking attendance.
- [NEW] `QuizAssistantScreen.tsx`: AI-driven quiz generation interface.
- [NEW] `TeacherScheduleScreen.tsx`: Personal daily/weekly timetable.
- [NEW] `DigitalLibraryScreen.tsx`: Book list and reader view placeholder.

## Verification Plan

### Automated Tests
- Run `npm test` to ensure no regressions.
- Add basic smoke tests for new screens in `src/__tests__/TeacherScreens.test.tsx`.

### Manual Verification
- Launch emulator and verify navigation between all new teacher screens.
- Test "Mark Attendance" flow with mock student data.
- Verify "AI Assistant" UI handles message input and mock responses.
