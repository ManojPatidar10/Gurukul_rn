export type School = {
  id: string;
  name: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  address: string;
  status: 'Active' | 'Inactive';
  students: number;
  teachers: number;
};

export const schools: School[] = [
  {
    id: 'SCH-1001',
    name: 'Greenwood High School',
    city: 'Bangalore',
    state: 'Karnataka',
    email: 'info@greenwood.edu',
    phone: '+91 98765 43210',
    address: '123 School Street, Bangalore',
    status: 'Active',
    students: 128,
    teachers: 42,
  },
  {
    id: 'SCH-1002',
    name: 'Sunrise Public School',
    city: 'Mysore',
    state: 'Karnataka',
    email: 'hello@sunrise.edu',
    phone: '+91 91234 56780',
    address: '44 Lake Road, Mysore',
    status: 'Active',
    students: 256,
    teachers: 58,
  },
  {
    id: 'SCH-1003',
    name: 'Bluebell International',
    city: 'Hubli',
    state: 'Karnataka',
    email: 'office@bluebell.edu',
    phone: '+91 99887 76655',
    address: '9 Campus Avenue, Hubli',
    status: 'Active',
    students: 342,
    teachers: 64,
  },
  {
    id: 'SCH-1004',
    name: 'Silver Oak School',
    city: 'Mangalore',
    state: 'Karnataka',
    email: 'contact@silveroak.edu',
    phone: '+91 90000 45678',
    address: '18 Garden Lane, Mangalore',
    status: 'Inactive',
    students: 186,
    teachers: 39,
  },
];

export const activities = [
  'Greenwood High School registered',
  'John Doe added a new teacher',
  'Monthly report generated',
];

