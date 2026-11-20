# Real-Time Public Transport Tracking System (Android)

A complete, production-ready full-stack Android mobile application and real-time backend platform for public transit tracking. The system enables transit drivers to broadcast live GPS telemetry from Android devices and allows passengers to track moving buses in real time on interactive Google Maps with live countdown ETAs, designated stops, and route progression timelines.

---

## 📱 System Architecture

```
                    ┌────────────────────────────┐
                    │    TRANSIT DRIVER APP      │
                    │   (React Native Android)   │
                    │  • Android Foreground GPS  │
                    │  • Trip & Route Telemetry  │
                    └─────────────┬──────────────┘
                                  │
                                  │ (Socket.IO + REST / JWT)
                                  ▼
                    ┌────────────────────────────┐
                    │     NODE.JS / EXPRESS      │
                    │       BACKEND ENGINE       │
                    │  • Coordinate Validation   │
                    │  • Trip Rooms & Socket.IO  │
                    │  • MongoDB & Mongoose ORM  │
                    └─────────────┬──────────────┘
                                  │
                                  │ (Real-Time WebSocket Broadcast)
                                  ▼
                    ┌────────────────────────────┐
                    │   PASSENGER MOBILE APP     │
                    │   (React Native Android)   │
                    │  • Google Maps SDK Radar   │
                    │  • Live Moving Bus Markers │
                    │  • Real-time ETA Countdown │
                    └────────────────────────────┘
```

---

## 🛠️ Strict Technology Stack

### Frontend (Mobile App - Android Only)
- **Framework:** React Native (`.jsx`)
- **Language:** JavaScript (ES6+) — *Strictly NO TypeScript / No TSX*
- **Styling:** NativeWind (Tailwind CSS) & custom utility styles (`global.css`)
- **Navigation:** React Navigation (Native Stack & Bottom Tabs)
- **Maps & GIS:** Google Maps SDK & `react-native-maps`
- **Location:** Device GPS via `react-native-geolocation-service` with Android Foreground Service support
- **State & Storage:** React Context API & `@react-native-async-storage/async-storage`
- **Networking:** Axios HTTP Client & `socket.io-client`
- **Vector Icons:** High-performance custom SVG icons via `react-native-svg`

### Backend (REST API & Real-Time Telemetry Engine)
- **Runtime:** Node.js (`.js`)
- **Web Framework:** Express.js
- **Database:** MongoDB & Mongoose ORM
- **Real-Time Layer:** Socket.IO v4 Engine (Room-based pub/sub architecture)
- **Authentication:** JSON Web Tokens (JWT) & `bcryptjs` password hashing
- **Security:** CORS configuration, input validation, role-based authorization

---

## 📂 Project Structure

