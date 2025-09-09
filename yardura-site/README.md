# Yardura Platform

A comprehensive, tech-enabled dog waste removal platform with user accounts, health insights, mobile apps, and IoT integration. Built with Next.js 14, Prisma, PostgreSQL, and modern web technologies.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local` and configure:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000

# Email (for authentication)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com

# JWT for API authentication
JWT_SECRET=your-jwt-secret-here

# Resend API (for quote emails)
RESEND_API_KEY=your-resend-api-key
```

### 3. Set Up Database

```bash
npm run setup
```

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your Yardura platform!

## 📱 Database Commands

- `npm run db:setup` - Generate Prisma client and push schema
- `npm run db:reset` - Reset database with fresh schema

## 🏗️ Architecture Overview

### Core Components

- **Landing Page**: Professional marketing site with real-time quote calculator
- **User Accounts**: Full authentication system with dog profiles
- **Dashboard**: Personal insights, service history, and health trends
- **API Endpoints**: RESTful APIs for mobile apps and IoT devices
- **Database**: PostgreSQL with Prisma ORM for data management
- **Mobile Apps**: iOS and Android apps (structure ready for development)

### Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js with database adapter
- **UI Components**: shadcn/ui, Lucide React icons
- **Forms**: React Hook Form with Zod validation
- **Email**: Resend for transactional emails
- **Mobile**: React Native (Expo) ready structure

## 🚀 Features

### Landing Page

- Professional hero section with trust signals
- Real-time quote calculator with yard size options
- Service overview with pricing transparency
- Customer testimonials and social proof
- SEO optimized with structured data

### User Accounts & Dashboard

- Secure authentication (Email/Password, Google OAuth)
- Dog profiles with health tracking
- Service history and scheduling
- Personal health insights and trends
- Eco impact tracking

### API & Integration

- RESTful APIs for mobile apps
- IoT integration for Raspberry Pi smart bins
- Real-time data collection and analytics
- Global eco statistics updates
- Account linking for service visits

### Mobile Apps (Ready for Development)

- iOS and Android native apps
- User authentication and profiles
- Service scheduling
- Health insights and analytics
- Real-time notifications

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Git

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd yardura-site
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Database
# DATABASE_URL="postgresql://username:password@localhost:5432/yardura_db"

# NextAuth.js
NEXTAUTH_URL=http://localhost:3002

# Authentication Providers (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (for authentication)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com

# JWT for API authentication
JWT_SECRET=your-jwt-secret-here

# Resend API (for quote emails)
RESEND_API_KEY=your-resend-api-key
CONTACT_TO_EMAIL=your-email@example.com
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (Optional) View database
npx prisma studio
```

### 4. Development Server

```bash
npm run dev
```

Visit `http://localhost:3002` to see the application.

## 📱 Mobile App Setup (Optional)

The mobile app structure is ready for React Native development:

### iOS Setup

```bash
cd mobile-app
npm install
cd ios && pod install
npm run ios
```

### Android Setup

```bash
cd mobile-app
npm install
npm run android
```

## 🔧 API Endpoints

### Authentication

- `POST /api/auth/[...nextauth]` - NextAuth handlers
- `GET /api/auth/session` - Get current session

### Users

- `GET /api/users` - Get user profile and data
- `POST /api/users` - Update user profile

### Dogs

- `GET /api/dogs` - Get user's dogs
- `POST /api/dogs` - Add new dog profile

### Service Visits

- `GET /api/service-visits` - Get service history
- `POST /api/service-visits` - Schedule service visit

### Data Collection

- `POST /api/data` - Submit data from Raspberry Pi (requires JWT)
- `GET /api/stats` - Get global eco statistics

### Quotes

- `POST /api/quote` - Submit quote request

## 🌐 Raspberry Pi Integration

### Setup Requirements

- Raspberry Pi with camera and sensors
- Python 3.8+
- Required Python packages:
  ```bash
  pip install requests opencv-python RPi.GPIO adafruit-circuitpython-bme680
  ```

### Authentication

The Raspberry Pi should authenticate using a JWT token:

```python
import jwt
import datetime

# Generate token (do this on your server)
payload = {
    'device_id': 'raspberry-pi-001',
    'exp': datetime.datetime.utcnow() + datetime.timedelta(days=365)
}
token = jwt.encode(payload, 'your-jwt-secret', algorithm='HS256')
```

### Data Submission

```python
import requests

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

data = {
    'deviceId': 'raspberry-pi-001',
    'accountNumber': 'ACC001',  # Optional: link to specific user
    'weight': 125.5,  # grams
    'color': 'rgb(180,140,100)',
    'consistency': 'normal',
    'temperature': 22.5,
    'methaneLevel': 0.3
}

response = requests.post('https://your-domain.com/api/data', json=data, headers=headers)
```

### Account Number Entry

During service visits, technicians can enter the customer's account number to link the data collection to their specific profile. This can be done via:

- QR code scanning
- Manual entry on the Pi's interface
- NFC card scanning
- Simple text input

## 📊 Database Schema

### Key Tables

- **User**: Account information and profiles
- **Dog**: Pet profiles with health data
- **ServiceVisit**: Scheduled and completed service records
- **DataReading**: IoT sensor data from Raspberry Pi
- **GlobalStats**: Real-time eco impact statistics

### Relationships

- User → Dogs (1:many)
- User → ServiceVisits (1:many)
- ServiceVisit → DataReadings (1:many)
- Dog → DataReadings (1:many)

## 🔐 Security Features

- JWT-based API authentication
- Session management with NextAuth.js
- Input validation with Zod schemas
- SQL injection protection via Prisma
- CORS configuration for mobile apps
- Rate limiting on API endpoints

## 📈 Analytics & Insights

### User Dashboard Features

- Real-time health score calculation
- Waste diversion tracking
- Service history with photos
- Dog-specific health trends
- Eco impact visualization

### Global Statistics

- Total waste diverted from landfills
- Methane avoided calculations
- Active users and dogs tracked
- Service visit analytics

## 🚀 Deployment

### Environment Variables for Production

Make sure to set these in your production environment:

```env
DATABASE_URL=your-production-db-url
NEXTAUTH_URL=https://your-domain.com
JWT_SECRET=your-production-jwt-secret
RESEND_API_KEY=your-production-resend-key
```

### Build Commands

```bash
npm run build
npm start
```

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database management
npx prisma studio          # View/edit database
npx prisma migrate dev     # Apply schema changes
npx prisma generate        # Regenerate Prisma client

# Code quality
npm run lint               # ESLint check
```

## 📝 License

This project is private and proprietary to Yardura.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For technical support or questions:

- Email: hello@yardura.com
- Phone: (888) 915-9273

---

Built with ❤️ by the Yardura team - Making dog ownership cleaner and healthier for everyone.
