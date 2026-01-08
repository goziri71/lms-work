# Frontend Activity Tracking System - Implementation Design

## Overview

This document provides complete design specifications for implementing client-side activity tracking in the frontend. The frontend will track accurate time spent, engagement metrics, and send data to backend APIs for storage and analytics.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Activity Tracking Service                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Time Tracker │  │ Engagement   │  │ Heartbeat    │ │
│  │              │  │ Tracker      │  │ Manager      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                  │                  │        │
│         └──────────────────┴──────────────────┘        │
│                         │                               │
│              ┌──────────▼──────────┐                   │
│              │  Event Queue Manager │                   │
│              │  (Batch & Send)     │                   │
│              └──────────┬──────────┘                   │
│                         │                               │
│              ┌──────────▼──────────┐                   │
│              │   API Client        │                   │
│              │   (HTTP Requests)   │                   │
│              └────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

## Backend API Endpoints

The frontend will communicate with these endpoints:

### 1. Track Single Activity
**POST** `/api/courses/activity/track`

**Request Body**:
```json
{
  "activity_type": "unit_view",
  "course_id": 5,
  "module_id": 3,
  "unit_id": 15,
  "duration_seconds": 300,
  "engagement_metrics": {
    "scroll_depth": 85,
    "video_watch_percentage": 90,
    "interaction_count": 5
  },
  "start_time": "2024-01-20T14:00:00Z",
  "end_time": "2024-01-20T14:05:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Activity tracked successfully"
}
```

### 2. Send Heartbeat
**POST** `/api/courses/activity/heartbeat`

**Request Body**:
```json
{
  "course_id": 5,
  "module_id": 3,
  "unit_id": 15,
  "is_active": true,
  "timestamp": "2024-01-20T14:05:30Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Heartbeat received"
}
```

### 3. Track Batch Events
**POST** `/api/courses/activity/batch`

**Request Body**:
```json
{
  "events": [
    {
      "activity_type": "unit_view",
      "course_id": 5,
      "module_id": 3,
      "unit_id": 15,
      "duration_seconds": 300,
      "start_time": "2024-01-20T14:00:00Z",
      "end_time": "2024-01-20T14:05:00Z"
    },
    {
      "activity_type": "video_play",
      "course_id": 5,
      "module_id": 3,
      "unit_id": 15,
      "metadata": {
        "video_id": "video123",
        "watch_percentage": 85
      }
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Batch events processed",
  "data": {
    "total": 2,
    "processed": 2
  }
}
```

## Component Design

### 1. Activity Tracking Service (Main Service)

**File**: `src/services/activityTracking/ActivityTracker.js`

**Purpose**: Main coordinator for all tracking functionality

**Key Methods**:
- `initializeTracking(courseId, moduleId, unitId)` - Start tracking for a page/unit
- `trackPageView(activityType)` - Track when user views a page
- `trackEngagement(metrics)` - Track scroll depth, interactions
- `trackVideoPlay(videoId, watchPercentage)` - Track video watching
- `stopTracking()` - Stop tracking and send final data
- `pause()` - Pause tracking (when tab hidden or idle)
- `resume()` - Resume tracking (when tab visible or active)

**Implementation Structure**:
```javascript
class ActivityTracker {
  constructor() {
    this.timeTracker = new TimeTracker();
    this.engagementTracker = new EngagementTracker();
    this.heartbeatManager = new HeartbeatManager();
    this.eventQueue = new EventQueue();
    this.apiClient = new ActivityAPIClient();
    
    this.currentContext = {
      courseId: null,
      moduleId: null,
      unitId: null,
      activityType: null,
    };
    
    this.isTracking = false;
    this.isPaused = false;
  }
  
  initializeTracking(courseId, moduleId, unitId, activityType = 'unit_view') {
    // Set current context
    // Start time tracking
    // Start engagement tracking
    // Start heartbeat
    // Track initial page view
  }
  
  stopTracking() {
    // Stop time tracking and get final duration
    // Get final engagement metrics
    // Stop heartbeat
    // Send final activity event
    // Flush event queue
  }
  
  pause() {
    // Pause time tracking
    // Stop heartbeat
  }
  
  resume() {
    // Resume time tracking
    // Resume heartbeat
  }
}
```

### 2. Time Tracker Component

**File**: `src/services/activityTracking/TimeTracker.js`

