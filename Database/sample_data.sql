INSERT INTO USERS (email, password, role) VALUES
('admin@mail.com', 'admin123', 'admin'),
('hr@mail.com', 'hr123', 'hr'),
('recruiter@mail.com', 'rec123', 'recruiter'),
('candidate1@mail.com', 'cand123', 'candidate'),
('candidate2@mail.com', 'cand123', 'candidate');

INSERT INTO COMPANY VALUES
(1, 'TechCorp', 'Yerevan', 'IT', 'www.techcorp.com');

INSERT INTO RECRUITER VALUES
(1, 'recruiter@mail.com', 'Arman', 'Hakobyan', '099123456', 1, 3);

INSERT INTO CANDIDATE VALUES
(1, 'Ani', 'Petrosyan', 'candidate1@mail.com', '091111111', 'cv.pdf', GETDATE(), 4),
(2, 'David', 'Sargsyan', 'candidate2@mail.com', '092222222', 'cv.pdf', GETDATE(), 5);

INSERT INTO JOB (title, description, salary, location, status, created_at, recruiter_id)
VALUES ('Backend Dev', 'C# .NET', 1500, 'Yerevan', 'Open', GETDATE(), 1);

INSERT INTO SKILL VALUES (1, 'C#'), (2, 'SQL');

INSERT INTO HAS_SKILL VALUES
(1,1,'Advanced'),
(2,2,'Intermediate');

INSERT INTO REQUIRES VALUES
(1,1,'Advanced');

INSERT INTO APPLICATION (application_date, status, candidate_id, job_id)
VALUES (GETDATE(),'Pending',1,1);