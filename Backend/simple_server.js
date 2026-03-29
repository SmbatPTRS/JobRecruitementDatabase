const express = require('express');
const sql = require('mssql');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ================= DB CONFIG =================
const dbConfig = {
  user: 'testuser',
  password: 'Test123!',
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
  const request = conn.request();
  Object.entries(params).forEach(([k, v]) => request.input(k, v));
  const result = await request.query(q);
  return result.recordset;
}

async function queryOne(q, params = {}) {
  const res = await query(q, params);
  return res[0] || null;
}

async function execute(q, params = {}) {
  const conn = await getConnection();
  const request = conn.request();
  Object.entries(params).forEach(([k, v]) => request.input(k, v));
  return request.query(q);
}

// ================= LOGIN =================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await queryOne(
      `SELECT user_id, email AS username, password, role 
       FROM dbo.USERS
       WHERE email = @username`,
      { username }
    );

    if (!user || password !== user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= JOBS =================
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await query(
      `SELECT j.job_id, j.title, j.description, j.salary,
              (r.first_name + ' ' + r.last_name) AS recruiter_name,
              c.name AS company_name
       FROM dbo.JOB j
       LEFT JOIN dbo.RECRUITER r ON j.recruiter_id = r.recruiter_id
       LEFT JOIN dbo.COMPANY c ON r.company_id = c.company_id`
    );
    res.json(jobs);
  } catch (err) {
    console.error("JOBS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= CREATE JOB =================
app.post('/api/jobs', async (req, res) => {
  try {
    const { title, description, salary, recruiter_id } = req.body;

    await execute(
      `INSERT INTO dbo.JOB (title, description, salary, recruiter_id)
       VALUES (@title, @description, @salary, @recruiter_id)`,
      { title, description, salary, recruiter_id }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("CREATE JOB ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= APPLY =================
app.post('/api/apply', async (req, res) => {
  try {
    const { candidate_id, job_id } = req.body;

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
    console.error("APPLY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= CANDIDATE APPLICATIONS =================
app.get('/api/applications/candidate/:candidate_id', async (req, res) => {
  try {
    const apps = await query(
      `SELECT a.application_id, a.status, a.application_date,
              j.title,
              (r.first_name + ' ' + r.last_name) AS recruiter_name,
              c.name AS company_name
       FROM dbo.APPLICATION a
       JOIN dbo.JOB j ON a.job_id = j.job_id
       LEFT JOIN dbo.RECRUITER r ON j.recruiter_id = r.recruiter_id
       LEFT JOIN dbo.COMPANY c ON r.company_id = c.company_id
       WHERE a.candidate_id = @candidate_id`,
      { candidate_id: req.params.candidate_id }
    );
    res.json(apps);
  } catch (err) {
    console.error("CANDIDATE APPLICATIONS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= UPDATE APPLICATION STATUS =================
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
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= RECRUITER APPLICATIONS =================
app.get('/api/recruiter-applications/:recruiter_id', async (req, res) => {
  try {
    const apps = await query(
      `SELECT a.application_id, a.status, a.application_date,
              j.title,
              c.candidate_id,
              (c.first_name + ' ' + c.last_name) AS candidate_name,
              c.email
       FROM dbo.APPLICATION a
       JOIN dbo.JOB j ON a.job_id = j.job_id
       JOIN dbo.CANDIDATE c ON a.candidate_id = c.candidate_id
       WHERE j.recruiter_id = @recruiter_id`,
      { recruiter_id: req.params.recruiter_id }
    );
    res.json(apps);
  } catch (err) {
    console.error("RECRUITER APPS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= CANDIDATE PROFILE =================
app.get('/api/candidate/:candidate_id', async (req, res) => {
  try {
    const candidate = await queryOne(
      `SELECT candidate_id,
              (first_name + ' ' + last_name) AS name,
              first_name, last_name,
              email, phone
       FROM dbo.CANDIDATE
       WHERE candidate_id = @candidate_id`,
      { candidate_id: req.params.candidate_id }
    );

    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    let skills = [];
    try {
      skills = await query(
        `SELECT s.name
         FROM dbo.SKILL s
         JOIN dbo.CANDIDATE_SKILL cs ON s.skill_id = cs.skill_id
         WHERE cs.candidate_id = @candidate_id`,
        { candidate_id: req.params.candidate_id }
      );
    } catch (_) { /* skills table may not exist */ }

    res.json({ ...candidate, skills });
  } catch (err) {
    console.error("CANDIDATE PROFILE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= RECRUITER PROFILE =================
app.get('/api/recruiter/:recruiter_id', async (req, res) => {
  try {
    const recruiter = await queryOne(
      `SELECT r.recruiter_id,
              (r.first_name + ' ' + r.last_name) AS name,
              r.first_name, r.last_name,
              r.email,
              c.name AS company_name
       FROM dbo.RECRUITER r
       LEFT JOIN dbo.COMPANY c ON r.company_id = c.company_id
       WHERE r.recruiter_id = @recruiter_id`,
      { recruiter_id: req.params.recruiter_id }
    );

    if (!recruiter) return res.status(404).json({ error: 'Recruiter not found' });

    res.json(recruiter);
  } catch (err) {
    console.error("RECRUITER PROFILE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN STATS =================
app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = await queryOne(
      `SELECT
         (SELECT COUNT(*) FROM dbo.USERS)        AS total_users,
         (SELECT COUNT(*) FROM dbo.CANDIDATE)    AS total_candidates,
         (SELECT COUNT(*) FROM dbo.RECRUITER)    AS total_recruiters,
         (SELECT COUNT(*) FROM dbo.JOB)          AS total_jobs,
         (SELECT COUNT(*) FROM dbo.APPLICATION)  AS total_applications`
    );
    res.json(stats);
  } catch (err) {
    console.error("ADMIN STATS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN ALL USERS =================
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
                (SELECT co.name 
                 FROM dbo.RECRUITER r 
                 JOIN dbo.COMPANY co ON r.company_id = co.company_id 
                 WHERE r.user_id = u.user_id),
                'N/A'
              ) AS company_name
       FROM dbo.USERS u
       ORDER BY u.role, u.email`
    );
    res.json(users);
  } catch (err) {
    console.error("ADMIN USERS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN DELETE USER =================
app.delete('/api/admin/users/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    // Remove dependent records before deleting user
    await execute(`DELETE FROM dbo.APPLICATION WHERE candidate_id IN (SELECT candidate_id FROM dbo.CANDIDATE WHERE user_id = @user_id)`, { user_id });
    await execute(`DELETE FROM dbo.CANDIDATE WHERE user_id = @user_id`, { user_id });
    await execute(`DELETE FROM dbo.APPLICATION WHERE job_id IN (SELECT job_id FROM dbo.JOB WHERE recruiter_id IN (SELECT recruiter_id FROM dbo.RECRUITER WHERE user_id = @user_id))`, { user_id });
    await execute(`DELETE FROM dbo.JOB WHERE recruiter_id IN (SELECT recruiter_id FROM dbo.RECRUITER WHERE user_id = @user_id)`, { user_id });
    await execute(`DELETE FROM dbo.RECRUITER WHERE user_id = @user_id`, { user_id });
    await execute(`DELETE FROM dbo.USERS WHERE user_id = @user_id`, { user_id });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN ALL JOBS =================
app.get('/api/admin/jobs', async (req, res) => {
  try {
    const jobs = await query(
      `SELECT j.job_id, j.title, j.salary,
              (r.first_name + ' ' + r.last_name) AS recruiter_name,
              co.name AS company_name,
              (SELECT COUNT(*) FROM dbo.APPLICATION a WHERE a.job_id = j.job_id) AS application_count
       FROM dbo.JOB j
       LEFT JOIN dbo.RECRUITER r ON j.recruiter_id = r.recruiter_id
       LEFT JOIN dbo.COMPANY co ON r.company_id = co.company_id
       ORDER BY j.job_id DESC`
    );
    res.json(jobs);
  } catch (err) {
    console.error("ADMIN JOBS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= START =================
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