**Purpose**: Accurately track time spent on pages/units

**How It Works**:
1. **Start Tracking**: Record `startTime = Date.now()` when page/unit loads
2. **Active Time Calculation**: Only count time when:
   - Tab is visible (Page Visibility API)
   - User is not idle (detect mouse/keyboard activity)
   - Page is in focus
3. **Idle Detection**: No activity for 2 minutes = idle (pause tracking)
4. **End Tracking**: Calculate `duration = endTime - startTime - totalIdleTime`
5. **Return Data**: `{ start_time, end_time, duration_seconds }`

**Key Methods**:
- `start()` - Begin time tracking
- `stop()` - End time tracking and return duration
- `pause()` - Pause tracking (user idle or tab hidden)
- `resume()` - Resume tracking
- `markIdle()` - Mark user as idle
- `markActive()` - Mark user as active

**Idle Detection Logic**:
- No mouse movement for 2 minutes = idle
- No keyboard input for 2 minutes = idle
- Tab becomes hidden = pause (not idle, just paused)
- Tab becomes visible again = resume

**Implementation Details**:
```javascript
class TimeTracker {
  constructor() {
    this.startTime = null;
    this.pauseStartTime = null;
    this.totalPausedTime = 0;
    this.isTracking = false;
    this.isPaused = false;
    this.idleTimer = null;
    this.IDLE_TIMEOUT = 120000; // 2 minutes
  }
  
  start() {
    this.startTime = Date.now();
    this.totalPausedTime = 0;
    this.isTracking = true;
    this.isPaused = false;
    this.setupIdleDetection();
  }
  
  stop() {
    if (!this.isTracking) return null;
    
    const endTime = Date.now();
    const activeTime = (endTime - this.startTime) - this.totalPausedTime;
    
    this.isTracking = false;
    this.clearIdleTimer();
    
    return {
      start_time: new Date(this.startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      duration_seconds: Math.floor(activeTime / 1000)
    };
  }
  
  pause() {
    if (!this.isTracking || this.isPaused) return;
    this.isPaused = true;
    this.pauseStartTime = Date.now();
    this.clearIdleTimer();
  }
  
  resume() {
    if (!this.isTracking || !this.isPaused) return;
    this.isPaused = false;
    if (this.pauseStartTime) {
      this.totalPausedTime += (Date.now() - this.pauseStartTime);
      this.pauseStartTime = null;
    }
    this.setupIdleDetection();
  }
  
  setupIdleDetection() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.pause(); // User is idle
    }, this.IDLE_TIMEOUT);
  }
  
  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
  
  resetIdleTimer() {
    if (this.isTracking && !this.isPaused) {
      this.setupIdleDetection();
    }
  }
}
```

### 3. Engagement Tracker Component

**File**: `src/services/activityTracking/EngagementTracker.js`

**Purpose**: Track user engagement quality (scroll depth, video watch %, interactions)

**Metrics to Track**:

1. **Scroll Depth** (0-100%):
   - Track maximum scroll position reached
   - Calculate: `(scrollPosition / totalHeight) * 100`
   - Update on scroll events (throttled to every 500ms)

