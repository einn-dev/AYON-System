import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL, STATUS_LABEL, statusBadge } from '../utils/terms';
import { CONTACT, FAQ, STATUS_HELP, WHO_SIGNS, guidesFor } from '../data/helpContent';
import { FaPrint, FaLocationDot, FaEnvelope, FaPhone, FaClock } from 'react-icons/fa6';
import '../components/TopBar.css';

/* ─────────────────────────────────────────────────────────────
   Help and User Guide: the guides for the signed-in role,
   plus statuses, who signs when, FAQ and how to contact MSIRC.
   Opened from the ? button in the top bar (/<role>/help).
   ───────────────────────────────────────────────────────────── */

/* "**bold** text" → React nodes */
export const Rich = ({ text }) => (
  <>
    {String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => (
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <React.Fragment key={i}>{part}</React.Fragment>
    ))}
  </>
);

const plain = (s) => String(s).replace(/\*\*/g, '').toLowerCase();

const HelpPage = () => {
  const { user } = useAuth();
  const role = user?.role;
  const { hash } = useLocation();
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState('');
  const [printing, setPrinting] = useState(false);   // print with every answer open

  useEffect(() => {
    const before = () => setPrinting(true);
    const after  = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);

  const guides = useMemo(() => guidesFor(role), [role]);
  const term = q.trim().toLowerCase();
  const match = (...parts) => !term || parts.some(p => plain(p).includes(term));

  const shownGuides = guides.filter(g => match(g.title, ...g.steps));
  const showStatuses = match('What each status means', ...STATUS_HELP.flat(), ...Object.values(STATUS_LABEL));
  const showSigns    = match('Who signs, and when', ...WHO_SIGNS.flat());
  const shownFaq     = FAQ.filter(([qq, a]) => match('Frequently asked questions', qq, a));
  const showContact  = match('Contact MSIRC', ...Object.values(CONTACT));
  const nothing = !shownGuides.length && !showStatuses && !showSigns && !shownFaq.length && !showContact;

  const goTo = useCallback((id) => {
    const el = document.getElementById(`help-${id}`);
    if (!el) return;
    if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFlash(id);
    setTimeout(() => setFlash(''), 1400);
  }, []);

  /* opened from search with #topic */
  useEffect(() => {
    const id = decodeURIComponent((hash || '').replace('#', ''));
    if (!id) return undefined;
    const t = setTimeout(() => goTo(id), 120);
    return () => clearTimeout(t);
  }, [hash, goTo]);

  const sec = (id) => `help-sec${flash === id ? ' help-flash' : ''}`;

  return (
    <div className="help-page">
      <div className="page-header help-head">
        <div>
          <h1>Help and User Guide</h1>
          <p>Step-by-step guides for the <strong>{ROLE_LABEL[role] || 'user'}</strong>.</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm help-print"
          onClick={() => { setQ(''); setPrinting(true); setTimeout(() => window.print(), 80); }}>
          <FaPrint className="ic" />Print or Save User Guide (PDF)
        </button>
      </div>

      <input className="search-input help-search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search help, for example: return, signature, password" aria-label="Search help" />

      <div className="help-grid">
        <nav className="help-toc" aria-label="Help topics">
          {shownGuides.length > 0 && <div className="help-toc-h">Guides for {ROLE_LABEL[role] || 'you'}</div>}
          {shownGuides.map(g => (
            <button key={g.id} type="button" onClick={() => goTo(g.id)}>{g.title}</button>
          ))}
          <div className="help-toc-h">For everyone</div>
          {showStatuses && <button type="button" onClick={() => goTo('statuses')}>What each status means</button>}
          {showSigns && <button type="button" onClick={() => goTo('signs')}>Who signs, and when</button>}
          {shownFaq.length > 0 && <button type="button" onClick={() => goTo('faq')}>Frequently asked questions</button>}
          {showContact && <button type="button" onClick={() => goTo('contact')}>Contact MSIRC</button>}
        </nav>

        <div className="help-body">
          {nothing && (
            <div className="help-sec"><p>No help topic matches "<strong>{q}</strong>". Try another word, or contact MSIRC.</p></div>
          )}

          {shownGuides.map(g => (
            <section key={g.id} id={`help-${g.id}`} className={sec(g.id)}>
              <h2>{g.title}</h2>
              <ol className="help-steps">
                {g.steps.map((s, i) => <li key={i}><Rich text={s} /></li>)}
              </ol>
            </section>
          ))}

          {showStatuses && (
            <section id="help-statuses" className={sec('statuses')}>
              <h2>What each status means</h2>
              <table className="help-table"><tbody>
                {STATUS_HELP.map(([s, text]) => (
                  <tr key={s}>
                    <td><span className={`badge ${statusBadge(s)}`}>{STATUS_LABEL[s] || s}</span></td>
                    <td>{text}</td>
                  </tr>
                ))}
              </tbody></table>
            </section>
          )}

          {showSigns && (
            <section id="help-signs" className={sec('signs')}>
              <h2>Who signs, and when</h2>
              <table className="help-table"><tbody>
                {WHO_SIGNS.map(([who, when]) => (
                  <tr key={who}><td>{who}</td><td><Rich text={when} /></td></tr>
                ))}
              </tbody></table>
              <p className="help-note">Returning or rejecting never signs. Each signature is recorded in the Audit Log.</p>
            </section>
          )}

          {shownFaq.length > 0 && (
            <section id="help-faq" className={sec('faq')}>
              <h2>Frequently asked questions</h2>
              {shownFaq.map(([qq, a]) => (
                <details key={qq} open={!!term || printing}>
                  <summary>{qq}</summary>
                  <p><Rich text={a} /></p>
                </details>
              ))}
            </section>
          )}

          {showContact && (
            <section id="help-contact" className={sec('contact')}>
              <h2>Contact MSIRC</h2>
              <div className="help-contact">
                <div><strong>{CONTACT.office}</strong><br />{CONTACT.campus}</div>
                <div>
                  <div><FaLocationDot className="ic" />{CONTACT.location}</div>
                  <div><FaEnvelope className="ic" />{CONTACT.email}</div>
                  <div><FaPhone className="ic" />{CONTACT.phone}</div>
                  <div><FaClock className="ic" />{CONTACT.hours}</div>
                </div>
              </div>
              <p className="help-note">For problems with your account, contact the AYON Administrator.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpPage;