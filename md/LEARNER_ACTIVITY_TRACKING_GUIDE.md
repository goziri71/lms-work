# Learner Activity Tracking System - Implementation Guide

## Overview

The Learner Activity Tracking System allows tutors to monitor and track all activities of their learners (both WPU students and marketplace learners) who have purchased courses from them. This includes tracking page views, course progress, login history, and location data.

## Features

- **Comprehensive Activity Logging**: Tracks every page view, course access, module/unit views, and completions
- **Course Progress Tracking**: Automatically tracks course completion percentage, modules completed, units viewed, and time spent
- **Login History**: Records all login events with IP addresses, geolocation (country, city), device type, browser, and OS
- **Real-time Monitoring**: Tutors can view learner activity in real-time
- **Geolocation Tracking**: Automatically determines learner location from IP addresses
- **Automatic Progress Calculation**: System automatically calculates completion percentages and tracks module/unit completion

## Database Tables

### 1. `learner_activity_logs`

Tracks all learner activities.

**Columns:**
- `id` - Primary key
- `student_id` - Student/learner ID
- `activity_type` - Type of activity (login, logout, course_view, module_view, unit_view, course_completed, module_completed, unit_completed, quiz_attempt, exam_attempt, download, video_play, other)
- `course_id` - Course ID (if activity is course-related)
- `module_id` - Module ID (if activity is module-related)
- `unit_id` - Unit ID (if activity is unit-related)
- `tutor_id` - Tutor ID (owner of the course)
- `tutor_type` - Type of tutor (sole_tutor, organization, wpu)
- `ip_address` - IP address of the learner
- `location_country` - Country from IP geolocation
- `location_city` - City from IP geolocation
- `device_type` - Device type (mobile, desktop, tablet)
- `browser` - Browser name and version
- `user_agent` - Full user agent string
- `duration_seconds` - Duration spent on this activity (for views)
- `metadata` - Additional metadata (JSONB)
- `created_at` - Timestamp

**Indexes:**
- `idx_learner_activity_student` - On `student_id`
- `idx_learner_activity_tutor` - On `tutor_id, tutor_type`
- `idx_learner_activity_course` - On `course_id`
- `idx_learner_activity_type` - On `activity_type`
- `idx_learner_activity_created` - On `created_at`
- `idx_learner_activity_student_course` - On `student_id, course_id`

### 2. `course_progress`

Tracks course progress for each learner.

**Columns:**
- `id` - Primary key
- `student_id` - Student/learner ID
- `course_id` - Course ID
- `tutor_id` - Tutor ID (owner of the course)
- `tutor_type` - Type of tutor (sole_tutor, organization, wpu)
- `total_modules` - Total number of modules in the course
- `completed_modules` - Number of completed modules
- `total_units` - Total number of units in the course
- `viewed_units` - Number of units viewed
- `completion_percentage` - Course completion percentage (0-100)
- `is_completed` - Whether all modules are completed
- `last_accessed_at` - Last time student accessed this course
- `started_at` - When student first accessed this course
- `completed_at` - When student completed all modules
- `total_time_spent_seconds` - Total time spent on course in seconds
- `metadata` - Additional progress metadata (JSONB)
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Indexes:**
- `idx_course_progress_unique` - Unique on `student_id, course_id`
- `idx_course_progress_tutor` - On `tutor_id, tutor_type`
- `idx_course_progress_course` - On `course_id`
- `idx_course_progress_completed` - On `is_completed`
- `idx_course_progress_last_accessed` - On `last_accessed_at`

### 3. `learner_login_history`

Tracks detailed login history for learners.

**Columns:**
- `id` - Primary key
- `student_id` - Student/learner ID
- `ip_address` - IP address used for login
- `location_country` - Country from IP geolocation
- `location_city` - City from IP geolocation
- `location_region` - Region/state from IP geolocation
- `location_latitude` - Latitude from IP geolocation
- `location_longitude` - Longitude from IP geolocation
- `device_type` - Device type (mobile, desktop, tablet)
- `browser` - Browser name and version
- `operating_system` - Operating system
- `user_agent` - Full user agent string
- `login_at` - Login timestamp
- `logout_at` - Logout timestamp (if tracked)
- `session_duration_seconds` - Session duration in seconds
- `is_active` - Whether session is still active
- `metadata` - Additional login metadata (JSONB)
- `created_at` - Timestamp

