const db   = require('../config/db');
const path = require('path');
const fs   = require('fs');

/* ── GET my proposals ── */
const getMyProposals = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM research_proposals
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.user_id]
    );
    return res.status(200).json({ proposals: rows });
  } catch (err) {
    console.error('getMyProposals error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── POST submit new proposal ── */
const submitProposal = async (req, res) => {
  const { proposal_type, title, description } = req.body;
  const file_path = req.file ? `uploads/${req.file.filename}` : null;

  if (!proposal_type || !title) {
    return res.status(400).json({ message: 'Proposal type and title are required.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO research_proposals
         (user_id, proposal_type, title, description, file_path, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, 'submitted', NOW())`,
      [req.user.user_id, proposal_type, title, description || null, file_path]
    );

    const proposalId = result.insertId;

    await db.query(
      `INSERT INTO submissions (proposal_id, submission_status)
       VALUES (?, 'pending')`,
      [proposalId]
    );

    await db.query(
      `INSERT INTO notifications
         (user_id, proposal_id, notif_type, title, message)
       VALUES (?, ?, 'submission', 'Proposal Submitted', ?)`,
      [req.user.user_id, proposalId,
       `Your proposal "${title}" has been submitted successfully.`]
    );

    return res.status(201).json({
      message:     'Proposal submitted successfully.',
      proposal_id: proposalId,
    });
  } catch (err) {
    console.error('submitProposal error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── GET all proposals (admin/staff view) ── */
const getAllProposals = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, u.first_name, u.last_name, u.email, u.college
       FROM research_proposals p
       JOIN users u ON p.user_id = u.user_id
       ORDER BY p.created_at DESC`
    );
    return res.status(200).json({ proposals: rows });
  } catch (err) {
    console.error('getAllProposals error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── GET single proposal by ID ── */
const getProposalById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT p.*, u.first_name, u.last_name, u.email
       FROM research_proposals p
       JOIN users u ON p.user_id = u.user_id
       WHERE p.proposal_id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Proposal not found.' });
    return res.status(200).json({ proposal: rows[0] });
  } catch (err) {
    console.error('getProposalById error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── PATCH update proposal status ── */
const updateProposalStatus = async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;

  const validStatuses = ['submitted','under_review','returned','endorsed','approved','rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  try {
    const [proposal] = await db.query(
      'SELECT user_id, title FROM research_proposals WHERE proposal_id = ?', [id]
    );
    if (proposal.length === 0) return res.status(404).json({ message: 'Proposal not found.' });

    await db.query(
      'UPDATE research_proposals SET status = ? WHERE proposal_id = ?',
      [status, id]
    );

    await db.query(
      `INSERT INTO notifications
         (user_id, proposal_id, notif_type, title, message)
       VALUES (?, ?, 'review', 'Proposal Status Updated', ?)`,
      [proposal[0].user_id, id,
       `Your proposal "${proposal[0].title}" status has been updated to: ${status}.`]
    );

    return res.status(200).json({ message: 'Status updated.' });
  } catch (err) {
    console.error('updateProposalStatus error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  getMyProposals,
  submitProposal,
  getAllProposals,
  getProposalById,
  updateProposalStatus,
};