import { gql } from 'apollo-server-core';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import config from '../../config';

export const GET_NOTES = gql`
  query GetHighlights($itemId: ID) {
    _entities(representations: { id: $itemId, __typename: "SavedItem" }) {
      ... on SavedItem {
        annotations {
          highlights {
            id
            note {
              _createdAt
              _updatedAt
              text
            }
          }
        }
      }
    }
  }
`;

export const noteSeedCommand = (now: Date): PutCommand => {
  const ms = Math.round(now.getTime() / 1000);
  return new PutCommand({
    TableName: config.dynamoDb.notesTable.name,
    Item: {
      [config.dynamoDb.notesTable.key]: '1',
      [config.dynamoDb.notesTable.note]: `there you have it, that's great`,
      [config.dynamoDb.notesTable._createdAt]: ms,
      [config.dynamoDb.notesTable._updatedAt]: ms,
    },
  });
};