```
PUBLIC-TRANSPORT-TRACKING/
├── mobile-app/
│   ├── App.jsx                               # Root application component
│   ├── global.css                            # Tailwind CSS configuration & custom shadows
│   ├── index.js                              # React Native entry registry
│   ├── package.json                          # Mobile app dependencies
│   ├── tailwind.config.js                    # Theme colors & rounded cards
│   ├── babel.config.js                       # Babel + NativeWind plugin
│   ├── metro.config.js                       # Metro bundler config
│   ├── android/                              # Complete Android Native Project
│   │   ├── build.gradle                      # Top-level Gradle configuration
│   │   ├── settings.gradle                   # Gradle settings & native module linking
│   │   ├── gradle.properties                 # JVM arguments & Hermes configuration
│   │   └── app/
│   │       ├── build.gradle                  # App-level build file & dependencies
│   │       └── src/main/
│   │           ├── AndroidManifest.xml       # Foreground GPS & Google Maps SDK setup
│   │           └── java/com/publictransport/tracking/
│   │               ├── MainActivity.java     # Android Activity entry point
│   │               └── MainApplication.java  # Android ReactApplication bootstrap
│   └── src/
│       ├── components/
│       │   ├── CustomButton.jsx              # Reusable modern button (Primary, Success, Danger)
│       │   ├── CustomInput.jsx               # Clean text input with password toggle & icon
│       │   ├── Header.jsx                    # Top bar with title, back button & notifications
│       │   ├── Icons.jsx                     # Complete SVG vector icons set
│       │   ├── LiveBadge.jsx                 # Pulsing green LIVE indicator badge
│       │   ├── MapContainer.jsx              # Google Maps wrapper (Bus marker, polyline, stops, centering)
│       │   └── StatCard.jsx                  # Metric card for distance, trips, duration
│       ├── context/
│       │   └── AuthContext.jsx               # Authentication context & persistent token store
│       ├── navigation/
│       │   └── AppNavigator.jsx              # Role-based navigation (Driver, Passenger, Auth)
│       ├── screens/
│       │   ├── driver/
│       │   │   ├── DriverLoginScreen.jsx     # Driver login with credentials
│       │   │   ├── DriverDashboard.jsx       # Driver metrics, start trip CTA, quick stats
│       │   │   ├── StartTripScreen.jsx       # Route & vehicle selection dropdown
│       │   │   ├── TripTrackingScreen.jsx    # Real-time GPS stream, map & speed telemetry
│       │   │   ├── EndTripScreen.jsx         # Summary log of distance, duration & completion
│       │   │   └── DriverHistoryScreen.jsx   # List of past completed shifts
│       │   └── passenger/
│       │       ├── PassengerWelcomeScreen.jsx# Splash & welcome screen
│       │       ├── PassengerLoginScreen.jsx  # Passenger sign-in
│       │       ├── PassengerRegisterScreen.jsx# Account registration
│       │       ├── PassengerDashboard.jsx    # Quick cards, live radar banner, favorites
│       │       ├── RoutesScreen.jsx          # Route corridors with search & filter pills
│       │       ├── LiveTrackingScreen.jsx    # Moving bus on Google Maps with ETA drawer
│       │       ├── RouteUpdatesScreen.jsx    # Vertical timeline of designated stops
│       │       └── PassengerProfileScreen.jsx# Passenger profile & travel shortcuts
│       ├── services/
│       │   ├── api.js                        # Axios instance with JWT interceptor
│       │   ├── socket.js                     # Socket.IO client service & reconnection
│       │   └── locationService.js            # Android device GPS watch & distance accumulation
│       └── utils/
│           ├── distance.js                   # Haversine distance formula & ETA calculator
│           └── theme.js                      # Color palette, shadows & typography
│
└── backend/
    ├── config/
    │   └── db.js                             # MongoDB connection & fallback handler
    ├── controllers/
    │   ├── authController.js                 # Register, login, profile endpoints
    │   ├── driverController.js               # Start trip, end trip, trip status, dashboard
    │   ├── passengerController.js            # Passenger routes, active vehicles, locations
    │   ├── routeController.js                # Route CRUD
    │   ├── vehicleController.js              # Vehicle fleet management
    │   └── locationController.js             # Telemetry updates & latest vehicle location
    ├── middleware/
    │   ├── authMiddleware.js                 # JWT verification
    │   ├── roleMiddleware.js                 # Role-based authorization ('driver', 'passenger')
    │   └── errorMiddleware.js                # Centralized error handler
    ├── models/
    │   ├── User.js                           # User schema with bcrypt hashing
    │   ├── Vehicle.js                        # Transit vehicle model
    │   ├── Route.js                          # Route, stops and coordinates schema
    │   ├── Trip.js                           # Active & completed trip records
    │   └── VehicleLocation.js                # High-frequency GPS telemetry history (with accuracy)
    ├── routes/
    │   ├── authRoutes.js                     # /api/auth/*
    │   ├── driverRoutes.js                   # /api/driver/*
    │   ├── passengerRoutes.js                # /api/passenger/*
    │   ├── routeRoutes.js                    # /api/routes/*
    │   ├── vehicleRoutes.js                  # /api/vehicles/*
    │   └── locationRoutes.js                 # /api/location/*
    ├── sockets/
    │   └── socketHandler.js                  # Socket.IO rooms, validation & live broadcasts
    ├── utils/
    │   └── distanceCalculator.js             # Geospatial calculations & coordinate validation
    ├── .env.example                          # Environment variable template
    ├── .env                                  # Configuration file
    ├── package.json                          # Backend dependencies
    ├── seed.js                               # Development test data seeder
    ├── server.js                             # Express HTTP & Socket.IO server
    └── test.js                               # Automated verification test suite
```

---

## ⚡ Socket.IO Event Specification

