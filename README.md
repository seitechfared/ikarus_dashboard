# Ikarus Dashboard Frontend

React-based dashboard UI for the Ikarus EV charging platform. Built with Vite, React Router, and modern React patterns.

## Prerequisites

- **Node.js 18+** (or 20+)
- **npm 10+** (comes with Node.js)

## Setup Instructions

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables (Optional)

Create a `.env` file in the `frontend/` directory if you need to customize the API URL:

```env
VITE_IKARUS_API_BASE_URL=http://localhost:8000/api
# or
VITE_API_BASE=http://localhost:8000/api
```

**Note:** The default API URL is already set to `http://localhost:8000/api` in the code, so this step is only needed if your backend runs on a different host or port.

### 3. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 4. Build for Production

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview
```

## Backend Setup Required

Before running the frontend, ensure the backend API is running:

1. Navigate to `IkarusBE/` directory
2. Follow the backend README to set up and start the Django API
3. The API should be running at `http://localhost:8000/api`

## Default Login Credentials

After seeding the backend database, you can log in with:

- **Email:** `admin@ikarus.com`
- **Password:** `Ikarus123!`

## Project Structure

```
IkarusDashboard/
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── features/         # Feature-based modules
│   │   │   ├── auth/         # Authentication
│   │   │   ├── chargers/     # Charger management
│   │   │   ├── stations/     # Station management
│   │   │   └── overview/     # Dashboard overview
│   │   ├── layouts/          # Layout components
│   │   ├── styles/           # CSS stylesheets
│   │   ├── utils/            # Utility functions
│   │   ├── constants.js      # App constants
│   │   └── App.jsx           # Main app component
│   ├── public/               # Static assets
│   ├── package.json          # Dependencies
│   └── vite.config.js        # Vite configuration
└── README.md                 # This file
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Troubleshooting

- **API connection errors**: Ensure the backend is running at `http://localhost:8000/api`
- **CORS errors**: Check that the backend's `DJANGO_CORS_ALLOWED_ORIGINS` includes `http://localhost:5173`
- **Login fails**: Verify the backend database has been seeded with `python manage.py seed_demo`
- **Port conflicts**: Vite will automatically try the next available port if 5173 is in use

## Features

- **Station Management**: View, create, and edit charging stations
- **Charger Management**: View, create, and edit chargers with full configuration
- **Dashboard Overview**: Statistics and insights
- **User Authentication**: Secure login with token-based auth
- **Responsive Design**: Works on desktop and tablet devices

## Technology Stack

- **React 19** - UI framework
- **React Router 7** - Client-side routing
- **Vite** - Build tool and dev server
- **Google Maps API** - Map visualization (optional, requires API key)
