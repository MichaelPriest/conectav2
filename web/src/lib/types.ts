export type UserProfile = {
  id: string;
  display_name: string;
  handle: string;
  bio: string;
  avatar_path: string | null;
};

export type FeedPost = {
  id: string;
  author_id: string;
  content: string;
  visibility: 'public' | 'friends' | 'private';
  media_path: string | null;
  media_type: 'image' | 'video' | null;
  created_at: string;
  profiles: { handle: string; display_name: string; avatar_path:string|null } | null;
  post_likes: { count: number }[];
  post_comments: { count: number }[];
  post_media?: Array<{storage_path:string;media_type:'image'|'video';position:number}>;
  media?: Array<{url:string;path:string;type:'image'|'video'}>;
  mediaUrl?: string | null;
};

export type PostComment = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string; handle: string; avatar_path:string|null } | null;
};