2. **Video Watch Percentage** (0-100%):
   - Track video player events: play, pause, seek, ended
   - Calculate: `(watchedDuration / totalDuration) * 100`
   - Handle video seeking (don't double-count watched segments)

3. **Interaction Count**:
   - Count clicks on interactive elements (buttons, links, forms)
   - Count form submissions
   - Count quiz/exam attempts
   - Reset per page/unit view

4. **Engagement Score** (calculated):
   - Formula: `(scroll_depth + video_watch_percentage + interaction_score) / 3`
   - `interaction_score` = min(interaction_count * 10, 100) // Cap at 100

**Key Methods**:
- `start()` - Initialize tracking
- `trackScroll()` - Update scroll depth
- `trackVideo(videoElement)` - Track video watching
- `trackInteraction()` - Increment interaction count
- `getMetrics()` - Get current engagement metrics
- `reset()` - Reset all metrics

**Implementation Details**:
```javascript
class EngagementTracker {
  constructor() {
    this.scrollDepth = 0;
    this.videoWatchPercentage = 0;
    this.interactionCount = 0;
    this.videoElements = new Map(); // Track multiple videos
    this.isTracking = false;
    
    this.scrollHandler = null;
    this.scrollThrottle = 500; // ms
  }
  
  start() {
    this.reset();
    this.isTracking = true;
    this.setupScrollTracking();
  }
  
  setupScrollTracking() {
    let lastScrollTime = 0;
    
    this.scrollHandler = () => {
      const now = Date.now();
      if (now - lastScrollTime < this.scrollThrottle) return;
      lastScrollTime = now;
      
      this.trackScroll();
    };
    
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }
  
  trackScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    if (docHeight > 0) {
      const currentDepth = (scrollTop / docHeight) * 100;
      this.scrollDepth = Math.max(this.scrollDepth, currentDepth);
    }
  }
  
  trackVideo(videoElement, videoId = null) {
    if (!videoElement) return;
    
    const videoIdKey = videoId || videoElement.id || 'default';
    let videoData = this.videoElements.get(videoIdKey);
    
    if (!videoData) {
      videoData = {
        totalDuration: 0,
        watchedSegments: [],
        isPlaying: false,
        lastUpdateTime: null,
      };
      
      // Get total duration
      if (videoElement.duration) {
        videoData.totalDuration = videoElement.duration;
      } else {
        videoElement.addEventListener('loadedmetadata', () => {
          videoData.totalDuration = videoElement.duration;
        });
      }
      
      // Track play events
      videoElement.addEventListener('play', () => {
        videoData.isPlaying = true;
        videoData.lastUpdateTime = Date.now();
      });
      
      // Track pause events
      videoElement.addEventListener('pause', () => {
        if (videoData.isPlaying && videoData.lastUpdateTime) {
          const watchedTime = (Date.now() - videoData.lastUpdateTime) / 1000;
          this.addWatchedSegment(videoData, videoElement.currentTime, watchedTime);
        }
        videoData.isPlaying = false;
      });
      
      // Track ended event
      videoElement.addEventListener('ended', () => {
        videoData.isPlaying = false;
        this.calculateVideoWatchPercentage();
      });
      
      // Track timeupdate (every 250ms)
      videoElement.addEventListener('timeupdate', () => {
        if (videoData.isPlaying && videoData.lastUpdateTime) {
          const currentTime = videoElement.currentTime;
          const watchedTime = (Date.now() - videoData.lastUpdateTime) / 1000;
          this.addWatchedSegment(videoData, currentTime, watchedTime);
          videoData.lastUpdateTime = Date.now();
        }
      });
      
      this.videoElements.set(videoIdKey, videoData);
    }
  }
  
  addWatchedSegment(videoData, startTime, duration) {
    // Merge overlapping segments
    // This is simplified - in production, use interval tree or similar
    videoData.watchedSegments.push({ start: startTime, end: startTime + duration });
    this.calculateVideoWatchPercentage();
  }
  
  calculateVideoWatchPercentage() {
    if (this.videoElements.size === 0) {
      this.videoWatchPercentage = 0;
      return;
    }
    
    let totalWatched = 0;
    let totalDuration = 0;
    
    this.videoElements.forEach((videoData) => {
      if (videoData.totalDuration > 0) {
        // Calculate unique watched time from segments
        const uniqueWatched = this.mergeSegments(videoData.watchedSegments);
        totalWatched += uniqueWatched;
        totalDuration += videoData.totalDuration;
      }
    });
    
    if (totalDuration > 0) {
      this.videoWatchPercentage = (totalWatched / totalDuration) * 100;
    }
  }
  
  mergeSegments(segments) {
    // Merge overlapping time segments and return total unique time
    // Simplified implementation
    if (segments.length === 0) return 0;
    
    segments.sort((a, b) => a.start - b.start);
    let merged = [segments[0]];
    
    for (let i = 1; i < segments.length; i++) {
      const current = segments[i];
      const last = merged[merged.length - 1];
      
      if (current.start <= last.end) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push(current);
      }
    }
    
    return merged.reduce((total, seg) => total + (seg.end - seg.start), 0);
  }
  
  trackInteraction() {
    this.interactionCount++;
  }
  
  getMetrics() {
    const interactionScore = Math.min(this.interactionCount * 10, 100);
    const engagementScore = (this.scrollDepth + this.videoWatchPercentage + interactionScore) / 3;
    
    return {
      scroll_depth: Math.round(this.scrollDepth),
      video_watch_percentage: Math.round(this.videoWatchPercentage),
      interaction_count: this.interactionCount,
      engagement_score: Math.round(engagementScore)
    };
  }
  
  reset() {
    this.scrollDepth = 0;
    this.videoWatchPercentage = 0;
    this.interactionCount = 0;
    this.videoElements.clear();
    
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
  }
  
  stop() {
    this.isTracking = false;
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
  }
}
```

### 4. Heartbeat Manager Component

**File**: `src/services/activityTracking/HeartbeatManager.js`

**Purpose**: Send periodic pings to backend to track active learning sessions

**How It Works**:
1. **Start Heartbeat**: When user starts viewing a unit, start heartbeat timer
2. **Send Every 30 Seconds**: Send ping to backend indicating user is still active
3. **Stop on Idle**: If user becomes idle (2 minutes), stop sending heartbeats
4. **Resume on Activity**: When user becomes active again, resume heartbeats
5. **Stop on Page Leave**: When user navigates away, stop heartbeat

**Key Methods**:
- `start(courseId, moduleId, unitId)` - Begin sending heartbeats
- `stop()` - Stop sending heartbeats
- `pause()` - Pause heartbeats (user idle)
- `resume()` - Resume heartbeats (user active)

**Implementation Details**:
```javascript
class HeartbeatManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.intervalId = null;
    this.isActive = true;
    this.isPaused = false;
    this.currentContext = {
      courseId: null,
      moduleId: null,
      unitId: null,
    };
    this.HEARTBEAT_INTERVAL = 30000; // 30 seconds
  }
  
  start(courseId, moduleId, unitId) {
    this.currentContext = { courseId, moduleId, unitId };
    this.isActive = true;
    this.isPaused = false;
    
    // Send immediately
    this.sendHeartbeat();
    
    // Then send every 30 seconds
    this.intervalId = setInterval(() => {
      if (this.isActive && !this.isPaused) {
        this.sendHeartbeat();
      }
    }, this.HEARTBEAT_INTERVAL);
  }
  
  stop() {
    this.isActive = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  pause() {
    this.isPaused = true;
  }
  
  resume() {
    this.isPaused = false;
    // Send immediately when resuming
    if (this.isActive) {
      this.sendHeartbeat();
    }
  }
  
  async sendHeartbeat() {
    try {
      await this.apiClient.sendHeartbeat({
        course_id: this.currentContext.courseId,
        module_id: this.currentContext.moduleId,
        unit_id: this.currentContext.unitId,
        is_active: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Heartbeat send failed:', error);
      // Don't throw - heartbeat failures shouldn't break the app
    }
  }
}
```

### 5. Event Queue Manager

**File**: `src/services/activityTracking/EventQueue.js`

**Purpose**: Batch events and send to backend efficiently

**How It Works**:
1. **Queue Events**: Store events in memory queue
2. **Batch Send**: Send events in batches (every 10 seconds or when queue reaches 10 events)
3. **Retry Logic**: If send fails, retry up to 3 times
4. **Offline Support**: Store events in localStorage if offline, send when online
5. **Flush on Page Unload**: Send all queued events when user leaves page

**Key Methods**:
- `addEvent(event)` - Add event to queue
- `sendBatch()` - Send batch of events to backend
- `flush()` - Send all remaining events (on page unload)
- `loadFromStorage()` - Load events from localStorage (on page load)
- `saveToStorage()` - Save events to localStorage (when offline)

**Implementation Details**:
```javascript
class EventQueue {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.queue = [];
    this.batchSize = 10;
    this.batchInterval = 10000; // 10 seconds
    this.batchTimer = null;
    this.maxRetries = 3;
    this.storageKey = 'activity_tracking_queue';
    
    this.startBatchTimer();
    this.loadFromStorage();
    this.setupOnlineListener();
  }
  
  addEvent(event) {
    const eventWithId = {
      ...event,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };
    
    this.queue.push(eventWithId);
    
    // Send if queue is full
    if (this.queue.length >= this.batchSize) {
      this.sendBatch();
    }
    
    // Save to storage (for offline support)
    this.saveToStorage();
  }
  
  async sendBatch() {
    if (this.queue.length === 0) return;
    
    const events = this.queue.splice(0, this.batchSize);
    
    try {
      await this.apiClient.sendBatch({ events });
      // Success - remove from storage
      this.saveToStorage();
    } catch (error) {
      console.error('Batch send failed:', error);
      // Put events back in queue for retry
      this.queue.unshift(...events);
      
      // Retry logic
      const retryCount = events[0].retryCount || 0;
      if (retryCount < this.maxRetries) {
        events.forEach(e => e.retryCount = retryCount + 1);
        setTimeout(() => this.sendBatch(), 5000 * (retryCount + 1)); // Exponential backoff
      } else {
        // Max retries reached - save to storage for manual recovery
        console.error('Max retries reached for events:', events);
        this.saveToStorage();
      }
    }
  }
  
  flush() {
    // Send all remaining events (called on page unload)
    while (this.queue.length > 0) {
      this.sendBatch();
    }
  }
  
  startBatchTimer() {
    this.batchTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.sendBatch();
      }
    }, this.batchInterval);
  }
  
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const events = JSON.parse(stored);
        this.queue.push(...events);
        localStorage.removeItem(this.storageKey);
        
        // Try to send stored events
        if (navigator.onLine && this.queue.length > 0) {
          this.sendBatch();
        }
      }
    } catch (error) {
      console.error('Failed to load events from storage:', error);
    }
  }
  
  saveToStorage() {
    try {
      if (this.queue.length > 0) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
      } else {
        localStorage.removeItem(this.storageKey);
      }
    } catch (error) {
      console.error('Failed to save events to storage:', error);
    }
  }
  
  setupOnlineListener() {
    window.addEventListener('online', () => {
      // When coming back online, try to send queued events
      if (this.queue.length > 0) {
        this.sendBatch();
      }
    });
  }
  
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 6. API Client

**File**: `src/services/activityTracking/ActivityAPIClient.js`

**Purpose**: Handle all API communication with backend

**Key Methods**:
- `trackActivity(activityData)` - Send single activity event
- `sendHeartbeat(heartbeatData)` - Send heartbeat ping
- `sendBatch(events)` - Send batch of events

**Error Handling**:
- Network errors: Retry up to 3 times (handled by EventQueue)
- 401 Unauthorized: Stop tracking (user logged out)
- 403 Forbidden: Stop tracking (no access)
- 429 Rate Limit: Back off and retry after delay
- 500 Server Error: Log error, continue tracking (don't break UX)

**Implementation Details**:
```javascript
class ActivityAPIClient {
  constructor(baseURL = '/api/courses/activity', getAuthToken) {
    this.baseURL = baseURL;
    this.getAuthToken = getAuthToken; // Function to get auth token
  }
  
  async request(endpoint, data) {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('No auth token available');
    }
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - user logged out');
      }
      if (response.status === 403) {
        throw new Error('Forbidden - no access');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  async trackActivity(activityData) {
    return this.request('/track', activityData);
  }
  
  async sendHeartbeat(heartbeatData) {
    return this.request('/heartbeat', heartbeatData);
  }
  
  async sendBatch(batchData) {
    return this.request('/batch', batchData);
  }
}
```

### 7. User Context Detection Utilities

**File**: `src/services/activityTracking/utils/visibilityDetection.js`

**Purpose**: Detect when tab is visible/hidden

**Implementation**:
```javascript
export class VisibilityDetector {
  constructor(onVisibilityChange) {
    this.onVisibilityChange = onVisibilityChange;
    this.isVisible = !document.hidden;
    this.setupListeners();
  }
  
  setupListeners() {
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isVisible;
      this.isVisible = !document.hidden;
      
      if (wasVisible !== this.isVisible) {
        this.onVisibilityChange(this.isVisible);
      }
    });
    
    // Also track window focus/blur
    window.addEventListener('blur', () => {
      if (this.isVisible) {
        this.isVisible = false;
        this.onVisibilityChange(false);
      }
    });
    
    window.addEventListener('focus', () => {
      if (!this.isVisible && !document.hidden) {
        this.isVisible = true;
        this.onVisibilityChange(true);
      }
    });
  }
  
  isTabVisible() {
    return this.isVisible && !document.hidden;
  }
  
  destroy() {
    // Clean up listeners if needed
  }
}
```

**File**: `src/services/activityTracking/utils/idleDetection.js`

**Purpose**: Detect when user is idle

**Implementation**:
```javascript
export class IdleDetector {
  constructor(onIdle, onActive, idleTimeout = 120000) {
    this.onIdle = onIdle;
    this.onActive = onActive;
    this.idleTimeout = idleTimeout;
    this.idleTimer = null;
    this.isIdle = false;
    
    this.setupListeners();
    this.resetTimer();
  }
  
