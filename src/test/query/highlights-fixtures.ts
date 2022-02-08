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
export const seedData = (now) => ({
  user_annotations: [
    {
      // One highlight on an item
      annotation_id: 1,
      user_id: 1,
      item_id: 1,
      quote: "'We should rewrite it all,' said Pham.",
      patch: 'patch1',
      version: 1,
      status: 1,
      updated_at: now,
      created_at: now,
    },
    {
      // > 1 annotations on an item
      annotation_id: 2,
      user_id: 1,
      item_id: 2,
      quote:
        'You and a thousand of your friends would have to work for a century or so to reproduce it.',
      patch: 'patch2',
      version: 1,
      status: 1,
      updated_at: now,
      created_at: now,
    },
    {
      annotation_id: 3,
      user_id: 1,
      item_id: 2,
      quote: "The word for all this is 'mature programming environment.'",
      patch: 'patch3',
      version: 1,
      status: 1,
      updated_at: now,
      created_at: now,
    },
    {
      annotation_id: 4,
      user_id: 1,
      item_id: 2,
      quote:
        'There were programs here that had been written five thousand years ago, before Humankind ever left Earth',
      patch: 'patch3',
      version: 1,
      status: 0, // deleted
      updated_at: now,
      created_at: now,
    },
  ],
  list: [
    { item_id: 1, user_id: 1 },
    { item_id: 2, user_id: 1 },
    { item_id: 3, user_id: 1 }, // no highlights
  ],
});
