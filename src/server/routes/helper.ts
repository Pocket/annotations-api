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
  module: string,
  error: Error,
  dataType: string,
  userId: string,
  traceId: string,
  annotationIds?: string[]
) => {
  const failMessage = `${module}: Error = Failed to delete ${dataType} for userId=${userId}, traceId=${traceId}`;
  Sentry.addBreadcrumb({ message: failMessage });
  if (annotationIds) {
    Sentry.addBreadcrumb({
      message: `failed to delete annotationIds: ${JSON.stringify(
        annotationIds
      )}`,
    });
  }
  Sentry.captureException(error);
  console.error(failMessage);
  console.error(error);
};
