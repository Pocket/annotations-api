// Environment variables below are set in .aws/src/main.ts
export default {
  app: {
    environment: process.env.NODE_ENV || 'development',
    defaultMaxAge: 86400,
    port: 4008,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    release: process.env.GIT_SHA || '',
    environment: process.env.NODE_ENV || 'development',
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
  },
  dynamoDb: {
    notesTable: {
      name: process.env.HIGHLIGHT_NOTES_TABLE || 'ANNOT-local-highlight-notes',
      key: {
        name: process.env.HIGHLIGHT_NOTES_KEY || 'highlightId',
        type: process.env.HIGHLIGHT_NOTES_KEY_TYPE || 'S',
      },
      // DynamoDB does not require a schema for non-key attributes,
      // but we will configure here so we don't have to manipulate strings
      note: {
        name: process.env.HIGHLIGHT_NOTES_NOTE || 'note',
        type: process.env.HIGHLIGHT_NOTES_NOTE_TYPE || 'S',
      },
    },
  },
  database: {
    // contains tables for user, list, tags, annotations, etc.
    read: {
      host: process.env.DATABASE_READ_HOST || 'localhost',
      port: process.env.DATABASE_READ_PORT || '3306',
      user: process.env.DATABASE_READ_USER || 'root',
      password: process.env.DATABASE_READ_PASSWORD || '',
    },
    write: {
      host: process.env.DATABASE_WRITE_HOST || 'localhost',
      port: process.env.DATABASE_WRITE_PORT || '3306',
      user: process.env.DATABASE_WRITE_USER || 'root',
      password: process.env.DATABASE_WRITE_PASSWORD || '',
    },
    dbName: process.env.DATABASE || 'readitla_ril-tmp',
    tz: process.env.DATABASE_TZ || 'US/Central',
  },
};
