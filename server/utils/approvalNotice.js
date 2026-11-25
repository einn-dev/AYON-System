const supabase = require('../config/supabase');
const { sendEmail, emailHeader } = require('./mailer');
const { TYPE_LABEL, GRANT_TYPES } = require('./terms');
const { personName } = require('./names');

/* ─────────────────────────────────────────────────────────────
   Final approval: a formal notice to the researcher.
     - an in-app notification ("... Granted Final Approval")
     - a Notice of Final Approval email with a button that opens the record in AYON
   Called once, when a submission gets its final approval.
   Never throws: a failed email must not undo the approval.
   ───────────────────────────────────────────────────────────── */

/* Set APP_URL on Render, e.g. https://ayon-system.vercel.app */
const appUrl = () => {
  const raw = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  return raw.trim().replace(/\/+$/, '');
};

const escapeHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const isApplication = (p) => GRANT_TYPES.includes(p?.proposal_type) || p?.proposal_type === 'travel_oral';

const manilaDate = (d = new Date()) => d.toLocaleDateString('en-PH', {
  timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric',
});

const APPROVER = { ovcred: 'VCRED', admin: 'the Administrator' };

/* a formal line for each kind of submission */
const TYPE_LINE = {
  research_spotlight:    'Your research is hereby approved for the Research Spotlight. MSIRC acknowledges your contribution to the research community of Mindanao State University – Main Campus.',
  internally_funded:     'Your research is hereby approved for internal funding. Kindly coordinate with the MSIRC office regarding any further requirements.',
  travel_subsidy:        'Your request for a Travel Subsidy is hereby approved.',
  oral_presentation:     'Your application for the Oral Presentation incentive is hereby approved.',
  publication_incentive: 'Your application for the Publication Incentive is hereby approved.',
};

/* the email itself (inline styles and tables, so it looks right in Gmail and Outlook) */
const approvalEmailHtml = ({ name, title, type, typeLabel, word, approvedOn, approvedBy, link }) => {
  const typeLine = TYPE_LINE[type] || `Your ${word} is hereby approved.`;
  const row = (label, value) => `
            <tr>
              <td style="padding:5px 16px 5px 0;color:#8a7a7d;white-space:nowrap;vertical-align:top">${label}</td>
              <td style="padding:5px 0;color:#2d2327;font-weight:600">${escapeHtml(value)}</td>
            </tr>`;

  return `
  <div style="background:#f4f1f1;padding:24px 12px">
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;
    border:1px solid #e8edf2;border-radius:12px;overflow:hidden">
    ${emailHeader()}
    <div style="height:4px;background:#c9a227"></div>

    <div style="padding:28px 30px 0;color:#2d2327;font-size:14px;line-height:1.75">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#8a7a7d;font-weight:600">
        Notice of Final Approval</p>
      <p style="margin:0 0 18px;font-size:12px;color:#8a7a7d">${escapeHtml(approvedOn)}</p>

      <p style="margin:0 0 14px">Dear ${escapeHtml(name)},</p>
      <p style="margin:0 0 14px">
        We are pleased to inform you that your ${word}, detailed below, has completed all stages of
        review and has been granted <b>final approval</b> by ${escapeHtml(approvedBy)}.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid #efe5e6;border-left:4px solid #8d1b2d;border-radius:8px;background:#fffaf9;margin:4px 0 16px">
        <tr><td style="padding:14px 18px">
          <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.5">
            ${row('Title', title)}
            ${row('Type', typeLabel)}
            ${row('Date approved', approvedOn)}
            ${row('Final approval', approvedBy)}
          </table>
        </td></tr>
      </table>

      <p style="margin:0 0 14px">${escapeHtml(typeLine)}</p>
      <p style="margin:0 0 14px">
        The approved form, together with the signatures of all reviewing offices, is available in your
        AYON account. We advise you to keep a copy for your records. For any concerns, you may contact
        the MSIRC office.
      </p>
      <p style="margin:0 0 14px">
        We congratulate you on this achievement and thank you for your contribution to research at
        Mindanao State University – Main Campus.
      </p>
      <p style="margin:0">Respectfully,</p>
      <p style="margin:0;font-weight:700;color:#5e1420">MSIRC</p>
      <p style="margin:0;font-size:12px;color:#8a7a7d">Mindanao State University – Main Campus</p>
    </div>

    <div style="padding:24px 30px 6px;text-align:center">
      <a href="${link}" style="display:inline-block;background:#8d1b2d;color:#ffffff;padding:12px 28px;
        border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">View my ${word} in AYON</a>
      <p style="color:#8a7a7d;font-size:12px;line-height:1.6;margin:14px 0 0">
        If the button does not work, copy this link into your browser:<br>
        <span style="word-break:break-all;color:#8d1b2d">${link}</span>
      </p>
    </div>

    <div style="padding:16px 30px 22px">
      <div style="padding-top:14px;border-top:1px solid #e8edf2">
        <p style="color:#a0aec0;font-size:12px;margin:0">
          This is an automated message from the AYON Research Management System. Please do not reply to this email.
        </p>
      </div>
    </div>
  </div>
  </div>`;
};

