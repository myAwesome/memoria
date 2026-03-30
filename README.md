# memoria

Generated full-stack web application.

## Stack

| Layer    | Technology                      |
|----------|---------------------------------|
| Database | MySQL              |
| Server   | Go + Gin + GORM                 |
| Client   | React + TypeScript + Vite       |

## Getting started

```bash
# Start the database, apply migrations, and run the server
./dev.sh

# Stop all containers
./shutdown.sh
```

The server listens on port **8787**.
The React dev server proxies API calls to the backend automatically.

```bash
# Start the frontend dev server (in a separate terminal)
cd client && npm install && npm run dev
```

## Environment variables

Configured in `.env`:

| Variable      | Description                        |
|---------------|------------------------------------|
| `DB_HOST`     | Database host                      |
| `DB_PORT`     | Database port                      |
| `DB_USER`     | Database user                      |
| `DB_PASSWORD` | Database password                  |
| `DB_NAME`     | Database name                      |

## API

### Models

#### `project`

| Method   | Path                    | Description                                 |
|----------|-------------------------|---------------------------------------------|
| `GET`    | `/project`            | List (pagination, search, filter, sort)     |
| `GET`    | `/project/:id`        | Get by id                                   |
| `POST`   | `/project`            | Create                                      |
| `PUT`    | `/project/:id`        | Update                                      |
| `DELETE` | `/project/:id`        | Delete                                      |
| `DELETE` | `/project/batch`      | Batch delete — body: `{"ids": [1, 2, 3]}`   |

#### `asset`

| Method   | Path                    | Description                                 |
|----------|-------------------------|---------------------------------------------|
| `GET`    | `/asset`            | List (pagination, search, filter, sort)     |
| `GET`    | `/asset/:id`        | Get by id                                   |
| `POST`   | `/asset`            | Create                                      |
| `PUT`    | `/asset/:id`        | Update                                      |
| `DELETE` | `/asset/:id`        | Delete                                      |
| `DELETE` | `/asset/batch`      | Batch delete — body: `{"ids": [1, 2, 3]}`   |

### Query parameters (list endpoints)

| Parameter     | Description                                                        |
|---------------|--------------------------------------------------------------------|
| `q`           | Full-text search across all text fields (case-insensitive)         |
| `<field>`     | Filter by exact value (numeric, boolean, enum, or foreign key)     |
| `sort_by`     | Field to sort by. Default: `id`                                    |
| `sort_dir`    | `asc` or `desc`. Default: `desc`                                   |
| `page`        | Page number (1-based). Default: `1`                                |
| `limit`       | Results per page. Default: `20`, max: `100`                        |
