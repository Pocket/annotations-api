export const config = {
  endpoint:
    process.env.ANNOTATIONS_API_URI || 'https://annotations-api.getpocket.dev',
  batchDeletePath: '/batchDelete',
};
