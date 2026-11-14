/* ─────────────────────────────────────────────────────────────
   Help and User Guide text.
   Write **bold** with two stars. Each guide: { id, title, steps: [...] }.
   Change the wording here; the Help page and the search box both read it.
   ───────────────────────────────────────────────────────────── */

/* MSIRC contact details shown on the Help page.
   Source: the official MSIRC page, msumain.edu.ph/msirc/ */
export const CONTACT = {
  office:   'Mamitua Saber Institute of Research and Creation',
  campus:   'MSU – Main Campus, Marawi City',
  location: 'MSIRC Building, 2nd Street',
  email:    'msirc@msumain.edu.ph',
  phone:    '+63 970 6998 199',
  hours:    'Monday to Friday, 8:00 AM to 5:00 PM',
};

const SIGNATURE = {
  id: 'signature',
  title: 'Set up your digital signature (once)',
  steps: [
    'Click your name at the bottom of the sidebar to open **My Profile**, then open the **Digital Signature** tab.',
    'Choose **Draw** and sign inside the box, or **Upload** a PNG or JPG picture of your signature.',
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
      'Click **Review**. Read the details, the filled-in form (Form 005, the Research Spotlight entry, or Forms 001 to 004 and 008) and each document.',
      'If the form has a checklist for you, tick each item, or choose the answer it asks for (for example the Coordinator\'s clearance on Form 001). An item that is missing is a reason to return it instead.',
      'Write your **remarks** (at least 10 characters).',
      'Tick the box under your signature, then click **Endorse and Sign**. It cannot be signed until your checklist is complete.',
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
      title: 'Submit research',
      steps: [
        'Go to **My Research** and click **Submit Research**. My Research is for **Research Spotlight**, **Internally Funded Research** and **Externally Funded Research**.',
        'Choose the type, then click **Next**.',
        '**Research Spotlight:** read the guidelines at the top, then fill in the abstract (300 words at most), keywords, research cluster, Oral or Poster, the authors and the presenting author. The title can have at most 15 words.',
        '**Internally Funded Research:** fill in Form 005 section by section: proponents, executive summary (300 words at most), introduction, objectives, significance, expected output, R&D priority area, literature, methodology, references, the 5-month work plan, the budget and duties. The budget adds up by itself and cannot be over ₱50,000.00.',
        '**Externally Funded Research:** type the title and the abstract.',
        'Attach the documents. Each type lists what it needs; those marked * are required. PDF, DOC or DOCX, up to 10 MB each.',
        'Check the summary and click **Submit Research**. It goes first to your **Department Chairperson**.',
      ],
    },
    {
      id: 'draft',
      title: 'Save a draft and finish it later',
      steps: [
        'On any step of **Submit Research** or **Submit Application**, click **Save as Draft**. Only the type is needed; everything else can wait.',
        'Only you can see a draft. Nobody is notified and nothing is signed.',
        'To continue, open **My Research** (or **Grants and Incentives** for an application) and click **Continue Editing** next to the draft.',
        'When it is ready, go to the last step and submit it. To throw a draft away, click **Delete**.',
      ],
    },
    {
      id: 'track',
      title: 'Track where your proposal is',
      steps: [
        'Open **My Research** or **Grants and Incentives**. The **Status** column shows the status and, under it, who has the proposal now.',
        'Click **View Details** to see the tracker: the college steps (Chairperson, Research Coordinator, Dean) and the office steps (Special Assistant, MSIRC Director, OVCRED).',
        'The **Signatures** section shows who has signed and who is next.',
        'You also get a notification (and an email) each time it moves.',
      ],
    },
    {
      id: 'resubmit',
      title: 'Edit and resubmit a returned proposal',
      steps: [
        'A returned proposal shows a red **Returned for Revision** badge and a banner at the top of the page.',
        'Click **Edit and Resubmit**. The reason from the person who returned it is shown at the top.',
        'Fix what was asked: the title, the form\'s fields (for example the conference, dates, budget or work plan), and the documents. Replace a document or attach one that was missing; documents you leave alone are kept.',
        'Click **Resubmit**. It starts again from the **Department Chairperson** (a new round).',
      ],
    },
    {
      id: 'grants',
      title: 'Apply for a grant or incentive',
      steps: [
        'Go to **Grants and Incentives** and click **Submit Application**.',
        'Choose **Travel Subsidy**, **Oral Presentation** or **Publication Incentive**, then which form applies:',
        '**Travel Subsidy:** Form 001 to **present a paper** (needs an approved Research Spotlight), or Form 008 to **attend a conference** without a paper. Submit at least one month before the conference.',
        '**Oral Presentation:** Form 003, the cash incentive for a paper you presented abroad or at an international conference. Needs an approved Research Spotlight.',
        '**Publication Incentive:** Form 002 for a journal article, or Form 004 for a book or book chapter.',
        'For Form 001 and Form 003, choose which of your **approved Research Spotlight** entries the application is for.',
        'Fill in the form\'s details, attach each document it asks for, and click **Submit Application**. You can also **Save as Draft**.',
        'It goes through the same offices as your research: Chairperson, Research Coordinator, Dean, Special Assistant, Director and OVCRED. Each one ticks its part of the form.',
      ],
    },
    {
      id: 'amounts',
      title: 'Grant and incentive amounts',
      steps: [
        'The amounts are set by the University\'s policies. The **Special Assistant** checks your eligibility and enters the amount; AYON does not compute it.',
        '**Journal article (Form 002, BOR Res. No. 327, s. 2024):** SCOPUS-indexed journal Q1 ₱60,000, Q2 ₱55,000, Q3 ₱50,000, Q4 ₱45,000. A full paper in a SCOPUS-indexed conference proceeding: ₱20,000.',
        '**Book or book chapter (Form 004, BOR Res. No. 223, s. 2024):** Book: international circulation ₱50,000, national ₱40,000, limited ₱20,000. Book chapter: ₱20,000, ₱10,000 or ₱5,000.',
        '**Paper presentation (Form 003, BOR Res. No. 272, s. 2019):** depends on the type of presentation. Ask MSIRC for the current amounts.',
        '**Internally Funded Research (Form 005, BOR Res. No. 221, s. 2024):** up to ₱50,000.00 for one semester, for up to 2 projects per college.',
        '**Travel Subsidy (Form 001, BOR Res. No. 222, s. 2024):** the Director recommends official time only, or financial assistance from college or research funds, subject to available funds.',
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
        'Open the documents and tick each requirement in the **Document Checklist**.',
        'For a grant or incentive application, the checklist comes from its form instead. For Forms 002, 003 and 004, also enter the **amount** the researcher is eligible for. If it is not eligible, return it with your remarks.',
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
        'For Form 001 and Form 008, choose your **recommendation**: on official time only, or with financial assistance (and, for Form 001, chargeable against college or research funds; for Form 008, the amount).',
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
  ['Why can\'t I endorse this proposal?', 'It is not your turn yet (the tracker shows who has it), you have not set up your **Digital Signature** in My Profile, or the box under your signature is not ticked.'],
  ['Why is the Endorse and Sign button grey?', 'Write your remarks (at least 10 characters) and tick the box under your signature. If the form has a checklist for you, complete it too.'],
  ['Why are Travel Subsidy and Oral Presentation locked?', 'Presenting a paper (Form 001) and the presentation incentive (Form 003) need a **Research Spotlight** of yours that is already **Approved**. Submit one in **My Research** first. Attending a conference (Form 008) and Publication Incentive are open.'],
  ['Which form do I use?', 'AYON picks it for you from what you choose: Research Spotlight entry, Form 005 (Internally Funded), Form 001 or 008 (Travel Subsidy), Form 003 (Oral Presentation), Form 002 or 004 (Publication Incentive). You fill it in inside AYON; no paper form is needed.'],
  ['Why can\'t I submit my Form 005 proposal?', 'Check the budget: the total cannot be over ₱50,000.00. Every required section and the CV must be filled in. A note about Personal Services and the 45% rule does not stop you, but MSIRC may ask you about it.'],
  ['Who decides how much incentive I get?', 'The amounts follow the University\'s policies (see **Grant and incentive amounts**). The Special Assistant checks your application and enters the amount.'],
  ['My proposal was returned. What now?', 'Open it from **My Research** or **Grants and Incentives**, read the reason, click **Edit and Resubmit**, fix it, and resubmit.'],
  ['Can I stop in the middle of the form?', 'Yes. Click **Save as Draft** on any step. Continue later from **My Research** or **Grants and Incentives** with **Continue Editing**.'],
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