# LMS Authentication System

A complete authentication system for Learning Management System (LMS) with support for both students and staff login.

## Features

- ✅ Student and Staff authentication
- ✅ Password encryption using bcrypt
- ✅ JWT token generation
- ✅ Universal login (automatically detects user type)
- ✅ Account status validation
- ✅ Last login tracking
- ✅ Secure password comparison

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file with the following variables:

   ```env
   PORT=3000
   JWT_SECRET=your_jwt_secret_key_here

   # Database Configuration
   DB_NAME=your_lms_database
   DB_USER=your_db_username
   DB_PASSWORD=your_db_password
   DB_HOST=your_db_host
   DB_PORT=5432
   DATABASE_URL=your_database_url

   # Library Database (if needed)
   DATABASE_N=your_library_database
   DATABASE_U=your_library_username
   DATABASE_P=your_library_password
   DATABASE_H=your_library_host
   ```

3. **Create test users:**

   ```bash
   node src/utils/createTestUsers.js
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication Endpoints

#### 1. Universal Login

- **POST** `/api/auth/login`
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": 1,
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@student.com",
        "department": "Computer Science",
        "lastLogin": "2024-01-01T00:00:00.000Z",
        "studentId": "STU001",
        "level": 200
      },
      "token": "jwt_token_here",
      "userType": "student"
    }
  }
  ```

#### 2. Student Login

- **POST** `/api/auth/student/login`
- Same body and response format as universal login

#### 3. Staff Login

- **POST** `/api/auth/staff/login`
- Same body and response format as universal login

#### 4. Logout

- **POST** `/api/auth/logout`
- **Response:**
  ```json
  {
    "success": true,
    "message": "Logout successful"
  }
  ```

## Database Models

### Student Model

- `id` - Primary key
- `studentId` - Unique student identifier
- `firstName` - Student's first name
- `lastName` - Student's last name
- `email` - Unique email address
- `password` - Encrypted password
- `phone` - Phone number
- `department` - Department name
- `level` - Academic level (100, 200, 300, 400, etc.)
- `isActive` - Account status
- `lastLogin` - Last login timestamp

### Staff Model

- `id` - Primary key
- `staffId` - Unique staff identifier
- `firstName` - Staff's first name
- `lastName` - Staff's last name
- `email` - Unique email address
- `password` - Encrypted password
- `phone` - Phone number
- `department` - Department name
- `role` - Staff role (lecturer, admin, hod, dean)
- `isActive` - Account status
- `lastLogin` - Last login timestamp

## Security Features

1. **Password Encryption:** All passwords are hashed using bcrypt with 12 salt rounds
2. **JWT Tokens:** Secure token-based authentication
3. **Input Validation:** Email format and required field validation
4. **Account Status:** Active/inactive account checking
5. **Case Insensitive:** Email comparison is case insensitive

## Error Handling

The system provides clear error messages for:

- Missing email or password
- Invalid credentials
- Deactivated accounts
- Database connection issues

## Testing

Use the provided test credentials after running the test user creation script:

**Student:**

- Email: `john.doe@student.com`
- Password: `student123`

**Staff:**

- Email: `jane.smith@staff.com`
- Password: `staff123`

## Usage Examples

### Using Universal Login

```javascript
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "john.doe@student.com",
    password: "student123",
  }),
});

const data = await response.json();
console.log(data.data.userType); // "student" or "staff"
console.log(data.data.token); // JWT token
```

### Using Specific Login

```javascript
// For students only
const response = await fetch("/api/auth/student/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "john.doe@student.com",
    password: "student123",
  }),
});
```

## Notes

- The system automatically detects whether the user is a student or staff member
- Passwords are never returned in API responses
- JWT tokens expire after 24 hours
- All database operations are wrapped in try-catch blocks for error handling
