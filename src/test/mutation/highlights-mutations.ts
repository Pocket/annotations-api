import { gql } from 'apollo-server-core';

export const CREATE_HIGHLIGHTS = gql`
  mutation CreateHighlights($input: [CreateHighlightInput!]!) {
    createSavedItemHighlights(input: $input) {
      id
      patch
      version
      quote
      _createdAt
      _updatedAt
    }
  }
`;
