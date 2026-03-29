CREATE ROLE recruiter_role;
CREATE ROLE hr_role;
CREATE ROLE candidate_role;
CREATE ROLE admin_role;

CREATE USER recruiter_user FOR LOGIN recruiter_login;
CREATE USER hr_user FOR LOGIN hr_login;
CREATE USER candidate_user FOR LOGIN candidate_login;
CREATE USER admin_user FOR LOGIN admin_login;

ALTER ROLE recruiter_role ADD MEMBER recruiter_user;
ALTER ROLE hr_role ADD MEMBER hr_user;
ALTER ROLE candidate_role ADD MEMBER candidate_user;
ALTER ROLE admin_role ADD MEMBER admin_user;