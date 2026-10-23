/* ─────────────────────────────────────────────────────────────
   Colleges and the departments under each one.

   Source: Student masterlist AY 2025-2026 (18 colleges, 57 departments).

   Used by the Register page. Use this SAME file anywhere else a
   college or department is typed or chosen (for example the Admin
   "Add User" form), because AYON matches these names exactly to
   decide which college's proposals an endorser can see.
   ───────────────────────────────────────────────────────────── */
export const COLLEGE_DEPARTMENTS = {
  'College of Agriculture': [
    'Agribusiness Management Department',
    'Agricultural Education and Extension Department',
    'Animal Science Department',
    'Plant Science Department',
  ],
  'College of Business Administration and Accountancy': [
    'Accountancy Department',
    'Economics Department',
    'Management Department',
    'Marketing Department',
  ],
  'College of Education': [
    'Elementary Education Department',
    'Home Economics Department',
    'Secondary Education Department',
  ],
  'College of Engineering': [
    'Agricultural Engineering Department',
    'Chemical Engineering Department',
    'Civil Engineering Department',
    'Electrical Engineering Department',
    'Mechanical Engineering Department',
  ],
  'College of Fisheries and Aquatic Sciences': [
    'Fisheries Department',
    'Fisheries Technology',
  ],
  'College of Forestry and Environmental Studies': [
    'Environmental Studies Department',
    'Forestry Department',
  ],
  'College of Health Sciences': [
    'Midwifery Department',
    'Nursing Department',
  ],
  'College of Hospitality and Tourism Management': [
    'Hospitality Management Department',
    'Tourism Management Department',
  ],
  'College of Information and Computing Sciences': [
    'Department of Computing Sciences',
    'Department of Information Sciences',
  ],
  'College of Law': [
    'Law Department',
  ],
  'College of Medicine': [
    'Medicine Department',
  ],
  'College of Natural Sciences and Mathematics': [
    'Biology Department',
    'Chemistry Department',
    'Mathematics Department',
    'Physics Department',
  ],
  'College of Public Affairs': [
    'Community Development Department',
    'Public Administration Department',
    'Social Work Department',
  ],
  'College of Social Sciences and Humanities': [
    'Communication & Media Studies Department',
    'English Department',
    'Filipino Department',
    'History Department',
    'Library & Information Science Department',
    'Philosophy Department',
    'Political Science Department',
    'Psychology Department',
    'Sociology Department',
  ],
  'College of Sports, Physical Education and Recreation': [
    'Professional Studies Department',
  ],
  'Division of Engineering Technology': [
    'Metal Department',
    'Wood Department',
  ],
  'King Faisal Center for Islamic, Arabic and Asian Studies': [
    'International Relations Department',
    'Islamic Banking and Finance Department',
    'Islamic Studies Department',
    'Teaching Arabic Department',
  ],
};

export const COLLEGES = Object.keys(COLLEGE_DEPARTMENTS);

/* Departments of one college (empty list until a college is chosen). */
export const getDepartments = (college) => COLLEGE_DEPARTMENTS[college] || [];