  setupListeners() {
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, () => this.resetTimer(), { passive: true });
    });
  }
  
  resetTimer() {
    if (this.isIdle) {
      this.isIdle = false;
      this.onActive();
    }
    
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.isIdle = true;
      this.onIdle();
    }, this.idleTimeout);
  }
  
  destroy() {
    clearTimeout(this.idleTimer);
  }
}
```

## Complete Flow Example

**Scenario**: Student views a unit with a video

### Step-by-Step Flow:

1. **Page Loads**:
   ```javascript
   // Initialize ActivityTracker
   const tracker = new ActivityTracker();
   tracker.initializeTracking(courseId, moduleId, unitId, 'unit_view');
   ```
   - `TimeTracker.start()` → records start time
   - `EngagementTracker.start()` → initializes metrics, sets up scroll tracking
   - `HeartbeatManager.start()` → begins 30-second pings
   - `EventQueue.addEvent()` → sends initial `unit_view` event

2. **User Scrolls**:
   - Scroll event fires → `EngagementTracker.trackScroll()` updates scroll depth
   - Throttled to every 500ms

3. **User Plays Video**:
   ```javascript
   // When video element is found
   const videoElement = document.querySelector('video');
   tracker.engagementTracker.trackVideo(videoElement, 'video-123');
   ```
   - Video events (play, pause, timeupdate) tracked
   - Watch percentage calculated

4. **User Clicks Button**:
   - Click event → `EngagementTracker.trackInteraction()` increments count

5. **Every 30 Seconds**:
   - `HeartbeatManager` sends heartbeat to backend

6. **User Becomes Idle** (2 minutes no activity):
   - `IdleDetector` detects idle → `ActivityTracker.pause()`
   - `TimeTracker.pause()` → stops counting time
   - `HeartbeatManager.pause()` → stops sending pings

7. **User Becomes Active Again**:
   - `IdleDetector` detects activity → `ActivityTracker.resume()`
   - `TimeTracker.resume()` → resumes counting
   - `HeartbeatManager.resume()` → resumes pings

8. **User Leaves Page**:
   ```javascript
   // On component unmount or page unload
   tracker.stopTracking();
   ```
   - `TimeTracker.stop()` → calculates final duration
   - `EngagementTracker.getMetrics()` → gets final metrics
   - `EventQueue.flush()` → sends all queued events
   - Final activity event sent with:
     - Duration
     - Engagement metrics
     - Start/end times

## Integration Points

### React Integration

**File**: `src/hooks/useActivityTracking.js`

```javascript
import { useEffect, useRef } from 'react';
import { ActivityTracker } from '@/services/activityTracking/ActivityTracker';

