import { Pool } from 'pg'

const pool = new Pool({
    host: process.env.DB_HOST || 'kreativ_postgres',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'kreativ_edu',
    user: process.env.DB_USER || 'kreativ_user',
    password: process.env.DB_PASSWORD,
})

export default pool
