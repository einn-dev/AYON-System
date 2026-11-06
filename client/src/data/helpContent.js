/* ─────────────────────────────────────────────────────────────
   Help and User Guide text.
   Write **bold** with two stars. Each guide: { id, title, steps: [...] }.
   Change the wording here; the Help page and the search box both read it.
   ───────────────────────────────────────────────────────────── */

/* MSIRC contact details shown on the Help page. Replace the placeholders. */
export const CONTACT = {
  office:   'Mamitua Saber Institute of Research and Creation',
  campus:   'MSU – Main Campus, Marawi City',
  location: 'Office location (to be filled in)',
  email:    'msirc@msumain.edu.ph (to be confirmed)',
  phone:    'Phone number (to be filled in)',
  hours:    'Monday to Friday, 8:00 AM to 5:00 PM (to be confirmed)',
};

const SIGNATURE = {
  id: 'signature',
  title: 'Set up your signature (once)',
  steps: [
    'Click your name at the bottom of the sidebar to open your profile.',
    'Under **My Signature**, choose **Draw** and sign inside the box, or **Upload** a PNG or JPG picture of your signature.',
    'Click **Save Signature**. You can **Replace** or **Remove** it later; proposals you already signed keep their signature.',
  ],
};

const PROFILE = {
  id: 'profile',
  title: 'Update your profile and password',
  steps: [
    'Click your name at the bottom of the sidebar.',
    'Change your photo, name, college, department or contact number, then click **Save Changes**.',
    'To change your password, use the **Change password** box in the same window.',
  ],
};

const COLLEGE = [
  SIGNATURE,
  {
    id: 'endorse',
    title: 'Endorse and sign a proposal',
    steps: [
      'Go to **For Endorsement**. Only proposals waiting for **you** are listed.',
      'Click **Review** and read the details and the document.',
      'Write your **remarks** (at least 10 characters).',
      'Tick the box under your signature, then click **Endorse and Sign**.',
      'It goes to the next person: Chairperson → Research Coordinator → College Dean → Special Assistant.',
    ],
  },
  {
    id: 'return',
    title: 'Return a proposal to the researcher',
    steps: [
      'Open the proposal from **For Endorsement**.',
      'Write what the researcher needs to fix in **Remarks** (at least 10 characters).',
      'Click **Return to Researcher**, then **Yes, Return It**. Returning never signs.',
      'After the researcher resubmits, it starts again from the Department Chairperson.',
    ],
  },
  {
    id: 'history',
    title: 'See what you endorsed or returned',
    steps: [
      'Go to **Endorsed Proposals**.',
      'Each row shows what you did, your remarks, the round, and where the proposal is now.',
    ],
  },
  PROFILE,
];

