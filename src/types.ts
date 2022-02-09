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
  version: number;
  _createdAt: number;
  _updatedAt: number;
};

// SavedItemAnnotations type conforming to GraphQL Schema
export type SavedItemAnnotations = {
  highlights: Highlight[];
};

export type SavedItem = {
  id: string;
  annotations: SavedItemAnnotations;
};

export type HighlightInput = {
  quote: string;
  patch: string;
  version: number;
  itemId: string;
};
