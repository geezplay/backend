# RacePhoto MERN Backend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file and configure:
```bash
copy .env.example .env
```

3. Configure MySQL connection in `.env`:
```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=racephoto
DB_USER=root
DB_PASSWORD=
```

4. Create database in MySQL:
```sql
CREATE DATABASE racephoto;
```

5. Create super admin:
```bash
node seeders/createSuperAdmin.js
```

6. Run development server:
```bash
npm run dev
```

## API Endpoints

### Public Routes
- `POST /api/auth/login` - Login
- `GET /api/events` - Get approved events
- `GET /api/events/:id` - Get event detail
- `GET /api/photos/event/:eventId/class/:className` - Get photos by class
- `POST /api/orders` - Create order
- `POST /api/payment/create-token` - Create Midtrans payment token

### Admin Routes (requires auth)
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/transactions` - List transactions
- `CRUD /api/admin/events` - Manage events
- `CRUD /api/admin/photos` - Manage photos

### Super Admin Routes
- `CRUD /api/admin/users` - Manage admin users
- `CRUD /api/admin/sponsors` - Manage sponsors
- `CRUD /api/admin/photographers` - Manage photographers
- `POST /api/admin/settings` - Update site settings
