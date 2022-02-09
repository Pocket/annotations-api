import { gql } from 'apollo-server-core';

export const UPDATE_HIGHLIGHT = gql`
  mutation updateSavedItemHighlight($id: ID!, $input: CreateHighlightInput!) {
    updateSavedItemHighlight(id: $id, input: $input) {
      id
      patch
      version
      quote
      _createdAt
      _updatedAt
    }
  }
`;
