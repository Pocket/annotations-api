import { gql } from 'apollo-server-core';

export const DELETE_HIGHLIGHT = gql`
  mutation DeleteHighlight($id: ID!) {
    deleteSavedItemHighlight(id: $id)
  }
`;
