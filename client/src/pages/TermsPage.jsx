import React from 'react';
import LegalLayout from '../components/LegalLayout';
import { OFFICE_NAME, OFFICE_ADDRESS, CONTACT_EMAIL } from '../data/legalInfo';

const SECTIONS = [
  {
    title: 'Agreeing to these Terms',
    body: [
      'By creating an AYON account or using AYON, you agree to these Terms of Service. If you do not agree, please do not create an account or use the system.',
      'These Terms work together with our Privacy Policy, which explains how your personal information is handled.',
    ],
  },
  {
    title: 'What AYON is',
    body: [
      `AYON is the Web-Based Integrated Research Services Management System of the ${OFFICE_NAME}. It lets researchers submit research proposals and documents online, apply for grants and incentives, upload externally funded research, and track the review and approval of their submissions. It also keeps approved research in a digital repository.`,
    ],
  },
  {
    title: 'Your account',
    list: [
      'Anyone who registers on the AYON website is given a Researcher account. Accounts for MSIRC staff, college officers, the Special Assistant, the Director, OVCRED, and administrators are created only by the system administrator.',
      'You must give accurate and complete information, including an email address that you can open. We send a verification link to that address, and your account stays locked until you confirm it.',
      'Keep your password private. You are responsible for everything done through your account, so do not share it with anyone.',
      'Tell the MSIRC office right away if you think someone else has used your account.',
      'Each person should have only one account.',
    ],
  },
  {
    title: 'What you submit',
    body: [
      'You remain the owner of the research and documents you submit, subject to the research and intellectual property policies of Mindanao State University and any agreements with your funding agency.',
    ],
    list: [
      'You confirm that you have the right to submit what you upload, that it is your own work or properly credited, and that it is not plagiarized or falsified.',
      'You allow MSIRC and the university officers involved in the review process to store, open, process, and review your submissions in AYON.',
      'If your research is stored in the repository, you allow it to be shown according to its access setting: Public items can be viewed by others, and Private items are limited to authorized AYON users.',
      'Do not upload files that contain viruses or harmful code, or personal information about other people that you have no right to share.',
    ],
  },
  {
    title: 'Review and approval',
    body: [
      'Submitting a proposal or a grant application does not guarantee that it will be approved or funded. Proposals pass through endorsement, document validation, review by the MSRIC Director, and final approval by OVCRED. Any of these officers may approve, return, or reject a submission and may add remarks.',
      'Decisions are made by the responsible university officers. AYON only records and delivers them.',
    ],
  },
  {
    title: 'Using AYON properly',
    body: ['When using AYON, you agree not to:'],
    list: [
      'give false information or submit false or misleading research data;',
      'try to see, change, or delete another person’s information, or get around the role-based access rules;',
      'try to break, overload, scan, or test the security of the system without written permission;',
      'upload anything unlawful, offensive, or harmful;',
      'use the system for any purpose other than research administration at MSIRC.',
    ],
  },
  {
    title: 'Notifications',
    body: [
      'AYON sends notifications about your submissions, decisions, and account by email and inside the system. Please keep your email address correct and check your spam folder if a message does not arrive. Important notices sent to the email address on your account are treated as delivered to you.',
    ],
  },
  {
    title: 'Availability of the system',
    body: [
      'We work to keep AYON available, but it may sometimes be slow, unavailable, or changed because of maintenance, updates, or problems outside our control. AYON is provided “as is”. Please keep your own copies of your important files and research, as we cannot promise that nothing will ever be lost.',
    ],
  },
  {
    title: 'Suspension and closing of accounts',
    body: [
      'MSIRC may deactivate or limit an account that breaks these Terms, contains false information, or is being used in a way that puts the system or other users at risk. You may ask the MSIRC office to close your account. Research records that are already part of the official review, approval, and repository records may be kept as described in the Privacy Policy.',
    ],
  },
  {
    title: 'Ownership of AYON',
    body: [
      'The AYON software, its design, and the AYON logo are protected. You may not copy, change, sell, or reuse them without permission.',
    ],
  },
  {
    title: 'Limits of responsibility',
    body: [
      'To the extent allowed by law, MSIRC and the developers of AYON are not responsible for losses that come from using or not being able to use the system, including lost data, missed deadlines, or decisions made on submissions. Nothing in these Terms limits any right you have under the law that cannot be limited.',
    ],
  },
  {
    title: 'Changes to these Terms',
    body: [
      'We may update these Terms from time to time. The date at the top of this page shows when they were last changed. If you keep using AYON after a change, you accept the updated Terms. Important changes will be announced in the system.',
    ],
  },
  {
    title: 'Governing law',
    body: ['These Terms are governed by the laws of the Republic of the Philippines.'],
  },
  {
    title: 'Contact us',
    body: [
      `Questions about these Terms can be sent to the ${OFFICE_NAME}, ${OFFICE_ADDRESS}.`,
      ...(CONTACT_EMAIL
        ? [<>You may also write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>]
        : []),
    ],
  },
];

const TermsPage = () => (
  <LegalLayout
    title="Terms of Service"
    intro="Please read these Terms carefully. They explain the rules for using AYON and what you can expect from us."
    sections={SECTIONS}
  />
);

export default TermsPage;