### Driver Events (Mobile ➔ Backend)
| Event Name | Payload | Server Response / Callback |
|---|---|---|
| `driver:join` | `{ driverId }` | `{ success: true, driverId }` |
| `trip:start` | `{ tripId, vehicleId, routeId }` | `{ success: true, data }` |
| `location:update` | `{ tripId, vehicleId, driverId, latitude, longitude, accuracy, speed, heading, timestamp }` | `{ success: true, tripId, timestamp }` |
| `trip:status` | `{ tripId, status, stopName, eta }` | `{ success: true, payload }` |
| `trip:end` | `{ tripId, vehicleId }` | `{ success: true, payload }` |

### Passenger Events (Backend ➔ Mobile)
| Event Name | Payload | Purpose |
|---|---|---|
| `passenger:join` | `{ passengerId }` | Registers commuter channel |
| `trip:subscribe` | `{ tripId }` | Subscribes passenger to live trip room & sends cached position |
| `trip:unsubscribe`| `{ tripId }` | Leaves trip room |
| `vehicle:location`| `{ tripId, vehicleId, driverId, latitude, longitude, accuracy, speed, heading, timestamp }` | Live bus marker movement |
| `trip:started` | `{ tripId, vehicleId, routeId, timestamp }` | Bus departed terminal alert |
| `trip:status` | `{ tripId, status, stopName, eta, timestamp }` | Timeline & stop updates |
| `trip:completed` | `{ tripId, vehicleId, status: 'completed', timestamp }` | Shift concluded alert |

---

## 🔑 Seed Data & Test Accounts

Run the database seeder:
```bash
cd backend
npm run seed
```

### Seeded Credentials:
| Account Type | Email / ID | Password | Details |
|---|---|---|---|
| **Driver** | `driver@transit.com` | `password123` | Assigned to Vehicle `BUS-01` |
| **Passenger 1** | `passenger1@transit.com` | `password123` | Commuter account |
| **Passenger 2** | `passenger2@transit.com` | `password123` | Commuter account |

### Fleet Vehicles:
- **`BUS-01`**: Standard Transit Bus (Capacity: 45 passengers)
- **`BUS-02`**: Electric Shuttle (Capacity: 35 passengers)

### Designated Routes:
1. **`R-101` - North-South Metro Express**
   - Origin: Central Transit Terminal ➔ Destination: Harbor View Transit Center
   - Stops: 6 designated stops (Market St, Civic Center, Financial District, Union Square, Harbor View)
2. **`R-202` - Uptown Circular Line**
   - Origin: Grand Central Plaza ➔ Destination: University Medical Campus
   - Stops: 4 designated stops
3. **`R-303` - Airport Express Corridor**
   - Origin: Downtown Metro Station ➔ Destination: International Airport Terminal 3
   - Stops: 4 designated stops

---

## 🛰️ Android Permissions & Configuration

The Android configuration is located in `mobile-app/android/app/src/main/AndroidManifest.xml`:

### 1. Android GPS Permissions Required
```xml
<!-- Hardware GPS Location -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Continuous Driver Tracking in Background / Screen Locked -->
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

### 2. Google Maps SDK API Key
In `mobile-app/android/app/src/main/AndroidManifest.xml`, replace the placeholder with your Google Cloud Maps SDK API key:
```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="AIzaSy_YOUR_GOOGLE_MAPS_API_KEY_HERE" />
```
*Note:* In Google Cloud Console, enable **"Maps SDK for Android"** for this API key.

---

## 🚀 How to Run the Application

### Step 1: Start Backend
```bash
cd backend
npm install
npm run test     # Executes automated 10-point test suite
npm run seed     # Seeds demo drivers, routes and vehicles
npm start        # Launches server on http://localhost:5000
```

### Step 2: Configure Mobile Networking
- **Android Emulator:** Automatically connects to `http://10.0.2.2:5000` (pre-configured in `api.js` and `socket.js`).
- **Physical Android Device:** Ensure phone and computer are on the same Wi-Fi, then run:
  ```bash
  adb reverse tcp:5000 tcp:5000
  ```

### Step 3: Run Mobile App on Android
```bash
cd mobile-app
npx react-native run-android
```

### Step 4: Generating an Android Release APK
To build a standalone APK for testing on physical Android devices:
```bash
cd mobile-app/android
./gradlew assembleRelease
```
The output APK will be generated at:
`mobile-app/android/app/build/outputs/apk/release/app-release.apk`
