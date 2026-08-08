import { ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import {
  AiQuizPayload,
  AiQuizResponse,
  AttendancePayload,
  AttendanceSummaryResponse,
  ClassSectionResponse,
  SchoolRegistrationPayload,
  StudentResponse,
  TeacherAssignmentPayload,
  TeacherDashboardResponse,
  TeacherPayload,
  TeacherResourcePayload,
  TeacherResourceResponse,
  TeacherResponse,
  TeacherSchedulePayload,
  TeacherScheduleResponse,
} from './api';
import { School, activities } from './data';
import { BottomTabs, Button, Card, Field, Header, StatCard, styles as ui } from './components';
import { colors, radius } from './theme';

export type ScreenName =
  | 'Splash'
  | 'Login'
  | 'Dashboard'
  | 'Schools'
  | 'Register'
  | 'Edit'
  | 'Detail'
  | 'Teachers'
  | 'TeacherForm'
  | 'TeacherDetail'
  | 'Success'
  | 'Settings'
  | 'Profile';

export type ScreenProps = {
  activeScreen: ScreenName;
  apiMessage: string;
  lastRegisteredId: string;
  schools: School[];
  selectedSchool: School;
  selectedTeacher: TeacherResponse | null;
  attendanceSummary: AttendanceSummaryResponse | null;
  classSections: ClassSectionResponse[];
  classStudents: StudentResponse[];
  quizDraft: AiQuizResponse | null;
  teacherDashboard: TeacherDashboardResponse | null;
  teacherMessage: string;
  teacherResources: TeacherResourceResponse[];
  teacherSchedules: TeacherScheduleResponse[];
  teachers: TeacherResponse[];
  assignTeacher: (payload: TeacherAssignmentPayload) => Promise<void>;
  createTeacher: (payload: TeacherPayload) => Promise<void>;
  createTeacherResource: (payload: TeacherResourcePayload) => Promise<void>;
  createTeacherSchedule: (payload: TeacherSchedulePayload) => Promise<void>;
  generateTeacherQuiz: (payload: AiQuizPayload) => Promise<void>;
  goTo: (screen: ScreenName) => void;
  markTeacherAttendance: (payload: AttendancePayload) => Promise<void>;
  registerSchool: (payload: SchoolRegistrationPayload) => Promise<void>;
  selectSchool: (school: School) => void;
  selectTeacher: (teacher: TeacherResponse | null) => void;
};

function Shell({
  activeScreen,
  children,
  goTo,
}: {
  activeScreen: ScreenName;
  children: ReactNode;
  goTo: (screen: ScreenName) => void;
}) {
  return (
    <View style={ui.app}>
      <View style={ui.safe}>{children}</View>
      <BottomTabs active={activeScreen} onChange={(screen) => goTo(screen as ScreenName)} />
    </View>
  );
}

export function SplashScreen({ goTo }: ScreenProps) {
  return (
    <View style={screenStyles.centerScreen}>
      <View style={screenStyles.logo}>
        <Text style={screenStyles.logoText}>S</Text>
      </View>
      <Text style={screenStyles.splashTitle}>School Management</Text>
      <Text style={screenStyles.splashSubtitle}>Manage schools, teachers, students and more</Text>
      <View style={screenStyles.dots}>
        <View style={screenStyles.dot} />
        <View style={[screenStyles.dot, screenStyles.dotActive]} />
        <View style={screenStyles.dot} />
      </View>
      <View style={screenStyles.bottomButton}>
        <Button title="Get Started" onPress={() => goTo('Login')} />
      </View>
    </View>
  );
}

export function LoginScreen({ goTo }: ScreenProps) {
  return (
    <ScrollView contentContainerStyle={screenStyles.authScreen}>
      <Text style={screenStyles.loginTitle}>Welcome Back!</Text>
      <Text style={screenStyles.loginSubtitle}>Sign in to continue</Text>
      <Field label="Email" defaultValue="admin@school.com" />
      <Field label="Password" defaultValue="password" secureTextEntry />
      <View style={screenStyles.rowBetween}>
        <Text style={screenStyles.smallText}>Remember me</Text>
        <Text style={screenStyles.linkText}>Forgot Password?</Text>
      </View>
      <Button title="Login" onPress={() => goTo('Dashboard')} />
      <Text style={screenStyles.dividerText}>Or continue with</Text>
      <View style={screenStyles.authProviders}>
        <Button title="Google" variant="secondary" />
        <Button title="Microsoft" variant="secondary" />
      </View>
      <Text style={screenStyles.footerText}>
        Do not have an account? <Text style={screenStyles.linkText}>Sign up</Text>
      </Text>
    </ScrollView>
  );
}

export function DashboardScreen(props: ScreenProps) {
  return (
    <Shell activeScreen="Dashboard" goTo={props.goTo}>
      <ScrollView style={ui.screen} showsVerticalScrollIndicator={false}>
        <Header title="Dashboard" subtitle="Welcome back, John Doe" />
        <Text style={screenStyles.apiStatus}>{props.apiMessage}</Text>
        <Card style={screenStyles.heroCard}>
          <View>
            <Text style={screenStyles.heroText}>Welcome back,</Text>
            <Text style={screenStyles.heroName}>John Doe</Text>
            <Text style={screenStyles.heroRole}>Admin</Text>
          </View>
          <View style={screenStyles.avatar}>
            <Text style={screenStyles.avatarText}>JD</Text>
          </View>
        </Card>
        <View style={screenStyles.statGrid}>
          <StatCard label="Schools" value="128" tone="blue" />
          <StatCard label="Teachers" value={String(props.teacherDashboard?.totalTeachers ?? props.teachers.length)} />
        </View>
        <View style={screenStyles.statGrid}>
          <StatCard label="Students" value="1,452" tone="green" />
          <StatCard label="Attendance" value="92%" tone="orange" />
        </View>
        <Text style={screenStyles.sectionTitle}>Recent Activities</Text>
        {activities.map((activity, index) => (
          <Card key={activity} style={screenStyles.activityCard}>
            <View style={screenStyles.activityIcon}>
              <Text style={screenStyles.activityIconText}>{index + 1}</Text>
            </View>
            <View style={screenStyles.flex}>
              <Text style={screenStyles.activityTitle}>{activity}</Text>
              <Text style={screenStyles.smallText}>{index + 1}h ago</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Shell>
  );
}

export function SchoolsScreen(props: ScreenProps) {
  return (
    <Shell activeScreen="Schools" goTo={props.goTo}>
      <View style={ui.screen}>
        <Header title="Schools" subtitle="Manage registered schools" />
        <Field label="Search" placeholder="Search schools..." />
        <ScrollView showsVerticalScrollIndicator={false}>
          {props.schools.map((school) => (
            <Pressable
              key={school.id}
              onPress={() => {
                props.selectSchool(school);
                props.goTo('Detail');
              }}
            >
              <Card style={screenStyles.schoolCard}>
                <View style={screenStyles.schoolIcon}>
                  <Text style={screenStyles.schoolIconText}>S</Text>
                </View>
                <View style={screenStyles.flex}>
                  <Text style={screenStyles.schoolName}>{school.name}</Text>
                  <Text style={screenStyles.smallText}>
                    {school.city}, {school.state}
                  </Text>
                </View>
                <Text
                  style={[
                    screenStyles.status,
                    school.status === 'Inactive' && screenStyles.statusInactive,
                  ]}
                >
                  {school.status}
                </Text>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={() => props.goTo('Register')} style={screenStyles.fab}>
          <Text style={screenStyles.fabText}>+</Text>
        </Pressable>
      </View>
    </Shell>
  );
}

export function TeachersScreen(props: ScreenProps) {
  return (
    <Shell activeScreen="Teachers" goTo={props.goTo}>
      <View style={ui.screen}>
        <Header title="Teachers" subtitle={props.selectedSchool.name} />
        <Text style={screenStyles.apiStatus}>{props.teacherMessage}</Text>
        <View style={screenStyles.statGrid}>
          <StatCard
            label="Total"
            value={String(props.teacherDashboard?.totalTeachers ?? props.teachers.length)}
            tone="blue"
          />
          <StatCard
            label="Active"
            value={String(props.teacherDashboard?.activeTeachers ?? 0)}
            tone="green"
          />
        </View>
        {props.teacherDashboard?.features.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={screenStyles.featureStrip}>
            {props.teacherDashboard.features.slice(0, 8).map((feature) => (
              <View
                key={feature.feature}
                style={[
                  screenStyles.featureChip,
                  !feature.available && screenStyles.featureChipMuted,
                ]}
              >
                <Text
                  style={[
                    screenStyles.featureChipText,
                    !feature.available && screenStyles.featureChipTextMuted,
                  ]}
                >
                  {feature.title}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <Field label="Search" placeholder="Search teachers..." />
        <ScrollView showsVerticalScrollIndicator={false}>
          {props.teachers.map((teacher) => (
            <Pressable
              key={teacher.id}
              onPress={() => {
                props.selectTeacher(teacher);
                props.goTo('TeacherDetail');
              }}
            >
              <Card style={screenStyles.schoolCard}>
                <View style={screenStyles.teacherIcon}>
                  <Text style={screenStyles.schoolIconText}>{teacher.name.slice(0, 1)}</Text>
                </View>
                <View style={screenStyles.flex}>
                  <Text style={screenStyles.schoolName}>{teacher.name}</Text>
                  <Text style={screenStyles.smallText}>
                    {teacher.specialization} • {teacher.employeeCode}
                  </Text>
                </View>
                <Text
                  style={[
                    screenStyles.status,
                    teacher.status !== 'ACTIVE' && screenStyles.statusInactive,
                  ]}
                >
                  {teacher.status}
                </Text>
              </Card>
            </Pressable>
          ))}
          {!props.teachers.length ? (
            <Card style={screenStyles.emptyCard}>
              <Text style={screenStyles.centerTitle}>No teachers found</Text>
              <Text style={screenStyles.centerSubtitle}>Create a teacher profile for this school.</Text>
            </Card>
          ) : null}
        </ScrollView>
        <Pressable onPress={() => props.goTo('TeacherForm')} style={screenStyles.fab}>
          <Text style={screenStyles.fabText}>+</Text>
        </Pressable>
      </View>
    </Shell>
  );
}

export function TeacherFormScreen({ createTeacher, goTo }: ScreenProps) {
  const [unique] = useState(() => Date.now().toString().slice(-5));
  const [employeeCode, setEmployeeCode] = useState(`T-${unique}`);
  const [name, setName] = useState('Kavita Rao');
  const [email, setEmail] = useState(`kavita.${unique}@gurukul.demo`);
  const [phone, setPhone] = useState('9000000000');
  const [qualification, setQualification] = useState('M.Sc. Physics, B.Ed.');
  const [specialization, setSpecialization] = useState('Physics');
  const [joiningDate, setJoiningDate] = useState('2025-04-01');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSubmitting(true);
    setError('');

    try {
      await createTeacher({
        employeeCode,
        name,
        email,
        phone,
        qualification,
        specialization,
        joiningDate,
        status: 'ACTIVE',
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create teacher');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell activeScreen="Teachers" goTo={goTo}>
      <ScrollView style={ui.screen} showsVerticalScrollIndicator={false}>
        <Header title="Add Teacher" subtitle="Teacher profile" back={() => goTo('Teachers')} />
        <Field label="Employee Code" value={employeeCode} onChangeText={setEmployeeCode} />
        <Field label="Full Name" value={name} onChangeText={setName} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Qualification" value={qualification} onChangeText={setQualification} />
        <Field label="Specialization" value={specialization} onChangeText={setSpecialization} />
        <Field label="Joining Date" value={joiningDate} onChangeText={setJoiningDate} placeholder="YYYY-MM-DD" />
        {error ? <Text style={screenStyles.errorText}>{error}</Text> : null}
        <Button title={submitting ? 'Saving...' : 'Create Teacher'} onPress={submit} />
      </ScrollView>
    </Shell>
  );
}

export function TeacherDetailScreen(props: ScreenProps) {
  const {
    assignTeacher,
    attendanceSummary,
    classSections,
    classStudents,
    createTeacherResource,
    createTeacherSchedule,
    generateTeacherQuiz,
    goTo,
    markTeacherAttendance,
    quizDraft,
    selectedTeacher,
    teacherResources,
    teacherSchedules,
  } = props;

  if (!selectedTeacher) {
    return (
      <Shell activeScreen="Teachers" goTo={goTo}>
        <View style={screenStyles.centerScreen}>
          <Text style={screenStyles.centerTitle}>No teacher selected</Text>
          <Button title="Back to Teachers" onPress={() => goTo('Teachers')} />
        </View>
      </Shell>
    );
  }

  return (
    <Shell activeScreen="Teachers" goTo={goTo}>
      <ScrollView style={ui.screen} showsVerticalScrollIndicator={false}>
        <Header title={selectedTeacher.name} subtitle={selectedTeacher.status} back={() => goTo('Teachers')} />
        <Card>
          <View style={screenStyles.largeTeacherIcon}>
            <Text style={screenStyles.schoolIconText}>{selectedTeacher.name.slice(0, 1)}</Text>
          </View>
          <Text style={screenStyles.centerTitle}>{selectedTeacher.name}</Text>
          <Text style={screenStyles.centerSubtitle}>{selectedTeacher.specialization}</Text>
        </Card>
        <Card style={screenStyles.detailCard}>
          <Info label="Employee Code" value={selectedTeacher.employeeCode} />
          <Info label="Email" value={selectedTeacher.email} />
          <Info label="Phone" value={selectedTeacher.phone} />
          <Info label="Qualification" value={selectedTeacher.qualification} />
          <Info label="Joining Date" value={selectedTeacher.joiningDate} />
          <Info label="Assignments" value={String(selectedTeacher.assignmentCount)} />
        </Card>
        {selectedTeacher.assignments.length ? (
          <>
            <Text style={screenStyles.sectionTitle}>Assignments</Text>
            {selectedTeacher.assignments.map((assignment) => (
              <Card key={assignment.id} style={screenStyles.activityCard}>
                <View style={screenStyles.activityIcon}>
                  <Text style={screenStyles.activityIconText}>A</Text>
                </View>
                <View style={screenStyles.flex}>
                  <Text style={screenStyles.activityTitle}>{assignment.subjectName}</Text>
                  <Text style={screenStyles.smallText}>
                    {assignment.className}-{assignment.section} • {assignment.assignmentRole}
                  </Text>
                </View>
              </Card>
            ))}
          </>
        ) : null}
        <TeacherFeatureActions
          assignTeacher={assignTeacher}
          attendanceSummary={attendanceSummary}
          classSections={classSections}
          classStudents={classStudents}
          createTeacherResource={createTeacherResource}
          createTeacherSchedule={createTeacherSchedule}
          generateTeacherQuiz={generateTeacherQuiz}
          markTeacherAttendance={markTeacherAttendance}
          quizDraft={quizDraft}
          teacherResources={teacherResources}
          teacherSchedules={teacherSchedules}
        />
      </ScrollView>
    </Shell>
  );
}

function TeacherFeatureActions({
  assignTeacher,
  attendanceSummary,
  classSections,
  classStudents,
  createTeacherResource,
  createTeacherSchedule,
  generateTeacherQuiz,
  markTeacherAttendance,
  quizDraft,
  teacherResources,
  teacherSchedules,
}: {
  assignTeacher: (payload: TeacherAssignmentPayload) => Promise<void>;
  attendanceSummary: AttendanceSummaryResponse | null;
  classSections: ClassSectionResponse[];
  classStudents: StudentResponse[];
  createTeacherResource: (payload: TeacherResourcePayload) => Promise<void>;
  createTeacherSchedule: (payload: TeacherSchedulePayload) => Promise<void>;
  generateTeacherQuiz: (payload: AiQuizPayload) => Promise<void>;
  markTeacherAttendance: (payload: AttendancePayload) => Promise<void>;
  quizDraft: AiQuizResponse | null;
  teacherResources: TeacherResourceResponse[];
  teacherSchedules: TeacherScheduleResponse[];
}) {
  const firstClassSection = classSections[0];
  const firstStudent = classStudents[0];
  const [subjectName, setSubjectName] = useState('Mathematics');
  const [resourceTitle, setResourceTitle] = useState('Fractions practice worksheet');
  const [scheduleTitle, setScheduleTitle] = useState('Linear equations test');
  const [quizTitle, setQuizTitle] = useState('Photosynthesis Quick Check');
  const [syllabus, setSyllabus] = useState('Photosynthesis, chlorophyll, stomata');
  const [message, setMessage] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const runAction = async (label: string, action: () => Promise<void>) => {
    if (!firstClassSection) {
      setMessage('No class-section found for this school.');
      return;
    }

    setBusyAction(label);
    setMessage('');

    try {
      await action();
      setMessage(`${label} completed`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed`);
    } finally {
      setBusyAction('');
    }
  };

  return (
    <View>
      <Text style={screenStyles.sectionTitle}>Teacher Features</Text>
      <Card style={screenStyles.featureCard}>
        <Text style={screenStyles.featureTitle}>Class Assignment</Text>
        <Text style={screenStyles.smallText}>
          {firstClassSection?.displayLabel ?? 'Create a class-section in backend first'}
        </Text>
        <Field label="Subject" value={subjectName} onChangeText={setSubjectName} />
        <Button
          title={busyAction === 'Assignment' ? 'Saving...' : 'Assign Teacher'}
          onPress={() =>
            runAction('Assignment', () =>
              assignTeacher({
                classSectionId: firstClassSection.id,
                subjectName,
                assignmentRole: 'SUBJECT_TEACHER',
              }),
            )
          }
        />
      </Card>

      <Card style={screenStyles.featureCard}>
        <Text style={screenStyles.featureTitle}>Resource Library</Text>
        <Field label="Title" value={resourceTitle} onChangeText={setResourceTitle} />
        <Button
          title={busyAction === 'Resource' ? 'Saving...' : 'Add Resource'}
          onPress={() =>
            runAction('Resource', () =>
              createTeacherResource({
                classSectionId: firstClassSection.id,
                subjectName,
                resourceType: 'WORKSHEET',
                title: resourceTitle,
                description: 'Practice material shared from the mobile app.',
                resourceUrl: 'https://resources.gurukul.demo/sample.pdf',
                availableOffline: true,
              }),
            )
          }
        />
        {teacherResources.slice(0, 2).map((resource) => (
          <Text key={resource.id} style={screenStyles.featureListText}>
            {resource.resourceType}: {resource.title}
          </Text>
        ))}
      </Card>

      <Card style={screenStyles.featureCard}>
        <Text style={screenStyles.featureTitle}>Quiz/Test Scheduler</Text>
        <Field label="Title" value={scheduleTitle} onChangeText={setScheduleTitle} />
        <Button
          title={busyAction === 'Schedule' ? 'Saving...' : 'Schedule Test'}
          onPress={() =>
            runAction('Schedule', () =>
              createTeacherSchedule({
                classSectionId: firstClassSection.id,
                subjectName,
                assessmentType: 'TEST',
                title: scheduleTitle,
                scheduledAt: '2026-09-10T10:30:00',
                syllabus: 'Linear equations in one variable and word problems.',
                instructions: '40 minute test. Show all steps.',
                maxMarks: 40,
                status: 'SCHEDULED',
              }),
            )
          }
        />
        {teacherSchedules.slice(0, 2).map((schedule) => (
          <Text key={schedule.id} style={screenStyles.featureListText}>
            {schedule.assessmentType}: {schedule.title}
          </Text>
        ))}
      </Card>

      <Card style={screenStyles.featureCard}>
        <Text style={screenStyles.featureTitle}>AI Quiz Generator</Text>
        <Field label="Quiz Title" value={quizTitle} onChangeText={setQuizTitle} />
        <Field label="Syllabus" value={syllabus} onChangeText={setSyllabus} multiline />
        <Button
          title={busyAction === 'AI Quiz' ? 'Generating...' : 'Generate AI Quiz'}
          onPress={() =>
            runAction('AI Quiz', () =>
              generateTeacherQuiz({
                classSectionId: firstClassSection.id,
                subjectName: 'Science',
                assessmentType: 'QUIZ',
                title: quizTitle,
                syllabus,
                difficulty: 'MEDIUM',
                questionCount: 5,
                maxMarks: 10,
                questionTypes: ['MCQ', 'SHORT_ANSWER'],
                additionalInstructions: 'Keep questions age appropriate.',
              }),
            )
          }
        />
        {quizDraft ? (
          <View style={screenStyles.quizResult}>
            <Text style={screenStyles.activityTitle}>{quizDraft.title}</Text>
            <Text style={screenStyles.smallText}>{quizDraft.reviewNote}</Text>
            {quizDraft.questions.slice(0, 3).map((question) => (
              <Text key={question.number} style={screenStyles.featureListText}>
                {question.number}. {question.question}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={screenStyles.featureCard}>
        <Text style={screenStyles.featureTitle}>Attendance</Text>
        <Text style={screenStyles.smallText}>
          {firstStudent ? `Will mark ${firstStudent.name}` : 'No students found for the first class-section.'}
        </Text>
        <Button
          title={busyAction === 'Attendance' ? 'Saving...' : 'Mark First Student Present'}
          onPress={() =>
            runAction('Attendance', async () => {
              if (!firstStudent) {
                throw new Error('No students found for this class-section.');
              }
              await markTeacherAttendance({
                classSectionId: firstClassSection.id,
                attendanceDate: '2026-07-12',
                sessionName: 'Morning',
                entries: [
                  {
                    studentId: firstStudent.id,
                    status: 'PRESENT',
                    remarks: 'Marked from Android app',
                  },
                ],
              });
            })
          }
        />
        {attendanceSummary ? (
          <Text style={screenStyles.featureListText}>
            Present {attendanceSummary.presentCount} • Absent {attendanceSummary.absentCount}
          </Text>
        ) : null}
      </Card>
      {message ? <Text style={screenStyles.apiStatus}>{message}</Text> : null}
    </View>
  );
}

export function SchoolFormScreen({ goTo, activeScreen, selectedSchool, registerSchool }: ScreenProps) {
  const isEdit = activeScreen === 'Edit';
  const [name, setName] = useState(isEdit ? selectedSchool.name : 'Greenwood High School');
  const [email, setEmail] = useState(isEdit ? selectedSchool.email : 'info@greenwood.edu');
  const [phone, setPhone] = useState(isEdit ? selectedSchool.phone : '9876543210');
  const [address, setAddress] = useState(isEdit ? selectedSchool.address : '123 School Street, Bangalore');
  const [city, setCity] = useState(isEdit ? selectedSchool.city : 'Bangalore');
  const [state, setState] = useState(isEdit ? selectedSchool.state : 'Karnataka');
  const [pincode, setPincode] = useState('560001');
  const [principalName, setPrincipalName] = useState('Dr. Anita Verma');
  const [directorName, setDirectorName] = useState('Mr. Sanjay Mehta');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (isEdit) {
      goTo('Success');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await registerSchool({
        name,
        address,
        city,
        state,
        pincode,
        contactEmail: email,
        contactPhone: phone,
        principalName,
        directorName,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to register school');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell activeScreen="Register" goTo={goTo}>
      <ScrollView style={ui.screen} showsVerticalScrollIndicator={false}>
        <Header
          title={isEdit ? 'Edit School' : 'Register School'}
          subtitle="Basic Information"
          back={() => goTo(isEdit ? 'Detail' : 'Schools')}
        />
        <Field label="School Name" value={name} onChangeText={setName} />
        <Field label="Email" value={email} onChangeText={setEmail} />
        <Field label="Phone" value={phone} onChangeText={setPhone} />
        <Field
          label="Address"
          multiline
          value={address}
          onChangeText={setAddress}
        />
        <Field label="City" value={city} onChangeText={setCity} />
        <Field label="State" value={state} onChangeText={setState} />
        <Field label="Pincode" value={pincode} onChangeText={setPincode} />
        <Field label="Principal Name" value={principalName} onChangeText={setPrincipalName} />
        <Field label="Director Name" value={directorName} onChangeText={setDirectorName} />
        {error ? <Text style={screenStyles.errorText}>{error}</Text> : null}
        <Button title={submitting ? 'Saving...' : isEdit ? 'Update' : 'Register School'} onPress={submit} />
      </ScrollView>
    </Shell>
  );
}

export function DetailScreen({ selectedSchool, goTo }: ScreenProps) {
  return (
    <Shell activeScreen="Schools" goTo={goTo}>
      <ScrollView style={ui.screen} showsVerticalScrollIndicator={false}>
        <Header title={selectedSchool.name} subtitle={selectedSchool.status} back={() => goTo('Schools')} />
        <Card>
          <View style={screenStyles.largeSchoolIcon}>
            <Text style={screenStyles.schoolIconText}>S</Text>
          </View>
          <Text style={screenStyles.centerTitle}>{selectedSchool.name}</Text>
          <Text style={screenStyles.centerSubtitle}>{selectedSchool.city}, {selectedSchool.state}</Text>
        </Card>
        <Card style={screenStyles.detailCard}>
          <Info label="Email" value={selectedSchool.email} />
          <Info label="Phone" value={selectedSchool.phone} />
          <Info label="Address" value={selectedSchool.address} />
          <Info label="Students" value={String(selectedSchool.students)} />
          <Info label="Teachers" value={String(selectedSchool.teachers)} />
        </Card>
        <View style={screenStyles.actionRow}>
          <Button title="Edit" variant="light" onPress={() => goTo('Edit')} />
          <Button title="Delete" variant="danger" />
        </View>
      </ScrollView>
    </Shell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={screenStyles.infoRow}>
      <Text style={screenStyles.infoLabel}>{label}</Text>
      <Text style={screenStyles.infoValue}>{value}</Text>
    </View>
  );
}

export function SuccessScreen({ goTo, lastRegisteredId, selectedSchool }: ScreenProps) {
  return (
    <Shell activeScreen="Register" goTo={goTo}>
      <View style={screenStyles.centerScreen}>
        <View style={screenStyles.successCircle}>
          <Text style={screenStyles.successCheck}>V</Text>
        </View>
        <Text style={screenStyles.successTitle}>School Registered Successfully!</Text>
        <Text style={screenStyles.splashSubtitle}>School has been registered successfully.</Text>
        <Card style={screenStyles.uuidBox}>
          <Text style={screenStyles.smallText}>School UUID</Text>
          <Text style={screenStyles.uuid}>{lastRegisteredId || selectedSchool.id}</Text>
        </Card>
        <Button title="View School" onPress={() => goTo('Detail')} />
        <Button title="Back to School List" variant="secondary" onPress={() => goTo('Schools')} />
      </View>
    </Shell>
  );
}

export function SettingsScreen({ goTo }: ScreenProps) {
  const items = ['Profile', 'Change Password', 'Notification', 'Language', 'Theme', 'Help & Support', 'About App'];
  return (
    <Shell activeScreen="Settings" goTo={goTo}>
      <ScrollView style={ui.screen}>
        <Header title="Settings" />
        {items.map((item) => (
          <Card key={item} style={screenStyles.menuItem}>
            <Text style={screenStyles.menuText}>{item}</Text>
            <Text style={screenStyles.chevron}>{'>'}</Text>
          </Card>
        ))}
        <Card style={screenStyles.logoutItem}>
          <Text style={screenStyles.logoutText}>Logout</Text>
        </Card>
      </ScrollView>
    </Shell>
  );
}

export function ProfileScreen({ goTo }: ScreenProps) {
  const items = ['Personal Information', 'Change Password', 'Notification Settings', 'Manage Devices'];
  return (
    <Shell activeScreen="Profile" goTo={goTo}>
      <ScrollView style={ui.screen}>
        <Header title="Profile" />
        <Card style={screenStyles.profileHero}>
          <View style={screenStyles.avatar}>
            <Text style={screenStyles.avatarText}>JD</Text>
          </View>
          <View>
            <Text style={screenStyles.schoolName}>John Doe</Text>
            <Text style={screenStyles.smallText}>Admin</Text>
            <Text style={screenStyles.smallText}>admin@school.com</Text>
          </View>
        </Card>
        {items.map((item) => (
          <Card key={item} style={screenStyles.menuItem}>
            <Text style={screenStyles.menuText}>{item}</Text>
            <Text style={screenStyles.chevron}>{'>'}</Text>
          </Card>
        ))}
      </ScrollView>
    </Shell>
  );
}

const screenStyles = StyleSheet.create({
  centerScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    height: 82,
    justifyContent: 'center',
    width: 82,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
  },
  splashTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 24,
  },
  splashSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 24,
  },
  dot: {
    backgroundColor: colors.line,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },
  bottomButton: {
    bottom: 36,
    left: 24,
    position: 'absolute',
    right: 24,
  },
  authScreen: {
    backgroundColor: '#FFFFFF',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loginTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  loginSubtitle: {
    color: colors.muted,
    marginBottom: 24,
    marginTop: 4,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  smallText: {
    color: colors.muted,
    fontSize: 12,
  },
  linkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    marginVertical: 18,
    textAlign: 'center',
  },
  authProviders: {
    flexDirection: 'row',
    gap: 12,
  },
  footerText: {
    color: colors.muted,
    marginTop: 22,
    textAlign: 'center',
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  apiStatus: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  heroText: {
    color: '#DBEAFE',
    fontWeight: '700',
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 3,
  },
  heroRole: {
    color: '#DBEAFE',
    marginTop: 2,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '900',
  },
  statGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 8,
  },
  featureCard: {
    gap: 10,
    marginBottom: 12,
  },
  featureStrip: {
    marginBottom: 12,
  },
  featureChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  featureChipMuted: {
    backgroundColor: colors.soft,
  },
  featureChipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  featureChipTextMuted: {
    color: colors.muted,
  },
  featureTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  featureListText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },
  quizResult: {
    backgroundColor: colors.soft,
    borderRadius: radius.sm,
    padding: 10,
  },
  activityCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  activityIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  activityIconText: {
    color: colors.primary,
    fontWeight: '900',
  },
  activityTitle: {
    color: colors.ink,
    fontWeight: '800',
  },
  flex: {
    flex: 1,
  },
  schoolCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  schoolIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  teacherIcon: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  schoolIconText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  schoolName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  status: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusInactive: {
    backgroundColor: colors.soft,
    color: colors.muted,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 28,
    bottom: 18,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    width: 56,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '500',
  },
  largeSchoolIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    marginBottom: 12,
    width: 52,
  },
  largeTeacherIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.success,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    marginBottom: 12,
    width: 52,
  },
  emptyCard: {
    marginTop: 12,
  },
  centerTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  centerSubtitle: {
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  detailCard: {
    marginTop: 12,
  },
  infoRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoLabel: {
    color: colors.muted,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.ink,
    flex: 1,
    fontWeight: '800',
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  successCircle: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 42,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  successCheck: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
  },
  successTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 20,
    textAlign: 'center',
  },
  uuidBox: {
    marginBottom: 14,
    marginTop: 24,
    width: '100%',
  },
  uuid: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  menuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  menuText: {
    color: colors.ink,
    fontWeight: '800',
  },
  chevron: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '800',
  },
  logoutItem: {
    borderColor: '#FEE2E2',
  },
  logoutText: {
    color: colors.danger,
    fontWeight: '900',
  },
  profileHero: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
});
