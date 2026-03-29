CREATE TABLE USERS (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL
);

CREATE TABLE COMPANY (
    company_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    location VARCHAR(100),
    industry VARCHAR(100),
    website VARCHAR(255)
);

CREATE TABLE RECRUITER (
    recruiter_id INT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(20),
    company_id INT,
    user_id INT UNIQUE
);

CREATE TABLE CANDIDATE (
    candidate_id INT PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    resume_url VARCHAR(255),
    created_at DATE,
    user_id INT UNIQUE
);

CREATE TABLE JOB (
    job_id INT IDENTITY(1,1) PRIMARY KEY,
    title VARCHAR(100),
    description VARCHAR(300),
    salary NUMERIC(10,2),
    location VARCHAR(150),
    status VARCHAR(30),
    created_at DATE,
    recruiter_id INT
);

CREATE TABLE APPLICATION (
    application_id INT IDENTITY(1,1) PRIMARY KEY,
    application_date DATE,
    status VARCHAR(30),
    candidate_id INT,
    job_id INT,
    UNIQUE(candidate_id, job_id)
);

CREATE TABLE INTERVIEW (
    interview_id INT PRIMARY KEY,
    interview_date DATE,
    interview_type VARCHAR(50),
    result VARCHAR(50),
    application_id INT
);

CREATE TABLE SKILL (
    skill_id INT PRIMARY KEY,
    name VARCHAR(50) UNIQUE
);

CREATE TABLE HAS_SKILL (
    candidate_id INT,
    skill_id INT,
    proficiency_level VARCHAR(30),
    PRIMARY KEY(candidate_id, skill_id)
);

CREATE TABLE REQUIRES (
    job_id INT,
    skill_id INT,
    required_level VARCHAR(30),
    PRIMARY KEY(job_id, skill_id)
);