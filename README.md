# Survio Backend

This is the backend for **Survio**, a survey building and distribution platform for indie game developers.

## 📌 Features
- **User Authentication** (Custom authentication with JWT)
- **Role-Based Access Control (RBA)** (Owner, Admin, Researcher, Viewer)
- **Team & User Management** (Assign users to teams, change roles, remove users)
- **Survey Management** (Create, update, and delete surveys)
- **Survey Responses** (Collect and visualize user feedback)
- **RESTful API** (Built with Express & PostgreSQL)

## 🚀 Tech Stack
- **Node.js & Express.js** (API framework)
- **PostgreSQL (NeonDB)** (Database)
- **Render** (Hosting)
- **Zod** (Validation)
- **bcrypt** (Password hashing)
- **JWT** (Authentication)
- **Nodemailer** (Email invitations)

## 📂 Project Structure
```
backend/
│── src/
│   ├── routes/        # API routes (users, teams, surveys)
│   ├── middlewares/   # Authentication & Role middleware
│   ├── models/        # Database models
│   ├── controllers/   # Business logic
│   ├── config/        # Database connection & environment variables
│── index.js           # Entry point
│── package.json       # Dependencies
│── .env               # Environment variables
```

## ⚙️ Setup & Installation

### **1️⃣ Clone the Repository**
```sh
git clone https://github.com/yourusername/survio-backend.git
cd survio-backend
```

### **2️⃣ Install Dependencies**
```sh
npm install
```

### **3️⃣ Set Up Environment Variables**
Create a `.env` file in the root and configure:
```ini
PORT=5000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secret_key
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
```

### **4️⃣ Run the Server**
```sh
npm run dev
```
The server should now be running at **http://localhost:5000** 🚀

## 🛠️ API Endpoints
### **Auth Routes**
| Method | Endpoint           | Description |
|--------|-------------------|-------------|
| POST   | `/auth/register`  | Register a new user |
| POST   | `/auth/login`     | Login and get JWT |
| POST   | `/auth/set-password` | Set a password for invited users |

### **User Management**
| Method | Endpoint         | Description |
|--------|-----------------|-------------|
| GET    | `/users`        | List all users |
| PUT    | `/users/change-role` | Change user role |
| DELETE | `/users/:id`    | Remove a user |

### **Teams**
| Method | Endpoint           | Description |
|--------|-------------------|-------------|
| GET    | `/teams`          | Get all teams |
| POST   | `/teams`          | Create a new team |
| POST   | `/teams/assign-team` | Assign a user to a team |

### **Surveys**
| Method | Endpoint         | Description |
|--------|-----------------|-------------|
| GET    | `/surveys`      | List all surveys |
| POST   | `/surveys`      | Create a new survey |

## 🌍 Deployment
### Deploy to **Render**
1. **Push code to GitHub**
2. **Go to [Render](https://render.com/)** → Create new Web Service
3. **Set Environment Variables** (from `.env` file)
4. **Deploy!** 🚀

## 🤝 Contributing
Pull requests are welcome! If you'd like to improve the project, feel free to submit a PR. 🎉

## 📜 License
MIT License © 2025 Your Name
