
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER TRIGGER [dbo].[trg_PreventDuplicateApplication]
ON [dbo].[APPLICATION]
INSTEAD OF INSERT
AS
BEGIN
    IF EXISTS (
        SELECT 1
        FROM dbo.APPLICATION a
        JOIN inserted i
        ON a.candidate_id = i.candidate_id
        AND a.job_id = i.job_id
    )
    BEGIN
        PRINT 'Duplicate application is not allowed';
        RETURN;
    END

    INSERT INTO dbo.APPLICATION (candidate_id, job_id, status, application_date)
    SELECT candidate_id, job_id, status, application_date
    FROM inserted;
END;






SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TRIGGER trg_CreateInterview
ON APPLICATION
AFTER UPDATE
AS
BEGIN
    INSERT INTO INTERVIEW (interview_id, interview_date, interview_type, result, application_id)
    SELECT 
        (SELECT ISNULL(MAX(interview_id), 0) + ROW_NUMBER() OVER (ORDER BY i.application_id) FROM INTERVIEW),
        GETDATE(),
        'HR',
        'Pending',
        i.application_id
    FROM INSERTED i
    WHERE i.status = 'Accepted';
END;

ALTER TRIGGER [dbo].[trg_CloseJobAfterHiring]
ON [dbo].[INTERVIEW]
AFTER UPDATE
AS
BEGIN
    UPDATE JOB
    SET status = 'Closed'
    WHERE job_id IN (
        SELECT j.job_id
        FROM INSERTED i
        JOIN APPLICATION a ON i.application_id = a.application_id
        JOIN JOB j ON a.job_id = j.job_id
        WHERE i.result = 'Passed' OR i.result = 'Accepted'
    );
END;
