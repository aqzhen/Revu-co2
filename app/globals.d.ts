declare module "*.css";

export type User = {
  userId : number,
  name : string,
  queries : Query[],
  reviews : Review[]
}

export type Review = {
  reviewerName: string;
  productId: number;
  reviewerExternalId: number;
  createdAt: string;
  updatedAt: string;
  verified: string;
  reviewId: number;
  rating: number;
  title: string;
  body: string;
};

export type Query = {
  queryId: number;
  query: string;
  userId: number;
  semanticEmbedding?: string;
  productId? : number
};

export type ReviewPrompt = {
  userId: number,
  userName: string,
  questions: string[]
}

// Define custom equality function for ReviewPrompt based on userId
function isEqual(review1: ReviewPrompt, review2: ReviewPrompt): boolean {
  return review1.userId === review2.userId;
}

// Define custom hash function for ReviewPrompt based on userId
function getHashCode(review: ReviewPrompt): string {
  return `${review.userId}`;
}

declare global {
  var admin: any;
}

export type Category = {
  category: string;
  queries: Query[];
  summary: string;
  suggestions: string;
};
