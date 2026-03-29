CREATE VIEW vw_CandidateApplications AS
SELECT c.first_name, c.last_name, j.title, a.status
FROM CANDIDATE c
JOIN APPLICATION a ON c.candidate_id = a.candidate_id
JOIN JOB j ON a.job_id = j.job_id;

CREATE VIEW vw_OpenJobs AS
SELECT j.title, c.name AS company
FROM JOB j
JOIN RECRUITER r ON j.recruiter_id = r.recruiter_id
JOIN COMPANY c ON r.company_id = c.company_id
WHERE j.status = 'Open';

CREATE VIEW vw_AcceptedApplications AS
SELECT a.application_id, j.title
FROM APPLICATION a
JOIN JOB j ON a.job_id = j.job_id
WHERE a.status = 'Accepted';