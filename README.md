# Excel to XML Converter

A modern, secure web application for converting Excel files to XML format with advanced features and best practices implementation.

## Features

### Security

- OWASP Top 10 compliance
- AES-256 encryption for file storage
- Secure session management (5-minute timeout)
- Rate limiting and CORS protection
- Input validation and sanitization

### Functionality

- Excel file validation
- Customizable XML header fields
- Progress tracking
- Audit logging
- Mobile responsive UI

### Technical Stack

#### Frontend

- Next.js 13+ with App Router
- TypeScript
- Tailwind CSS
- Progressive Web App (PWA) support
- WCAG accessibility compliance

#### Backend

- Node.js with Express
- Winston for structured logging
- XLSX library for Excel processing
- RESTful API with versioning
- Microservices architecture

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/converter_x.git
cd converter_x
```

2. Install frontend dependencies:

```bash
cd frontend
npm install
```

3. Install backend dependencies:

```bash
cd backend
npm install
```

4. Set up environment variables:

- Copy `.env.example` to `.env`
- Update the values according to your environment

### Running the Application

1. Start the backend server:

```bash
cd backend
npm start
```

2. Start the frontend development server:

```bash
cd frontend
npm run dev
```

3. Access the application at `http://localhost:3000`

## API Endpoints

The backend provides the following RESTful API endpoints:

- `GET /` - Health check (Backend status)
- `GET /api/v1/health` - Detailed health check with version info
- `POST /api/v1/validate` - Validate Excel file
- `POST /api/v1/convert` - Convert Excel to XML
- `GET /api/v1/download/:fileId` - Download converted XML file

## Security Features

### Authentication & Authorization

- JWT-based authentication
- 5-minute session timeout
- Rate limiting (100 requests/minute)

### Data Protection

- AES-256 encryption for stored files
- SSL/TLS encryption for data in transit
- Secure file handling and cleanup

### Input Validation

- File type validation (.xls, .xlsx)
- File size limits (configurable)
- XML tag name validation
- Request payload validation

## Logging and Monitoring

### Audit Trail

- User actions
- File operations
- Security events
- Error tracking

### Logging Integration

- Structured logging with Winston
- Log file rotation with configurable retention
- Comprehensive error tracking and aggregation

## Development

### Code Style

- ESLint + Prettier (Frontend)
- ESLint (Backend)
- TypeScript strict mode

### Testing

- Jest for frontend
- Integration tests
- Security testing

## Docker Deployment

The application can be deployed using Docker Compose:

```bash
docker-compose up --build
```

This will start:
- Frontend (Next.js) on port 3000
- Backend (Express) on port 8000
- Nginx reverse proxy on port 80

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Express.js
- Next.js
- Tailwind CSS
- Winston logging
- OWASP
