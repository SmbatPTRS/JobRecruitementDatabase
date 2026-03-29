CREATE INDEX idx_application_candidate ON APPLICATION(candidate_id);
CREATE INDEX idx_application_job ON APPLICATION(job_id);
CREATE INDEX idx_has_skill_skill ON HAS_SKILL(skill_id);
CREATE INDEX idx_interview_application ON INTERVIEW(application_id);
CREATE INDEX idx_recruiter_company ON RECRUITER(company_id);
CREATE INDEX idx_requires_skill ON REQUIRES(skill_id);