export function useActivityTracking(courseId, moduleId, unitId, activityType = 'unit_view') {
  const trackerRef = useRef(null);
  
  useEffect(() => {
    // Initialize tracker
    const tracker = new ActivityTracker();
    trackerRef.current = tracker;
    
    tracker.initializeTracking(courseId, moduleId, unitId, activityType);
    
    // Cleanup on unmount
    return () => {
      if (trackerRef.current) {
        trackerRef.current.stopTracking();
        trackerRef.current = null;
      }
    };
  }, [courseId, moduleId, unitId, activityType]);
  
  return {
    trackEngagement: (metrics) => trackerRef.current?.engagementTracker.trackEngagement(metrics),
    trackVideo: (videoElement, videoId) => trackerRef.current?.engagementTracker.trackVideo(videoElement, videoId),
    trackInteraction: () => trackerRef.current?.engagementTracker.trackInteraction(),
  };
}
```

**Usage in Component**:
```jsx
import { useActivityTracking } from '@/hooks/useActivityTracking';

function UnitView({ courseId, moduleId, unitId }) {
  const { trackVideo, trackInteraction } = useActivityTracking(courseId, moduleId, unitId, 'unit_view');
  
  useEffect(() => {
    // Track video when video element loads
    const videoElement = document.querySelector('video');
    if (videoElement) {
      trackVideo(videoElement, 'unit-video-123');
    }
  }, [trackVideo]);
  
  const handleButtonClick = () => {
    trackInteraction();
    // ... button logic
  };
  
  return (
    <div>
      <video src="..." />
      <button onClick={handleButtonClick}>Click Me</button>
    </div>
  );
}
```

### Vanilla JavaScript Integration

```javascript
// On page load
const tracker = new ActivityTracker();

