/* ─────────────────────────────────────────────────────────────
   AYON's icons, in one place.
   Every screen imports its icons from here (not from Font Awesome directly),
   so the whole system uses one set: outline icons with thin, even lines
   (Lucide), the style of Google, Microsoft, GitHub and Notion.
   The names stay the old Font Awesome ones, so the screens did not change:
   only what each name draws. To change an icon everywhere, change it here.
   ───────────────────────────────────────────────────────────── */
import React from 'react';
import {
  LuBell, LuX, LuCircleCheck, LuCheck, LuArrowLeft, LuLandmark, LuLibraryBig, LuFileText, LuLayoutDashboard,
  LuArrowRight, LuClipboardList, LuSignature, LuUndo2, LuSend, LuFileCheck2, LuTriangleAlert, LuTrash2, LuLock,
  LuMail, LuCircleX, LuChartColumnBig, LuPlus, LuHandCoins, LuUser, LuCamera, LuPhone, LuDownload, LuChevronDown,
  LuUpload, LuShieldCheck, LuPencil, LuSearch, LuKeyRound, LuMapPin, LuInbox, LuFileSpreadsheet, LuCloudUpload,
  LuClock, LuClipboardCheck, LuCirclePlus, LuInfo, LuCircleAlert, LuChevronRight, LuMegaphone, LuMenu,
  LuGraduationCap, LuStamp, LuPenTool, LuMinus, LuUsers, LuBriefcaseBusiness, LuUserPen, LuUserCheck, LuTable,
  LuNetwork, LuLogOut, LuPrinter, LuSearchCheck, LuFlaskConical, LuEyeOff, LuEye, LuEraser, LuMailCheck,
  LuDatabase, LuCopy, LuCircleUserRound, LuCircleHelp, LuCircle, LuCalendar, LuBookOpen, LuExternalLink, LuArrowUp,
  LuFileType2,
} from 'react-icons/lu';
import { FaExclamation as FaExclamationGlyph } from 'react-icons/fa6';

/* a small solid dot (the "now" step of the tracker) */
const Dot = (props) => <LuCircle fill="currentColor" {...props} />;

/* menus */
export const FaTableCellsLarge   = LuLayoutDashboard;   // Dashboard
export const FaFileLines         = LuFileText;          // My Research, All Proposals
export const FaHandHoldingDollar = LuHandCoins;         // Grants and Incentives
export const FaFlagCheckered     = LuFileCheck2;        // Terminal Reports
export const FaGlobe             = LuLandmark;          // External Research (outside funding agencies)
export const FaBoxArchive        = LuLibraryBig;        // Research Repository
export const FaBell              = LuBell;              // Notifications
export const FaCircleUser        = LuCircleUserRound;   // My Profile
export const FaClipboardList     = LuClipboardList;     // For Endorsement, For Review, For Final Approval
export const FaClipboardCheck    = LuClipboardCheck;    // For Validation
export const FaPaperPlane        = LuSend;              // Validated, Endorsed to VCRED
export const FaCircleCheck       = LuCircleCheck;       // Approved, Endorsed
export const FaCircleXmark       = LuCircleX;           // Rejected
export const FaInbox             = LuInbox;             // All Submissions
export const FaChartColumn       = LuChartColumnBig;    // Reports
export const FaUsers             = LuUsers;             // User Accounts
export const FaBullhorn          = LuMegaphone;         // Announcements
export const FaShieldHalved      = LuShieldCheck;       // Audit Log
export const FaEnvelope          = LuMail;              // Email Log, email
export const FaBars              = LuMenu;              // open / fold the menu
export const FaRightFromBracket  = LuLogOut;            // Logout

/* actions */
export const FaCheck             = LuCheck;
export const FaXmark             = LuX;
export const FaPlus              = LuPlus;
export const FaMinus             = LuMinus;
export const FaCirclePlus        = LuCirclePlus;
export const FaRotateLeft        = LuUndo2;             // Return to Researcher
export const FaTrashCan          = LuTrash2;
export const FaPen               = LuPencil;
export const FaPenNib            = LuPenTool;
export const FaEraser            = LuEraser;
export const FaCopy              = LuCopy;
export const FaPrint             = LuPrinter;
export const FaDownload          = LuDownload;
export const FaUpload            = LuUpload;
export const FaArrowUpFromBracket = LuUpload;
export const FaCloudArrowUp      = LuCloudUpload;
export const FaArrowUpRightFromSquare = LuExternalLink;
export const FaMagnifyingGlass   = LuSearch;
export const FaMagnifyingGlassChart = LuSearchCheck;
export const FaEye               = LuEye;
export const FaEyeSlash          = LuEyeOff;
export const FaSignature         = LuSignature;
export const FaStamp             = LuStamp;
export const FaKey               = LuKeyRound;
export const FaLock              = LuLock;
export const FaCamera            = LuCamera;

/* arrows */
export const FaArrowLeft         = LuArrowLeft;
export const FaArrowRight        = LuArrowRight;
export const FaArrowUp           = LuArrowUp;
export const FaChevronDown       = LuChevronDown;
export const FaChevronRight      = LuChevronRight;

/* messages and states */
export const FaTriangleExclamation = LuTriangleAlert;
export const FaCircleExclamation = LuCircleAlert;
export const FaCircleInfo        = LuInfo;
export const FaCircleQuestion    = LuCircleHelp;
export const FaExclamation       = FaExclamationGlyph;  // a bare "!" inside the tracker's circle
export const FaCircle            = Dot;
export const FaClock             = LuClock;
export const FaCalendar          = LuCalendar;
export const FaEnvelopeCircleCheck = LuMailCheck;

/* people, places, things */
export const FaUser              = LuUser;
export const FaUserGraduate      = LuGraduationCap;
export const FaUserTie           = LuBriefcaseBusiness;
export const FaUserPen           = LuUserPen;
export const FaUserCheck         = LuUserCheck;
export const FaPhone             = LuPhone;
export const FaLocationDot       = LuMapPin;
export const FaBuildingColumns   = LuLandmark;
export const FaSitemap           = LuNetwork;
export const FaDatabase          = LuDatabase;
export const FaFlask             = LuFlaskConical;
export const FaBookOpen          = LuBookOpen;
export const FaTableList         = LuTable;
export const FaFilePdf           = LuFileText;
export const FaFileWord          = LuFileType2;
export const FaFileCsv           = LuFileSpreadsheet;