export const GUIDES = {
  researcher: [
    {
      id: 'submit',
      title: 'Submit a proposal',
      steps: [
        'Go to **My Proposals** and click **Submit Proposal**.',
        'Choose the **proposal type**, then click **Next**.',
        'Type the **research title** and the **abstract**, then click **Next**.',
        'Attach your proposal file (PDF, DOC or DOCX, up to 10 MB).',
        'Check the summary and click **Submit Proposal**. It goes first to your **Department Chairperson**.',
      ],
    },
    {
      id: 'track',
      title: 'Track where your proposal is',
      steps: [
        'Open **My Proposals**. The **Status** column shows the status and, under it, who has the proposal now.',
        'Click **View Details** to see the tracker: the college steps (Chairperson, Research Coordinator, Dean) and the office steps (Special Assistant, MSIRC Director, OVCRED).',
        'The **Signatures** section shows who has signed and who is next.',
        'You also get a notification (and an email) each time it moves.',
      ],
    },
    {
      id: 'resubmit',
      title: 'Edit and resubmit a returned proposal',
      steps: [
        'A returned proposal shows a red **Returned for Revision** badge and a banner at the top of My Proposals.',
        'Click **Edit and Resubmit**. The reason from the person who returned it is shown at the top.',
        'Change the title or the abstract, or attach a new file.',
        'Click **Resubmit**. It starts again from the **Department Chairperson** (a new round).',
      ],
    },
    {
      id: 'grants',
      title: 'Apply for a grant or incentive',
      steps: [
        'Go to **Grants and Incentives**. Your **approved** proposals are listed.',
        'Click **Apply for Grant** next to the proposal and choose the grant type.',
        'Fill in the details the form asks for, then submit.',
        'The result appears under **My Grant Applications**.',
      ],
    },
    {
      id: 'external',
      title: 'Record externally funded research',
      steps: [
        'Go to **External Research**.',
        'Fill in the title, funding agency, amount, dates and abstract, and attach the document.',
        'Click **Upload and Archive**. It appears under **My External Research**.',
      ],
    },
    PROFILE,
  ],
  chairperson:          COLLEGE,
  research_coordinator: COLLEGE,
  college_dean:         COLLEGE,
  special_assistant: [
    SIGNATURE,
    {
      id: 'validate',
      title: 'Validate and forward a proposal',
      steps: [
        'Go to **For Validation** and click **Review**.',
        'Open the document and tick each requirement in the **Document Checklist**.',
        'Tick the box under your signature, then click **Validate and Forward**. It goes to the MSIRC Director.',
      ],
    },
    {
      id: 'return',
      title: 'Return a proposal to the researcher',
      steps: [
        'Write what the researcher must fix in **Remarks** (at least 10 characters).',
        'Click **Return to Researcher**. The researcher sees your remarks as the reason.',
      ],
    },
    {
      id: 'find',
      title: 'Find any proposal',
      steps: ['Use **All Proposals**, or the **search box** at the top of every page (or press **Ctrl K**).'],
    },
    PROFILE,
  ],
  msric_director: [
    SIGNATURE,
    {
      id: 'review',
      title: 'Endorse to OVCRED or approve',
      steps: [
        'Go to **For Review** and click **Review**.',
        'Write your remarks (optional).',
        'Tick the box under your signature.',
        'Click **Endorse to OVCRED** (OVCRED gives final approval) or **Approve** (it stays within MSIRC).',
      ],
    },
    {
      id: 'return',
      title: 'Return or reject a proposal',
      steps: [
        '**Return to Researcher** asks for a reason; the researcher can fix it and resubmit.',
        '**Reject** ends the proposal; write your remarks first. Neither one signs.',
      ],
    },
    {
      id: 'reports',
      title: 'Make a report',
      steps: [
        'Go to **Reports** and choose the filters (period, college, status, type).',
        'Click **Download PDF** or **Download CSV** on the report you need: Proposals, Grants and Incentives, Research Repository or Summary.',
        'The list at the bottom shows the reports you made.',
      ],
    },
    PROFILE,
  ],
  ovcred: [
    SIGNATURE,
    {
      id: 'approve',
      title: 'Grant final approval',
      steps: [
        'Go to **For Final Approval** and click **Review**.',
        'Leave **Store to Repository** ticked to archive the research automatically.',
        'Tick the box under your signature, then click **Grant Final Approval**.',
      ],
    },
    {
      id: 'return',
      title: 'Return or reject a proposal',
      steps: ['**Return to Researcher** asks for a reason. **Reject** ends the proposal. Neither one signs.'],
    },
    {
      id: 'repository',
      title: 'Add research to the Repository',
      steps: ['Go to **Research Repository** and choose **From Approved Proposals**, or add one by hand.'],
    },
    {
      id: 'reports',
      title: 'Make a report',
      steps: [
        'Go to **Reports** and choose the filters (period, college, status, type).',
        'Click **Download PDF** or **Download CSV** on the report you need: Proposals, Grants and Incentives, Research Repository or Summary.',
        'The list at the bottom shows the reports you made.',
      ],
    },
    PROFILE,
  ],
  msric_staff: [
    {
      id: 'list',
      title: 'View proposals',
      steps: [
        'Go to **All Proposals**. You see proposals that reached the Special Assistant: title, researcher, college, type, status and date.',
        'You cannot open the proposal contents or change anything.',
      ],
    },
    {
      id: 'repository',
      title: 'Browse the Research Repository',
      steps: ['Go to **Research Repository** and search by title, author or keyword.'],
    },
    {
      id: 'notifications',
      title: 'Your notifications',
      steps: [
        'AYON tells you when a proposal **reaches MSIRC**, when a proposal is **approved or rejected**, and when research is **added to the Repository**.',
        'Click the bell at the top, or **Notifications** in the sidebar. Use the filter to show only one kind.',
        'Click **Open** to see that proposal in **All Proposals** (it is highlighted), or the Repository.',
      ],
    },
    PROFILE,
  ],
  admin: [
    {
      id: 'users',
      title: 'Create and manage accounts',
      steps: [
        'Go to **User Accounts** and click **Add User**.',
        'Fill in the name, email, a starting password (at least 8 characters), role, college and department, then click **Create User**.',
        'Use the row actions to edit, change the role, **reset the password** (AYON shows a temporary password once; give it to the person), or deactivate an account.',
      ],
    },
    {
      id: 'oversight',
      title: 'Watch and fix proposals',
      steps: [
        '**All Proposals** shows every proposal, who has it, and how many days it has waited.',
        'Open a proposal: **Send Reminder** notifies the people who have it; **Move Proposal** changes the stage when something is stuck (a reason is required and recorded).',
      ],
    },
    {
      id: 'announce',
      title: 'Post an announcement',
      steps: [
        'Go to **Announcements** and click **New Announcement**.',
        'Write the title and message, choose Info, Reminder or Urgent, who sees it, and the dates.',
        'Click **Post Announcement**. It shows at the top of their dashboards.',
      ],
    },
    {
      id: 'reports',
      title: 'Make a report',
      steps: [
        'Go to **Reports** and choose the report and the filters (period, college, status, type).',
        'Click **Download PDF** or **Download CSV**.',
      ],
    },
    {
      id: 'logs',
      title: 'Check the Audit Log and the Email Log',
      steps: [
        '**Audit Log** lists who did what and when, including every signature.',
        '**Email Log** lists every email AYON sent and whether it was delivered.',
      ],
    },
  ],
};

/* What each status means (in the order a proposal moves) */
export const STATUS_HELP = [
  ['draft',           'Not submitted yet.'],
  ['for_endorsement', 'At the college: the Chairperson, Research Coordinator and Dean endorse it, in that order.'],
  ['submitted',       'With the Special Assistant, who checks the documents.'],
  ['under_review',    'With the MSIRC Director.'],
  ['endorsed',        'Endorsed by the Director; waiting for OVCRED\'s final approval.'],
  ['returned',        'Sent back to the researcher to fix. After resubmitting, it starts again from the Chairperson.'],
  ['approved',        'Approved.'],
  ['rejected',        'Not approved. It cannot be resubmitted.'],
];

export const WHO_SIGNS = [
  ['Chairperson, Research Coordinator, College Dean', '**Endorse and Sign**'],
  ['Special Assistant',                               '**Validate and Forward**'],
  ['MSIRC Director',                                  '**Endorse to OVCRED** or **Approve**'],
  ['OVCRED',                                          '**Grant Final Approval**'],
];

export const FAQ = [
  ['I forgot my password.', 'On the login page, click **Forgot password?** and enter your email. You get a link to set a new password.'],
  ['I did not receive the email.', 'Check your Spam folder. Then use the resend link on the login page, or ask the Administrator.'],
  ['Why can\'t I endorse this proposal?', 'It is not your turn yet (the tracker shows who has it), you have not set up **My Signature**, or the box under your signature is not ticked.'],
  ['Why is the Endorse and Sign button grey?', 'Write your remarks (at least 10 characters) and tick the box under your signature.'],
  ['My proposal was returned. What now?', 'Open it from **My Proposals**, read the reason, click **Edit and Resubmit**, fix it, and resubmit.'],
  ['Can I change my college or department?', 'Yes, in your profile. If your role depends on your college (Coordinator, Chairperson, Dean), ask the Administrator first.'],
  ['Who can see my proposal?', 'You, the endorsers of your college or department, the MSIRC office, OVCRED and the Administrator. MSIRC Staff see only the title, status and dates.'],
];

export const guidesFor = (role) => GUIDES[role] || [];

/* Everything searchable on the Help page, for the search box: [{ id, title, text }] */
export const helpIndex = (role) => [
  ...guidesFor(role).map(g => ({ id: g.id, title: g.title, text: g.steps.join(' ') })),
  { id: 'statuses', title: 'What each status means', text: STATUS_HELP.map(s => s.join(' ')).join(' ') },
  { id: 'signs',    title: 'Who signs, and when',    text: WHO_SIGNS.map(s => s.join(' ')).join(' ') },
  { id: 'faq',      title: 'Frequently asked questions', text: FAQ.map(f => f.join(' ')).join(' ') },
  { id: 'contact',  title: 'Contact MSIRC',          text: Object.values(CONTACT).join(' ') },
].map(x => ({ ...x, text: x.text.replace(/\*\*/g, '') }));