# Job Recruitment Database System

## Overview
This project is a database-driven system designed to manage the recruitment process. It models how companies handle job postings, candidate applications, and hiring workflows.

The system combines a SQL Server database, a Node.js backend, and a simple frontend interface.

---

## Purpose of the Project

The objective of this project is to demonstrate:

- Database design (ER diagram → relational schema)
- Implementation of a real-world system
- Use of advanced SQL features (views, triggers, indexes, stored procedures)
- Basic integration with a backend and frontend

---

## System Features

- Candidate and recruiter management
- Job posting creation
- Application tracking and status updates
- Interview scheduling
- Role-based access control

---

## Project Structure

```
job-portal-db-project/
│
├── backend/        # Node.js server
├── frontend/       # HTML interface
├── database/       # SQL scripts
├── diagrams/       # ER, relational schema, use-case diagrams
├── README.md

```

---

## Technologies Used

- SQL Server (SSMS)
- Node.js (Express)
- HTML / CSS

---

## How to Run the Project

### 1. Database Setup

Open SQL Server Management Studio (SSMS) and run the scripts in order:

1. Create tables:
   ```
   database/ddl/schema.sql
   ```
2. Insert data:
   ```
   database/dml/data.sql
   ```
3. Create additional components:
   ```
   database/views/views.sql
   database/indexes/indexes.sql
   database/triggers/triggers.sql
   database/procedures/procedures.sql
   database/dcl/permissions.sql
   ```

---

### 2. Backend Setup

Go to the backend folder:
```bash
cd backend
```

Install Node.js dependencies:
```bash
npm install
```

Run the server:
```bash
node simple_server.js
```

---

### 3. Frontend

Open in your browser:
```
frontend/index.html
```

---

## Environment Variables

Create a `.env` file inside the `backend/` folder with your database configuration:

```env
DB_USER=your_username
DB_PASSWORD=your_password
DB_SERVER=localhost
DB_NAME=your_database_name
```

---

## Key Concepts Implemented

- DDL, DML, DQL, and DCL operations
- Views for reusable queries
- Indexes for performance optimization
- Triggers for enforcing business rules
- Stored procedures for reusable logic

---

## Conclusion

This project demonstrates how a recruitment system can be fully designed and implemented, from database modeling to application integration.

---

## Author

Smb
