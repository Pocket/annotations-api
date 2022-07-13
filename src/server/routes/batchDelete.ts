import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { checkSchema, Schema, validationResult } from 'express-validator';
import { nanoid } from 'nanoid';
import { dynamoClient, readClient, writeClient } from '../../database/client';
import { NotesDataService } from '../../dataservices/notes';
import { HighlightsDataService } from '../../dataservices/highlights';
import { failCallback, successCallback } from './helper';

const router = Router();

const batchDeleteSchema: Schema = {
  traceId: {
    in: ['body'],
    optional: true,
    isString: true,
    notEmpty: true,
  },
  userId: {
    in: ['body'],
    errorMessage: 'Must provide valid userId',
    isInt: true,
    toInt: true,
  },
  isPremium: {
    in: ['body'],
    errorMessage: 'Must provide premium status',
    isBoolean: true,
    toBoolean: true,
  },
};

export function validate(
  req: Request,
  res: Response,
  next: NextFunction
): Response {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ errors: errors.array() })
      .setHeader('Content-Type', 'application/json');
  }
  next();
}

/**
 * Delete a user's annotation data.
 * @param userId
 * @param traceId
 */
export function deleteUserData(
  userId: string,
  traceId: string,
  isPremium: boolean
) {
  new NotesDataService(dynamoClient(), userId)
    .clearUserData()
    .then(() => successCallback('Notes', userId, traceId))
    .catch((error) => failCallback(error, 'Notes', userId, traceId));

  new HighlightsDataService({
    userId,
    db: {
      writeClient: writeClient(),
      readClient: readClient(),
    },
    apiId: 'service', // unused but required for inheritance
    isPremium,
  })
    .clearUserData()
    .then(() => successCallback('Highlights', userId, traceId))
    .catch((error) => failCallback(error, 'Highlights', userId, traceId));
}

router.post(
  '/',
  checkSchema(batchDeleteSchema),
  validate,
  (req: Request, res: Response) => {
    const requestId = req.body.traceId ?? nanoid();
    const userId = req.body.userId;
    deleteUserData(userId, requestId, req.body.isPremium);
    return res.send({
      status: 'OK',
      message: `BatchDelete: Deleting highlights and notes for userId=${userId} (requestId='${requestId}')`,
    });
  }
);

export default router;