/* builds everything from the proposal row; used by the controller and the preview */
const buildApprovalNotice = (proposal, owner, approverRole, when = new Date()) => {
  const word      = isApplication(proposal) ? 'application' : 'proposal';
  const Word      = word.charAt(0).toUpperCase() + word.slice(1);
  const approvedBy = APPROVER[approverRole] || 'MSIRC';
  const link      = `${appUrl()}/researcher/proposals?open=${proposal.proposal_id}`;
  return {
    notif: {
      user_id:     proposal.user_id,
      proposal_id: parseInt(proposal.proposal_id, 10),
      notif_type:  'approval',
      title:       `${Word} Granted Final Approval`,
      message:     `Congratulations. Your ${word} "${proposal.title}" has completed all stages of review and has been granted final approval by ${approvedBy}.`,
    },
    subject: `AYON: Notice of Final Approval – ${String(proposal.title).slice(0, 80)}`,
    html: approvalEmailHtml({
      name:       personName(owner) || 'Researcher',
      title:      proposal.title,
      type:       proposal.proposal_type,
      typeLabel:  TYPE_LABEL[proposal.proposal_type] || Word,
      word,
      approvedOn: manilaDate(when),
      approvedBy,
      link,
    }),
  };
};

/* the notification and the email */
const sendApprovalNotice = async (proposal, approverRole) => {
  try {
    const { data: owner } = await supabase
      .from('users').select('first_name, middle_name, last_name, email').eq('user_id', proposal.user_id).maybeSingle();
    const notice = buildApprovalNotice(proposal, owner, approverRole);

    const { data: notif } = await supabase
      .from('notifications').insert(notice.notif).select('notif_id').maybeSingle();

    if (owner?.email) {
      await sendEmail({
        to:       owner.email,
        subject:  notice.subject,
        html:     notice.html,
        notif_id: notif?.notif_id || null,
        type:     'approval',
      });
    }
  } catch (err) {
    console.error('approval notice failed:', err.message || err);
  }
};

/* ─────────────────────────────────────────────────────────────
   Rejection: the same formal notice, for a final "not approved".
     - an in-app notification ("... Not Approved", with the reason)
     - a Notice of Decision email with the reason and a button to the record
   Never throws: a failed email must not undo the decision.
   ───────────────────────────────────────────────────────────── */

const DECIDER = {
  special_assistant: 'the MSIRC Special Assistant',
  msric_director:    'the MSIRC Director',
  ovcred:            'VCRED',
  admin:             'the Administrator',
};

