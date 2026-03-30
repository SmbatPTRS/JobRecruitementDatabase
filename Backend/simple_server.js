const express = require('express');
const sql = require('mssql');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ================= DB CONFIG =================
const dbConfig = {
  user: 'testuser',
  password: 'Testpassword!',
  server: 'localhost',
  database: 'JobRecruitmentDataBase',
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  port: 1433
};

let pool;
async function getConnection() {
  if (!pool) pool = await sql.connect(dbConfig);
  return pool;
}

async function query(q, params = {}) {
  const conn = await getConnection();
  const req  = conn.request();
  Object.entries(params).forEach(([k, v]) => req.input(k, v));
  return (await req.query(q)).recordset;
}

async function queryOne(q, params = {}) {
  return (await query(q, params))[0] || null;
}

async function execute(q, params = {}) {
  const conn = await getConnection();
  const req  = conn.request();
  Object.entries(params).forEach(([k, v]) => req.input(k, v));
  return req.query(q);
}

// ================= LOGIN =================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await queryOne(
      `SELECT user_id, email AS username, password, role
       FROM dbo.USERS WHERE email = @username`,
      { username }
    );

    if (!user || password !== user.password)
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role },
      'secret',
      { expiresIn: '24h' }
    );

    let userDetails = { user_id: user.user_id, username: user.username, role: user.role };
    const role = user.role.toLowerCase();

    if (role === 'candidate') {
      const c = await queryOne(
        `SELECT candidate_id, first_name, last_name, email, phone
         FROM dbo.CANDIDATE WHERE user_id = @user_id`,
        { user_id: user.user_id }
      );
      if (c) userDetails = { ...userDetails, ...c };
    }

    if (role === 'recruiter') {
      const r = await queryOne(
        `SELECT recruiter_id, first_name, last_name, email, company_id
         FROM dbo.RECRUITER WHERE user_id = @user_id`,
        { user_id: user.user_id }
      );
      if (r) userDetails = { ...userDetails, ...r };
    }

    res.json({ token, user: userDetails });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= JOBS (open only) =================
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await query(
      `SELECT j.job_id, j.title, j.description, j.salary, j.status,
              (r.first_name + ' ' + r.last_name) AS recruiter_name,
              c.name AS company_name
       FROM dbo.JOB j
       LEFT JOIN dbo.RECRUITER r ON j.recruiter_id = r.recruiter_id
       LEFT JOIN dbo.COMPANY   c ON r.company_id   = c.company_id
       WHERE j.status = 'Open'`
    );
    res.json(jobs);
  } catch (err) {
    console.error('JOBS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= CREATE JOB =================
app.post('/api/jobs', async (req, res) => {
  try {
    const { title, description, salary, recruiter_id } = req.body;
    await execute(
      `INSERT INTO dbo.JOB (title, description, salary, recruiter_id, status)
       VALUES (@title, @description, @salary, @recruiter_id, 'Open')`,
      { title, description, salary, recruiter_id }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('CREATE JOB ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= APPLY =================
app.post('/api/apply', async (req, res) => {
  try {
    const { candidate_id, job_id } = req.body;

    const job = await queryOne(`SELECT status FROM dbo.JOB WHERE job_id = @job_id`, { job_id });
    if (!job || job.status !== 'Open')
      return res.status(400).json({ error: 'This job is no longer open' });

    const exists = await queryOne(
      `SELECT application_id FROM dbo.APPLICATION
       WHERE candidate_id = @candidate_id AND job_id = @job_id`,
      { candidate_id, job_id }
    );
    if (exists) return res.status(400).json({ error: 'Already applied' });

    await execute(
      `INSERT INTO dbo.APPLICATION (candidate_id, job_id, status, application_date)
       VALUES (@candidate_id, @job_id, 'Pending', GETDATE())`,
      { candidate_id, job_id }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('APPLY ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= CANDIDATE: MY APPLICATIONS =================
app.get('/api/applications/candidate/:candidate_id', async (req, res) => {
  try {
    const apps = await query(
      `SELECT a.application_id, a.status, a.application_date,
              j.job_id, j.title, j.status AS job_status,
              (r.first_name + ' ' + r.last_name) AS recruiter_name,
              c.name AS company_name
       FROM dbo.APPLICATION a
       JOIN dbo.JOB          j ON a.job_id        = j.job_id
       LEFT JOIN dbo.RECRUITER r ON j.recruiter_id = r.recruiter_id
       LEFT JOIN dbo.COMPANY   c ON r.company_id   = c.company_id
       WHERE a.candidate_id = @candidate_id`,
      { candidate_id: req.params.candidate_id }
    );
    res.json(apps);
  } catch (err) {
    console.error('CANDIDATE APPLICATIONS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= CANDIDATE: MY INTERVIEWS =================
// Joins INTERVIEW → APPLICATION → JOB (no candidate_id/job_id in INTERVIEW)
app.get('/api/interviews/candidate/:candidate_id', async (req, res) => {
  try {
    const interviews = await query(
      `SELECT i.interview_id,
              i.interview_date,
              i.interview_type,
              i.result,
              a.application_id,
              j.title  AS job_title,
              co.name  AS company_name
       FROM dbo.INTERVIEW i
       JOIN dbo.APPLICATION a ON i.application_id = a.application_id
       JOIN dbo.JOB          j ON a.job_id         = j.job_id
       LEFT JOIN dbo.RECRUITER r  ON j.recruiter_id  = r.recruiter_id
       LEFT JOIN dbo.COMPANY   co ON r.company_id    = co.company_id
       WHERE a.candidate_id = @candidate_id
       ORDER BY i.interview_date DESC`,
      { candidate_id: req.params.candidate_id }
    );
    res.json(interviews);
  } catch (err) {
    console.error('CANDIDATE INTERVIEWS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= RECRUITER: APPLICATIONS =================
app.get('/api/recruiter-applications/:recruiter_id', async (req, res) => {
  try {
    const apps = await query(
      `SELECT a.application_id, a.status, a.application_date,
              j.title, j.status AS job_status,
              c.candidate_id,
              (c.first_name + ' ' + c.last_name) AS candidate_name,
              c.email
       FROM dbo.APPLICATION a
       JOIN dbo.JOB       j ON a.job_id        = j.job_id
       JOIN dbo.CANDIDATE c ON a.candidate_id  = c.candidate_id
       WHERE j.recruiter_id = @recruiter_id`,
      { recruiter_id: req.params.recruiter_id }
    );
    res.json(apps);
  } catch (err) {
    console.error('RECRUITER APPS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= RECRUITER: UPDATE APPLICATION STATUS =================
app.put('/api/applications/:application_id', async (req, res) => {
  try {
    const { status } = req.body;
    await execute(
      `UPDATE dbo.APPLICATION SET status = @status
       WHERE application_id = @application_id`,
      { status, application_id: req.params.application_id }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('UPDATE STATUS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= CANDIDATE PROFILE =================
app.get('/api/candidate/:candidate_id', async (req, res) => {
  try {
    const candidate = await queryOne(
      `SELECT candidate_id,
              (first_name + ' ' + last_name) AS name,
              first_name, last_name, email, phone
       FROM dbo.CANDIDATE WHERE candidate_id = @candidate_id`,
      { candidate_id: req.params.candidate_id }
    );
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    let skills = [];
    try {
      skills = await query(
        `SELECT s.name FROM dbo.SKILL s
         JOIN dbo.CANDIDATE_SKILL cs ON s.skill_id = cs.skill_id
         WHERE cs.candidate_id = @candidate_id`,
        { candidate_id: req.params.candidate_id }
      );
    } catch (_) {}

    res.json({ ...candidate, skills });
  } catch (err) {
    console.error('CANDIDATE PROFILE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= RECRUITER PROFILE =================
app.get('/api/recruiter/:recruiter_id', async (req, res) => {
  try {
    const recruiter = await queryOne(
      `SELECT r.recruiter_id,
              (r.first_name + ' ' + r.last_name) AS name,
              r.first_name, r.last_name, r.email,
              c.name AS company_name
       FROM dbo.RECRUITER r
       LEFT JOIN dbo.COMPANY c ON r.company_id = c.company_id
       WHERE r.recruiter_id = @recruiter_id`,
      { recruiter_id: req.params.recruiter_id }
    );
    if (!recruiter) return res.status(404).json({ error: 'Recruiter not found' });
    res.json(recruiter);
  } catch (err) {
    console.error('RECRUITER PROFILE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= HR: ALL APPLICATIONS =================
// Returns every application system-wide, enriched with interview data if it exists
app.get('/api/hr/applications', async (req, res) => {
  try {
    const apps = await query(
      `SELECT
         a.application_id,
         a.status           AS application_status,
         a.application_date,
         j.job_id,
         j.title            AS job_title,
         j.status           AS job_status,
         co.name            AS company_name,
         c.candidate_id,
         (c.first_name + ' ' + c.last_name) AS candidate_name,
         c.email            AS candidate_email,
         -- Interview columns (NULL when none exists yet)
         i.interview_id,
         i.interview_date,
         i.interview_type,
         i.result           AS interview_result
       FROM dbo.APPLICATION a
       JOIN dbo.JOB          j  ON a.job_id        = j.job_id
       JOIN dbo.CANDIDATE    c  ON a.candidate_id  = c.candidate_id
       LEFT JOIN dbo.RECRUITER r  ON j.recruiter_id  = r.recruiter_id
       LEFT JOIN dbo.COMPANY   co ON r.company_id    = co.company_id
       LEFT JOIN dbo.INTERVIEW i  ON i.application_id = a.application_id
       ORDER BY a.application_date DESC`
    );
    res.json(apps);
  } catch (err) {
    console.error('HR APPLICATIONS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= HR: ALL INTERVIEWS =================
app.get('/api/hr/interviews', async (req, res) => {
  try {
    const interviews = await query(
      `SELECT
         i.interview_id,
         i.interview_date,
         i.interview_type,
         i.result,
         i.application_id,
         j.job_id,
         j.title            AS job_title,
         j.status           AS job_status,
         co.name            AS company_name,
         (c.first_name + ' ' + c.last_name) AS candidate_name,
         c.email            AS candidate_email,
         c.candidate_id
       FROM dbo.INTERVIEW i
       JOIN dbo.APPLICATION a  ON i.application_id = a.application_id
       JOIN dbo.JOB          j  ON a.job_id         = j.job_id
       JOIN dbo.CANDIDATE    c  ON a.candidate_id   = c.candidate_id
       LEFT JOIN dbo.RECRUITER r  ON j.recruiter_id  = r.recruiter_id
       LEFT JOIN dbo.COMPANY   co ON r.company_id    = co.company_id
       ORDER BY i.interview_date DESC`
    );
    res.json(interviews);
  } catch (err) {
    console.error('HR INTERVIEWS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= HR: SCHEDULE INTERVIEW =================
// Only stores: application_id, interview_date, interview_type — result starts NULL
app.post('/api/hr/interview', async (req, res) => {
  try {
    const { application_id, interview_date, interview_type } = req.body;

    const existing = await queryOne(
      `SELECT interview_id FROM dbo.INTERVIEW WHERE application_id = @application_id`,
      { application_id }
    );
    if (existing)
      return res.status(400).json({ error: 'Interview already scheduled for this application' });

    await execute(
      `INSERT INTO dbo.INTERVIEW (application_id, interview_date, interview_type)
       VALUES (@application_id, @interview_date, @interview_type)`,
      { application_id, interview_date, interview_type: interview_type || null }
    );

    // Mark application as "Interview"
    await execute(
      `UPDATE dbo.APPLICATION SET status = 'Interview'
       WHERE application_id = @application_id`,
      { application_id }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('SCHEDULE INTERVIEW ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= HR: SET INTERVIEW RESULT (Pass / Reject) =================
app.put('/api/hr/interview/:interview_id', async (req, res) => {
  try {
    const { result } = req.body; // 'Pass' or 'Reject'
    const { interview_id } = req.params;

    if (!['Pass', 'Reject'].includes(result))
      return res.status(400).json({ error: 'Result must be Pass or Reject' });

    // Fetch the interview so we can find the job_id via application
    const interview = await queryOne(
      `SELECT i.interview_id, i.application_id, a.job_id
       FROM dbo.INTERVIEW i
       JOIN dbo.APPLICATION a ON i.application_id = a.application_id
       WHERE i.interview_id = @interview_id`,
      { interview_id }
    );
    if (!interview) return res.status(404).json({ error: 'Interview not found' });

    // Set result on interview row
    await execute(
      `UPDATE dbo.INTERVIEW SET result = @result WHERE interview_id = @interview_id`,
      { result, interview_id }
    );

    // Mirror result onto the application status
    await execute(
      `UPDATE dbo.APPLICATION SET status = @result
       WHERE application_id = @application_id`,
      { result, application_id: interview.application_id }
    );

    // Pass → close the job so no further applications come in
    if (result === 'Pass') {
      await execute(
        `UPDATE dbo.JOB SET status = 'Closed' WHERE job_id = @job_id`,
        { job_id: interview.job_id }
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('SET INTERVIEW RESULT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN: STATS =================
app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = await queryOne(
      `SELECT
         (SELECT COUNT(*) FROM dbo.USERS)                          AS total_users,
         (SELECT COUNT(*) FROM dbo.CANDIDATE)                      AS total_candidates,
         (SELECT COUNT(*) FROM dbo.RECRUITER)                      AS total_recruiters,
         (SELECT COUNT(*) FROM dbo.JOB)                            AS total_jobs,
         (SELECT COUNT(*) FROM dbo.JOB WHERE status = 'Open')      AS open_jobs,
         (SELECT COUNT(*) FROM dbo.APPLICATION)                    AS total_applications,
         (SELECT COUNT(*) FROM dbo.INTERVIEW)                      AS total_interviews`
    );
    res.json(stats);
  } catch (err) {
    console.error('ADMIN STATS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN: ALL USERS =================
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await query(
      `SELECT u.user_id, u.email, u.role,
              COALESCE(
                (SELECT first_name + ' ' + last_name FROM dbo.CANDIDATE WHERE user_id = u.user_id),
                (SELECT first_name + ' ' + last_name FROM dbo.RECRUITER WHERE user_id = u.user_id),
                'N/A'
              ) AS full_name,
              COALESCE(
                (SELECT co.name FROM dbo.RECRUITER r
                 JOIN dbo.COMPANY co ON r.company_id = co.company_id
                 WHERE r.user_id = u.user_id),
                'N/A'
              ) AS company_name
       FROM dbo.USERS u
       ORDER BY u.role, u.email`
    );
    res.json(users);
  } catch (err) {
    console.error('ADMIN USERS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN: DELETE USER =================
app.delete('/api/admin/users/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    // Delete interviews linked to this candidate's applications
    await execute(`DELETE FROM dbo.INTERVIEW WHERE application_id IN (
       SELECT application_id FROM dbo.APPLICATION
       WHERE candidate_id IN (SELECT candidate_id FROM dbo.CANDIDATE WHERE user_id = @user_id))`, { user_id });
    await execute(`DELETE FROM dbo.APPLICATION WHERE candidate_id IN (SELECT candidate_id FROM dbo.CANDIDATE WHERE user_id = @user_id)`, { user_id });
    await execute(`DELETE FROM dbo.CANDIDATE WHERE user_id = @user_id`, { user_id });
    // Delete interviews linked to recruiter's jobs
    await execute(`DELETE FROM dbo.INTERVIEW WHERE application_id IN (
       SELECT application_id FROM dbo.APPLICATION
       WHERE job_id IN (SELECT job_id FROM dbo.JOB
         WHERE recruiter_id IN (SELECT recruiter_id FROM dbo.RECRUITER WHERE user_id = @user_id)))`, { user_id });
    await execute(`DELETE FROM dbo.APPLICATION WHERE job_id IN (SELECT job_id FROM dbo.JOB WHERE recruiter_id IN (SELECT recruiter_id FROM dbo.RECRUITER WHERE user_id = @user_id))`, { user_id });
    await execute(`DELETE FROM dbo.JOB       WHERE recruiter_id IN (SELECT recruiter_id FROM dbo.RECRUITER WHERE user_id = @user_id)`, { user_id });
    await execute(`DELETE FROM dbo.RECRUITER WHERE user_id = @user_id`, { user_id });
    await execute(`DELETE FROM dbo.USERS     WHERE user_id = @user_id`, { user_id });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE USER ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN: ALL JOBS =================
app.get('/api/admin/jobs', async (req, res) => {
  try {
    const jobs = await query(
      `SELECT j.job_id, j.title, j.salary, j.status,
              (r.first_name + ' ' + r.last_name) AS recruiter_name,
              co.name AS company_name,
              (SELECT COUNT(*) FROM dbo.APPLICATION a WHERE a.job_id = j.job_id) AS application_count
       FROM dbo.JOB j
       LEFT JOIN dbo.RECRUITER r  ON j.recruiter_id = r.recruiter_id
       LEFT JOIN dbo.COMPANY   co ON r.company_id   = co.company_id
       ORDER BY j.job_id DESC`
    );
    res.json(jobs);
  } catch (err) {
    console.error('ADMIN JOBS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================= START =================
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
