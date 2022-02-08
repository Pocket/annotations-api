import { gql } from 'apollo-server-core';

export const GET_HIGHLIGHTS = gql`
  query GetHighlights($itemId: ID) {
    _entities(representations: { id: $itemId, __typename: "SavedItem" }) {
      ... on SavedItem {
        annotations {
          highlights {
            id
            patch
            version
            quote
            _createdAt
            _updatedAt
          }
        }
      }
    }
  }
`;
