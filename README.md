# University Laboratory Booking & Equipment Management System

## Project Overview

The University Laboratory Booking & Equipment Management System is a full-stack web application developed for the Department of Electrical and Information Engineering, University of Ruhuna, as part of the EC4307 Web Application Development mini project.
The system provides a centralized platform for managing university laboratories, equipment inventory, and booking requests. Students and staff can request laboratory facilities and equipment, while administrators manage resources, review requests, and monitor availability.

## Main Features

Student
- Register and log in to the system.
- View laboratory details, facilities, and booking schedules.
- Request the Undergraduate Project Laboratory.
- Select equipment and required quantities during laboratory booking.
- Submit equipment-only requests.
- View booking status and request history.

 Staff / Instructor
- Register and request administrator verification.
- View laboratory information and schedules.
- Request laboratories for practical sessions.
- Request equipment with or without a laboratory booking.
- Track submitted booking requests.

 Administrator
- Verify staff registrations.
- Approve or reject laboratory and equipment requests.
- Check overlapping laboratory bookings and equipment availability.
- Manage laboratory records.
- Manage equipment inventory and quantities.
- Track individual equipment units using unique identification numbers.
- Manage equipment repairs and retirement.
- Manage registered users and access reports.

Technologies Used

 Frontend - React, Vite, JavaScript 
 Backend - Node.js, Express.js 
 Database - MongoDB Atlas 
 Database Modeling - Mongoose 
 API - REST API 
 Version Control - Git and GitHub 
 Deployment - Vercel 

## Project Structure

University-Lab-Management/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   └── data/
│   └── package.json
├── backend/
│   └── package.json
├── .gitignore
└── README.md

The frontend contains the React user interface, while the backend handles API requests, authentication, database operations, and application logic.

## Installation and Setup

### Prerequisites

Install the following software:

- Node.js and npm
- Git
- Visual Studio Code or another code editor
- A MongoDB Atlas database connection

### Step 1: Clone the Repository

git clone https://github.com/ATHUKORALALAKVL/University-Lab-Management.git
cd University-Lab-Management

### Step 2: Install Backend Dependencies

Open a terminal and run:

cd backend
npm install

### Step 3: Configure Environment Variables

### Step 3: Configure Backend Environment Variables

### Step 3: Configure Backend Environment Variables

Create a .env file inside the backend folder and configure the following variables:


MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secure_random_secret_key
PORT=5000
FRONTEND_URL=http://localhost:5173


**Environment Variable Descriptions**


MONGO_URI-Connects the backend to MongoDB Atlas. 
JWT_SECRET -Signs authentication tokens used for secure login. 
PORT - Specifies the backend server port. 
FRONTEND_URL - Specifies the frontend address allowed by the backend's CORS configuration. 

The port 5000 is an example and should be adjusted to match the backend configuration.


### Step 4: Start the Backend

From the backend folder, run the development or start script defined in `backend/package.json`.
For example, if the backend has a development script:

npm run dev


### Step 5: Install Frontend Dependencies

Open another terminal:

cd frontend
npm install


### Step 6: Start the Frontend


npm run dev


Open the local address displayed in the terminal, normally:

http://localhost:5173

Note- The frontend may be configured to communicate with the deployed backend. Check the API configuration before switching between local and deployed backend environments.

## Database Design

The application uses MongoDB Atlas with Mongoose models.

The main database collections are:

 users - Stores user accounts and roles 
 labs - Stores laboratory information 
 bookings - Stores laboratory and equipment requests 
 equipment - Stores equipment types and inventory information 
 equipmentitems - Stores individually identified equipment units 
 equipmentrepairs - Stores equipment repair records 

Relationships between these records support booking management, equipment tracking, and availability checking.

## Booking and Approval Process

1. A student or staff member submits a laboratory booking or equipment request.
2. The request is stored with Pending status.
3. The administrator reviews pending requests in submission order.
4. The system checks laboratory time conflicts and equipment availability.
5. The administrator approves or rejects the request.
6. The user can view the updated request status.

Laboratory and equipment selections submitted together are processed as one request.

## Equipment Management

Each physical equipment unit can be identified using a unique ID, such as `OSC-001`.
This supports tracking of individual equipment units, repair periods, and retirement. Units that are under repair or permanently retired are excluded from usable inventory as appropriate.

## Deployment

**Live Application:**

https://university-lab-management.vercel.app

**Backend API:**

https://university-lab-backend.vercel.app

**GitHub Repository:**

https://github.com/ATHUKORALALAKVL/University-Lab-Management

## Testing

The main testing areas include:

- Laboratory CRUD operations
- Equipment inventory management
- User registration and login
- Laboratory and equipment booking requests
- Booking approval and rejection
- Laboratory conflict detection
- Equipment quantity validation
- Form validation and access control
- Database persistence after refreshing the application


## Future Improvements

Possible future improvements include email notifications, QR-code-based equipment identification, advanced resource utilization reports, preventive maintenance scheduling, and integration with university authentication systems.