// Initialize with course/module/unit IDs
tracker.initializeTracking(courseId, moduleId, unitId, 'unit_view');

// Track video when video element is ready
const videoElement = document.querySelector('video');
if (videoElement) {
  tracker.engagementTracker.trackVideo(videoElement, 'video-123');
}

// Track interactions
document.addEventListener('click', (e) => {
  if (e.target.matches('button, a, input[type="submit"]')) {
    tracker.engagementTracker.trackInteraction();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  tracker.stopTracking();
});
```

## Performance Considerations

### Optimizations:

1. **Throttle Scroll Events**: Don't track every scroll, throttle to 500ms
2. **Debounce Engagement Updates**: Don't send updates on every change
3. **Use requestIdleCallback**: For non-critical tracking operations
4. **Batch Events**: Send multiple events together to reduce API calls
5. **Lazy Load**: Only initialize tracking when needed
6. **Clean Up Listeners**: Remove event listeners on component unmount

### Memory Management:

- Clear event queue after successful send
- Limit queue size (max 50 events)
- Clean up event listeners on component unmount
- Clear timers and intervals properly

## Error Handling & Resilience

### Offline Support:

- Store events in `localStorage` if API call fails
- Retry when connection is restored
- Use `navigator.onLine` to detect connectivity
- Limit localStorage size (max 100 events)

### Graceful Degradation:

- If tracking fails, don't break the page
- Log errors to console (for debugging)
- Continue tracking even if some metrics fail
- Don't block UI with tracking operations

### Privacy:

- Only track learning-related activities
- Don't track sensitive information
- Allow user to opt-out (if needed in future)
- Comply with GDPR/FERPA

## Testing Checklist

**Test Scenarios**:
- [ ] Page view tracking works
- [ ] Time tracking is accurate (test with known duration)
- [ ] Scroll depth is calculated correctly
- [ ] Video watch percentage is accurate
- [ ] Heartbeat sends every 30 seconds
- [ ] Idle detection works (pause after 2 minutes)
- [ ] Tab visibility detection works (pause when hidden)
- [ ] Event batching works (multiple events sent together)
- [ ] Offline support works (events stored and sent when online)
- [ ] Error handling works (API failures don't break page)
- [ ] Performance is good (no page lag)
- [ ] Memory leaks don't occur (proper cleanup)

## File Structure

**Suggested File Structure**:

```
src/
  services/
    activityTracking/
      ActivityTracker.js          # Main service
      TimeTracker.js              # Time tracking logic
      EngagementTracker.js        # Engagement metrics
      HeartbeatManager.js         # Heartbeat system
      EventQueue.js               # Event batching
      ActivityAPIClient.js        # API communication
      utils/
        idleDetection.js          # Idle detection logic
        visibilityDetection.js   # Tab visibility logic
  hooks/ (if using React)
    useActivityTracking.js        # React hook for easy integration
  components/
    ActivityTrackingProvider.js   # Context provider (if using React)
```

## Implementation Phases

### Phase 1: Basic Time Tracking (Quick Win)
- Implement `TimeTracker`
- Implement `ActivityAPIClient`
- Track page view start/end
- Send duration on page unload

### Phase 2: Heartbeat System
- Implement `HeartbeatManager`
- Send heartbeat every 30 seconds
- Track active sessions accurately

### Phase 3: Engagement Metrics
- Implement `EngagementTracker`
- Track scroll depth, video watch %, interactions
- Calculate engagement score

### Phase 4: Event Batching & Offline Support
- Implement `EventQueue`
- Batch events for performance
- Add offline support with localStorage

### Phase 5: User Context Detection
- Implement idle detection
- Implement tab visibility detection
- Pause/resume tracking based on context

### Phase 6: Integration & Polish
- Create React hooks/components
- Integrate with existing pages
- Performance optimization
- Error handling improvements

---

**Last Updated**: January 2025
**Version**: 2.0.0
