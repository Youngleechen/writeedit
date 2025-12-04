// types/index.ts

export type PortfolioItem = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string; // ISO date string
};

export type TrustedClient = {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  created_at: string; // ISO date string
};