import * as Sentry from '@sentry/node';

export const successCallback = (
  dataType: string,
  userId: string,
  traceId: string
) => {
  const successMessage = `BatchDelete: ${dataType} deletion completed for userId=${userId}, traceId=${traceId}`;
  console.log(successMessage);
};

export const failCallback = (
  error: Error,
  dataType: string,
  userId: string,
  traceId: string
) => {
  const failMessage = `BatchDelete: Error = Failed to delete ${dataType} for userId=${userId}, traceId=${traceId}`;
  Sentry.addBreadcrumb({ message: failMessage });
  Sentry.captureException(error);
  console.log(failMessage);
  console.log(error);
};
