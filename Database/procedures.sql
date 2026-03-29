CREATE PROCEDURE AddCandidate
    @candidate_id INT,
    @first_name VARCHAR(50),
    @last_name VARCHAR(50),
    @email VARCHAR(100),
    @phone VARCHAR(20),
    @resume_url VARCHAR(255)
AS
BEGIN
    INSERT INTO CANDIDATE
    VALUES (@candidate_id, @first_name, @last_name, @email, @phone, @resume_url, GETDATE(), NULL);
END;
GO

CREATE PROCEDURE ApplyToJob
    @candidate_id INT,
    @job_id INT
AS
BEGIN
    INSERT INTO APPLICATION (application_date, status, candidate_id, job_id)
    VALUES (GETDATE(), 'Pending', @candidate_id, @job_id);
END;
GO

CREATE PROCEDURE ScheduleInterview
    @interview_id INT,
    @application_id INT,
    @date DATE
AS
BEGIN
    INSERT INTO INTERVIEW
    VALUES (@interview_id, @date, 'HR', 'Pending', @application_id);
END;
GO