**Indexes:**
- `idx_learner_login_student` - On `student_id`
- `idx_learner_login_ip` - On `ip_address`
- `idx_learner_login_time` - On `login_at`
- `idx_learner_login_active` - On `is_active`
- `idx_learner_login_country` - On `location_country`

## Migration

Run the migration script to create all tables:

```bash
node scripts/migrate-learner-activity-tracking.js
```

This script:
- Creates all three tables with proper indexes
- Supports both PostgreSQL and MySQL/MariaDB
- Uses `IF NOT EXISTS` to prevent errors if tables already exist

## API Endpoints

All endpoints require tutor authentication (`tutorAuthorize` middleware).

### 1. Get All Learners

**GET** `/api/marketplace/tutor/learners`

Get a list of all learners who purchased courses from the tutor.

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `search` (optional) - Search by name, email, or matric number
- `course_id` (optional) - Filter by specific course

**Response:**
```json
{
  "success": true,
  "message": "Learners retrieved successfully",
  "data": {
    "learners": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "matric_number": "WPU/2024/001",
        "phone": "+1234567890",
        "country": "Nigeria",
        "joined_at": "2024-01-15T10:00:00Z",
        "courses": [
          {
            "course_id": 5,
            "course_title": "Introduction to Programming",
            "course_code": "CS101",
            "completion_percentage": 75.5,
            "is_completed": false,
            "last_accessed_at": "2024-01-20T14:30:00Z",
            "time_spent_hours": 12.5
          }
        ]
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

### 2. Get Learner Details

**GET** `/api/marketplace/tutor/learners/:learnerId`

Get detailed information about a specific learner, including activity log and login history.

**Response:**
```json
{
  "success": true,
  "message": "Learner details retrieved successfully",
  "data": {
    "learner": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "matric_number": "WPU/2024/001",
      "phone": "+1234567890",
      "country": "Nigeria",
      "state_origin": "Lagos",
      "joined_at": "2024-01-15T10:00:00Z"
    },
    "course_progress": [
      {
        "course_id": 5,
        "course_title": "Introduction to Programming",
        "course_code": "CS101",
        "course_image": "https://...",
        "total_modules": 10,
        "completed_modules": 7,
        "total_units": 50,
        "viewed_units": 35,
        "completion_percentage": 75.5,
        "is_completed": false,
        "started_at": "2024-01-15T10:00:00Z",
        "last_accessed_at": "2024-01-20T14:30:00Z",
        "completed_at": null,
        "time_spent_hours": 12.5
      }
    ],
    "recent_activity": [
      {
        "id": 123,
        "activity_type": "unit_view",
        "course_id": 5,
        "course_title": "Introduction to Programming",
        "module_id": 3,
        "unit_id": 15,
        "ip_address": "192.168.1.1",
        "location_country": "Nigeria",
        "location_city": "Lagos",
        "device_type": "desktop",
        "browser": "Chrome",
        "duration_seconds": 300,
        "created_at": "2024-01-20T14:30:00Z",
        "metadata": null
      }
    ],
    "login_history": [
      {
        "id": 45,
        "ip_address": "192.168.1.1",
        "location_country": "Nigeria",
        "location_city": "Lagos",
        "location_region": "Lagos State",
        "device_type": "desktop",
        "browser": "Chrome",
        "operating_system": "Windows",
        "login_at": "2024-01-20T14:00:00Z",
        "logout_at": null,
        "session_duration_seconds": null,
        "is_active": true
      }
    ]
  }
}
```

### 3. Get Learner Activity Log

**GET** `/api/marketplace/tutor/learners/:learnerId/activity`

Get activity log for a specific learner with filtering options.

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 50) - Items per page
- `activity_type` (optional) - Filter by activity type (course_view, module_view, unit_view, etc.)
- `course_id` (optional) - Filter by specific course
- `start_date` (optional) - Filter from date (ISO format)
- `end_date` (optional) - Filter to date (ISO format)

**Response:**
```json
{
  "success": true,
  "message": "Learner activity retrieved successfully",
  "data": {
    "activities": [
      {
        "id": 123,
        "activity_type": "unit_view",
        "course_id": 5,
        "course_title": "Introduction to Programming",
        "course_code": "CS101",
        "module_id": 3,
        "unit_id": 15,
        "ip_address": "192.168.1.1",
        "location_country": "Nigeria",
        "location_city": "Lagos",
        "device_type": "desktop",
        "browser": "Chrome",
        "duration_seconds": 300,
        "created_at": "2024-01-20T14:30:00Z",
        "metadata": null
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 50,
      "totalPages": 3
    }
  }
}
```

### 4. Get Learner Course Progress

**GET** `/api/marketplace/tutor/learners/:learnerId/courses/:courseId/progress`

Get detailed progress for a specific learner in a specific course.

**Response:**
```json
{
  "success": true,
  "message": "Course progress retrieved successfully",
  "data": {
    "course_id": 5,
    "course_title": "Introduction to Programming",
    "completion_percentage": 75.5,
    "is_completed": false,
    "total_modules": 10,
    "completed_modules": 7,
    "total_units": 50,
    "viewed_units": 35,
    "started_at": "2024-01-15T10:00:00Z",
    "last_accessed_at": "2024-01-20T14:30:00Z",
    "completed_at": null,
    "time_spent_hours": 12.5
  }
}
```

## Activity Types

The system tracks the following activity types:

- `login` - Learner logged in
- `logout` - Learner logged out
- `course_view` - Learner viewed a course (accessed modules list)
- `module_view` - Learner viewed a module (accessed units list)
- `unit_view` - Learner viewed a unit
- `course_completed` - Learner completed all modules in a course
- `module_completed` - Learner completed all units in a module
- `unit_completed` - Learner completed a unit
- `quiz_attempt` - Learner attempted a quiz
- `exam_attempt` - Learner attempted an exam
- `download` - Learner downloaded content
- `video_play` - Learner played a video
- `other` - Other activities

## Automatic Activity Tracking

The system automatically tracks activities when learners:

1. **View Courses**: When a student accesses `/api/modules/courses/:courseId/modules`, the system logs a `course_view` activity
2. **View Modules**: When a student accesses `/api/modules/modules/:moduleId/units`, the system logs a `module_view` activity
3. **Login**: When a student logs in, the system logs a `login` activity and creates a login history record with geolocation

### Course Progress Calculation

The system automatically:
- Tracks which modules have been completed (all units viewed)
- Calculates completion percentage: `(completed_modules / total_modules) * 100`
- Marks course as completed when all modules are completed
- Tracks time spent on each activity (if duration is provided)
- Updates `last_accessed_at` whenever learner accesses the course

## IP Geolocation

The system uses IP geolocation services to determine learner location:

- **Primary Service**: `ip-api.com` (free, 45 requests/minute)
- **Fallback Service**: `ipapi.co`
- **Data Retrieved**: Country, city, region, latitude, longitude, timezone, ISP

**Note**: Local/private IP addresses (127.0.0.1, 192.168.x.x, 10.x.x.x, 172.x.x.x) are not geolocated.

## Frontend Implementation

### 1. Get All Learners

```javascript
// React example
const fetchLearners = async (page = 1, search = '') => {
  try {
    const response = await fetch(
      `/api/marketplace/tutor/learners?page=${page}&limit=20&search=${search}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching learners:', error);
  }
};
```

### 2. Display Learner List

```jsx
// React component example
function LearnersList() {
  const [learners, setLearners] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLearners().then((data) => {
      setLearners(data.learners);
      setPagination(data.pagination);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>My Learners</h2>
      {learners.map((learner) => (
        <div key={learner.id} className="learner-card">
          <h3>{learner.name}</h3>
          <p>{learner.email}</p>
          <p>Matric: {learner.matric_number || 'N/A'}</p>
          <p>Country: {learner.country || 'N/A'}</p>
          <div>
            <h4>Courses:</h4>
            {learner.courses.map((course) => (
              <div key={course.course_id}>
                <p>{course.course_title}</p>
                <p>Progress: {course.completion_percentage}%</p>
                <p>Time Spent: {course.time_spent_hours} hours</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 3. Display Learner Activity

```jsx
// React component example
function LearnerActivity({ learnerId }) {
  const [activities, setActivities] = useState([]);
  const [filters, setFilters] = useState({
    activity_type: '',
    course_id: '',
    start_date: '',
    end_date: '',
  });

  const fetchActivity = async () => {
    const params = new URLSearchParams({
      page: 1,
      limit: 50,
      ...filters,
    });
    
    const response = await fetch(
      `/api/marketplace/tutor/learners/${learnerId}/activity?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    const data = await response.json();
    setActivities(data.data.activities);
  };

  useEffect(() => {
    fetchActivity();
  }, [learnerId, filters]);

  return (
    <div>
      <h2>Activity Log</h2>
      <div className="filters">
        <select
          value={filters.activity_type}
          onChange={(e) => setFilters({ ...filters, activity_type: e.target.value })}
        >
          <option value="">All Activities</option>
          <option value="course_view">Course Views</option>
          <option value="module_view">Module Views</option>
          <option value="unit_view">Unit Views</option>
          <option value="course_completed">Course Completions</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Activity</th>
            <th>Course</th>
            <th>Location</th>
            <th>Device</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <tr key={activity.id}>
              <td>{activity.activity_type}</td>
              <td>{activity.course_title}</td>
              <td>
                {activity.location_city}, {activity.location_country}
              </td>
              <td>{activity.device_type} - {activity.browser}</td>
              <td>{new Date(activity.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 4. Display Course Progress

```jsx
// React component example
function CourseProgress({ learnerId, courseId }) {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    fetch(
      `/api/marketplace/tutor/learners/${learnerId}/courses/${courseId}/progress`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    )
      .then((res) => res.json())
      .then((data) => setProgress(data.data));
  }, [learnerId, courseId]);

  if (!progress) return <div>Loading...</div>;

  return (
    <div>
      <h3>{progress.course_title}</h3>
      <div className="progress-bar">
        <div
          style={{ width: `${progress.completion_percentage}%` }}
          className="progress-fill"
        >
          {progress.completion_percentage}%
        </div>
      </div>
      <p>Modules: {progress.completed_modules} / {progress.total_modules}</p>
      <p>Units: {progress.viewed_units} / {progress.total_units}</p>
      <p>Time Spent: {progress.time_spent_hours} hours</p>
      <p>Last Accessed: {new Date(progress.last_accessed_at).toLocaleString()}</p>
      {progress.is_completed && (
        <p>Completed: {new Date(progress.completed_at).toLocaleString()}</p>
      )}
    </div>
  );
}
```

## Security Considerations

1. **Data Privacy**: Only tutors can view activity logs for learners who purchased their courses
2. **IP Address Storage**: IP addresses are stored for security and analytics purposes
3. **Geolocation**: Location data is approximate and based on IP geolocation services
4. **Access Control**: All endpoints require tutor authentication
5. **Data Retention**: Consider implementing data retention policies for old activity logs

## Performance Considerations

1. **Indexes**: All tables have appropriate indexes for fast queries
2. **Pagination**: All list endpoints support pagination to handle large datasets
3. **Async Tracking**: Activity tracking is done asynchronously to not block main requests
4. **Geolocation Timeout**: Geolocation requests timeout after 2 seconds to prevent delays

## Troubleshooting

### Activities Not Being Tracked

1. **Check Middleware**: Ensure the activity tracking middleware is properly integrated
2. **Check User Type**: Only activities from `userType === "student"` are tracked
3. **Check Database**: Verify tables exist and are accessible
4. **Check Logs**: Check server logs for any errors in activity tracking

### Geolocation Not Working

1. **Check IP Address**: Ensure IP address is public (not local/private)
2. **Check Service**: Verify geolocation services are accessible
3. **Check Timeout**: Geolocation has a 2-second timeout - slow networks may fail
4. **Fallback**: System will continue without geolocation if services fail

### Progress Not Updating

1. **Check Module Completion**: Ensure all units in a module are viewed before module is marked complete
2. **Check Course Completion**: Ensure all modules are completed before course is marked complete
3. **Check Activity Logs**: Verify `unit_view` activities are being logged
4. **Check Database**: Verify `course_progress` table is being updated

## Future Enhancements

Potential future enhancements:

1. **Real-time Updates**: WebSocket integration for real-time activity updates
2. **Activity Analytics**: Dashboard with charts and graphs for activity trends
3. **Export Reports**: Export activity logs and progress reports to PDF/CSV
4. **Notifications**: Notify tutors when learners complete courses or reach milestones
5. **Time Tracking**: More detailed time tracking per module/unit
6. **Engagement Metrics**: Calculate engagement scores based on activity patterns

## Support

For issues or questions:
1. Check server logs for errors
2. Verify database tables exist
3. Ensure migration script ran successfully
4. Check API endpoint responses for error messages

---

**Last Updated**: January 2024
**Version**: 1.0.0

