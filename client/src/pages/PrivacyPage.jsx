import React from 'react';
import LegalLayout from '../components/LegalLayout';
import { OFFICE_NAME, OFFICE_ADDRESS, CONTACT_EMAIL } from '../data/legalInfo';

const SECTIONS = [
  {
    title: 'Who is responsible for your information',
    body: [
      `AYON is operated by the ${OFFICE_NAME}, ${OFFICE_ADDRESS}. MSIRC decides how the personal information in AYON is used. We handle it in line with the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules.`,
    ],
  },
  {
    title: 'Information we collect',
    body: ['When you create an account, we collect:'],
    list: [
      'your name, your email address, and, if you choose to give it, your contact number;',
      'your college and department;',
      'your password, which is saved only in scrambled (hashed) form so that nobody can read it.',
    ],
  },
  {
    title: 'Information created as you use AYON',
    list: [
      'the research proposals you submit, including titles, descriptions, and the documents you upload;',
      'grant and incentive applications and the details you enter in them;',
      'externally funded research you upload;',
      'review, validation, and endorsement records, including remarks added by MSIRC and college officers;',
      'notifications sent to you, and a log of the emails the system sends;',
      'a sign-in token kept in your browser so that you stay signed in.',
    ],
  },
  {
    title: 'How we use your information',
    list: [
      'to create and secure your account and to confirm your email address;',
      'to process your proposals and grant applications through the review and approval steps;',
      'to tell you about decisions and status changes by email and inside the system;',
      'to store approved and externally funded research in the digital repository;',
      'to prepare reports on research activity for MSIRC and university officials;',
      'to keep AYON secure and prevent misuse.',
    ],
  },
  {
    title: 'Who can see your information',
    body: ['What a person can see depends on their role and on the task they are doing:'],
    list: [
      'you can see your own account, proposals, grant applications, and notifications;',
      'Research Coordinators, Chairpersons, and College Deans can see submissions from their own college or department so they can endorse them;',
      'the MSRIC Special Assistant, Director, staff, and OVCRED can see submissions that reach their step of the process;',
      'system administrators can manage accounts and see system records;',
      'items marked Public in the repository can be viewed by others, while items marked Private are limited to authorized AYON users.',
    ],
    after: ['We do not sell your personal information.'],
  },
  {
    title: 'Service providers',
    body: [
      'AYON runs on cloud services that provide hosting, database and file storage, and email delivery. These providers handle information only to provide those services to AYON. We do not share your information with anyone else, except when the law or a lawful order requires it.',
    ],
  },
  {
    title: 'How we protect your information',
    list: [
      'passwords are hashed and are never stored as plain text;',
      'access is controlled by role, and college-level officers see only their own college or department;',
      'connections to the live AYON website are encrypted;',
      'email verification helps make sure each account belongs to a real email address.',
    ],
    after: [
      'No system is completely secure. If a security incident affects your personal information, we will act on it and inform you and the National Privacy Commission as the law requires.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'We keep your account information while your account is active. Research records, approvals, and repository items are kept as part of MSIRC’s official records for as long as they are needed for the purposes above and for the record-keeping the university and the law require. When information is no longer needed, it is deleted or made anonymous where the law allows.',
    ],
  },
  {
    title: 'Your rights',
    body: ['Under the Data Privacy Act, you have the right to:'],
    list: [
      'be informed about how your personal information is used;',
      'see the personal information we hold about you;',
      'correct information that is wrong or out of date;',
      'object to the use of your information, or ask for it to be blocked or removed in the cases the law allows;',
      'get a copy of your information in a common format, where it applies;',
      'claim compensation if you are harmed by information that is wrong, incomplete, or used unlawfully;',
      'file a complaint with the National Privacy Commission (www.privacy.gov.ph).',
    ],
    after: [
      'To use any of these rights, contact the MSIRC office. We may ask you to confirm who you are first.',
    ],
  },
  {
    title: 'Cookies and browser storage',
    body: [
      'AYON does not use advertising or tracking cookies. It keeps a sign-in token in your browser so that you stay signed in. You can remove it by logging out or by clearing your browser data.',
    ],
  },
  {
    title: 'Children',
    body: [
      'AYON is for university faculty, researchers, and staff. It is not meant for children.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'We may update this Privacy Policy. The date at the top of this page shows when it was last changed. Important changes will be announced in the system.',
    ],
  },
  {
    title: 'Contact us',
    body: [
      `For questions about this policy or your personal information, contact the ${OFFICE_NAME}, ${OFFICE_ADDRESS}.`,
      ...(CONTACT_EMAIL
        ? [<>You may also write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>]
        : []),
    ],
  },
];

const PrivacyPage = () => (
  <LegalLayout
    title="Privacy Policy"
    intro="This policy explains what personal information AYON collects, why we collect it, how it is used and protected, and the rights you have over it."
    sections={SECTIONS}
  />
);

export default PrivacyPage;