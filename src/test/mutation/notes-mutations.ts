import { gql } from 'apollo-server-core';

export const CREATE_NOTE = gql`
  mutation createSavedItemHighlightNote($id: ID!, $input: String!) {
    createSavedItemHighlightNote(id: $id, input: $input) {
      text
    }
  }
`;
