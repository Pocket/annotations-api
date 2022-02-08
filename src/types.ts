// The highlight DB entity
export type HighlightEntity = {
  annotation_id: string;
  user_id: number;
  item_id: number;
  quote: string;
  patch: string;
  version: number;
  status: number;
  created_at: Date;
  updated_at: Date;
};

// Highlight type conforming to GraphQL schema
export type Highlight = {
  id: string;
  quote: string;
  patch: string;
  version: string;
  _createdAt: number;
  _updatedAt: number;
};

// SavedItemAnnotations type conforming to GraphQL Schema
export type SavedItemAnnotations = {
  highlight: Highlight[];
};