const rejectionEmailHtml = ({ name, title, typeLabel, word, decidedOn, decidedBy, reason, link }) => {
  const row = (label, value) => `
            <tr>
              <td style="padding:5px 16px 5px 0;color:#8a7a7d;white-space:nowrap;vertical-align:top">${label}</td>
              <td style="padding:5px 0;color:#2d2327;font-weight:600">${escapeHtml(value)}</td>
            </tr>`;

  return `
  <div style="background:#f4f1f1;padding:24px 12px">
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;
    border:1px solid #e8edf2;border-radius:12px;overflow:hidden">
    ${emailHeader()}
    <div style="height:4px;background:#8a7a7d"></div>

    <div style="padding:28px 30px 0;color:#2d2327;font-size:14px;line-height:1.75">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#8a7a7d;font-weight:600">
        Notice of Decision</p>
      <p style="margin:0 0 18px;font-size:12px;color:#8a7a7d">${escapeHtml(decidedOn)}</p>

      <p style="margin:0 0 14px">Dear ${escapeHtml(name)},</p>
      <p style="margin:0 0 14px">
        Thank you for submitting your ${word} to MSIRC. After careful review, we regret to inform you
        that your ${word}, detailed below, was <b>not approved</b> by ${escapeHtml(decidedBy)}.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid #efe5e6;border-left:4px solid #8a7a7d;border-radius:8px;background:#faf9f9;margin:4px 0 16px">
        <tr><td style="padding:14px 18px">
          <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.5">
            ${row('Title', title)}
            ${row('Type', typeLabel)}
            ${row('Date of decision', decidedOn)}
            ${row('Decided by', decidedBy)}
          </table>
        </td></tr>
      </table>

      <p style="margin:0 0 6px;font-weight:600">Reason given</p>
      <p style="margin:0 0 16px;padding:12px 16px;background:#faf9f9;border-radius:8px;color:#2d2327;white-space:pre-line">${escapeHtml(reason)}</p>

      <p style="margin:0 0 14px">
        This decision applies to this submission only. You are welcome to submit a new ${word} through
        AYON, and we encourage you to consider the reason above when preparing it. For questions about
        this decision, you may contact the MSIRC office.
      </p>
      <p style="margin:0 0 14px">
        We thank you for your effort and for your continued contribution to research at
        Mindanao State University – Main Campus.
      </p>
      <p style="margin:0">Respectfully,</p>
      <p style="margin:0;font-weight:700;color:#5e1420">MSIRC</p>
      <p style="margin:0;font-size:12px;color:#8a7a7d">Mindanao State University – Main Campus</p>
    </div>

    <div style="padding:24px 30px 6px;text-align:center">
      <a href="${link}" style="display:inline-block;background:#8d1b2d;color:#ffffff;padding:12px 28px;
        border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">View my ${word} in AYON</a>
      <p style="color:#8a7a7d;font-size:12px;line-height:1.6;margin:14px 0 0">
        If the button does not work, copy this link into your browser:<br>
        <span style="word-break:break-all;color:#8d1b2d">${link}</span>
      </p>
    </div>

    <div style="padding:16px 30px 22px">
      <div style="padding-top:14px;border-top:1px solid #e8edf2">
        <p style="color:#a0aec0;font-size:12px;margin:0">
          This is an automated message from the AYON Research Management System. Please do not reply to this email.
        </p>
      </div>
    </div>
  </div>
  </div>`;
};

const buildRejectionNotice = (proposal, owner, deciderRole, reason, when = new Date()) => {
  const word      = isApplication(proposal) ? 'application' : 'proposal';
  const Word      = word.charAt(0).toUpperCase() + word.slice(1);
  const decidedBy = DECIDER[deciderRole] || 'MSIRC';
  const link      = `${appUrl()}/researcher/proposals?open=${proposal.proposal_id}`;
  return {
    notif: {
      user_id:     proposal.user_id,
      proposal_id: parseInt(proposal.proposal_id, 10),
      notif_type:  'review',
      title:       `${Word} Not Approved`,
      message:     `Your ${word} "${proposal.title}" was not approved by ${decidedBy}. Reason: ${reason}`,
    },
    subject: `AYON: Notice of Decision – ${String(proposal.title).slice(0, 80)}`,
    html: rejectionEmailHtml({
      name:      personName(owner) || 'Researcher',
      title:     proposal.title,
      typeLabel: TYPE_LABEL[proposal.proposal_type] || Word,
      word,
      decidedOn: manilaDate(when),
      decidedBy,
      reason:    reason || 'No reason was given.',
      link,
    }),
  };
};

const sendRejectionNotice = async (proposal, deciderRole, reason) => {
  try {
    const { data: owner } = await supabase
      .from('users').select('first_name, middle_name, last_name, email').eq('user_id', proposal.user_id).maybeSingle();
    const notice = buildRejectionNotice(proposal, owner, deciderRole, reason);

    const { data: notif } = await supabase
      .from('notifications').insert(notice.notif).select('notif_id').maybeSingle();

    if (owner?.email) {
      await sendEmail({
        to:       owner.email,
        subject:  notice.subject,
        html:     notice.html,
        notif_id: notif?.notif_id || null,
        type:     'rejection',
      });
    }
  } catch (err) {
    console.error('rejection notice failed:', err.message || err);
  }
};

module.exports = { sendApprovalNotice, buildApprovalNotice, sendRejectionNotice, buildRejectionNotice };